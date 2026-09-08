import { createClient } from '@supabase/supabase-js';

const $ = (selector, root = document) => root.querySelector(selector);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const ROOM_RE = /^[A-Z0-9]{4,8}$/;
const META_MS = 250;
const WATCH_MS = 500;
const POWER_COOLDOWN_MS = 24000;
const REVIVE_COOLDOWN_MS = 30000;
const QUICKMATCH_WAIT_MS = 1200;
const QUICKMATCH_TIMEOUT_MS = 11000;
const HISTORY_KEY = 'wae_neon_rider_v18_runs';

const ROLES = Object.freeze({
  assault: {
    id: 'assault', name: 'ASSAULT', subtitle: 'DAÑO', icon: '◆', power: 'BARRAGE',
    description: 'Cadencia superior y ataque coordinado contra objetivos prioritarios.',
  },
  vanguard: {
    id: 'vanguard', name: 'VANGUARD', subtitle: 'TANK', icon: '⬢', power: 'AEGIS WALL',
    description: 'Más escudo, reducción de daño y barrera temporal para toda la escuadra.',
  },
  support: {
    id: 'support', name: 'SUPPORT', subtitle: 'MEDIC', icon: '✚', power: 'NANO WAVE',
    description: 'Regeneración, curación de equipo y rescate remoto de pilotos abatidos.',
  },
  interceptor: {
    id: 'interceptor', name: 'INTERCEPTOR', subtitle: 'SPEED', icon: '➤', power: 'VECTOR RUSH',
    description: 'Mayor velocidad y un overdrive temporal para toda la formación.',
  },
});

const env = {
  url: String(import.meta.env.VITE_WAE_SUPABASE_URL ?? '').replace(/\/$/, ''),
  key: String(import.meta.env.VITE_WAE_SUPABASE_PUBLISHABLE_KEY ?? ''),
};

const net = {
  client: null,
  channel: null,
  quickChannel: null,
  room: '',
  playerId: sessionStorage.getItem('wae_neon_rider_player_id') || crypto.randomUUID?.() || `p-${Math.random().toString(36).slice(2)}`,
  callsign: localStorage.getItem('wae_neon_rider_callsign') || 'PILOTO',
  joinedAt: Date.now(),
  role: ROLES[localStorage.getItem('wae_neon_rider_v18_role')] ? localStorage.getItem('wae_neon_rider_v18_role') : 'assault',
  peers: new Map(),
  connected: false,
  connecting: false,
  metaTimer: 0,
  watchTimer: 0,
  uiTimer: 0,
  original: null,
  lastState: '',
  lastScore: 0,
  runStartedAt: 0,
  runRecorded: false,
  teamPeak: 0,
  synergy: 0,
  overdriveUntil: 0,
  barrierUntil: 0,
  boostUntil: 0,
  nextPowerAt: 0,
  nextReviveAt: 0,
  reviveOffer: null,
  abilityRate: new Map(),
  rescueRate: new Map(),
  extraSpawnAt: 0,
  lastSupportRegen: 0,
  lastHostFlag: false,
};

sessionStorage.setItem('wae_neon_rider_player_id', net.playerId);

function game() {
  return window.__waeNeonRiderGame;
}

function roomFromUrl() {
  return String(new URLSearchParams(location.search).get('squad') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function makeClient() {
  if (!env.url || !env.key) throw new Error('REALTIME_BACKEND_NOT_CONFIGURED');
  if (!net.client) {
    net.client = createClient(env.url, env.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 36 } },
    });
  }
  return net.client;
}

function isBattleAuthority() {
  const role = $('[data-v17-role]')?.textContent || '';
  return /HOST AUTHORITY/i.test(role);
}

function maxShield() {
  const g = game();
  return Math.max(1, Number(g?.getMaxShield?.() ?? g?.maxShield ?? 100) || 100);
}

function currentShieldPercent() {
  const g = game();
  if (!g) return 0;
  return clamp((Number(g.shield) || 0) / maxShield() * 100, 0, 100);
}

function currentPilotMeta() {
  const g = game();
  if (!g?.ship) return null;
  return {
    playerId: net.playerId,
    callsign: net.callsign,
    joinedAt: net.joinedAt,
    role: net.role,
    state: String(g.state || 'idle').slice(0, 16),
    x: Number(g.ship.position.x.toFixed(2)),
    y: Number(g.ship.position.y.toFixed(2)),
    z: Number(g.ship.position.z.toFixed(2)),
    shield: Number(currentShieldPercent().toFixed(1)),
    score: Math.max(0, Math.floor(Number(g.score) || 0)),
    sector: clamp(Math.floor(Number(g.sector) || 1), 1, 999),
    downed: g.state === 'gameover',
    t: Date.now(),
  };
}

function localPresence() {
  return {
    playerId: net.playerId,
    callsign: net.callsign,
    joinedAt: net.joinedAt,
    role: net.role,
    version: 18,
  };
}

function send(event, payload) {
  net.channel?.send({ type: 'broadcast', event, payload }).catch(() => {});
}

function setRole(roleId, broadcast = true) {
  if (!ROLES[roleId]) return;
  net.role = roleId;
  localStorage.setItem('wae_neon_rider_v18_role', roleId);
  if (broadcast && net.connected) {
    net.channel?.track(localPresence()).catch(() => {});
    send('role_change', { playerId: net.playerId, role: roleId, at: Date.now() });
  }
  decorateLobby();
  renderHud();
}

function decorateLobby() {
  const panel = $('.v16-squad-panel');
  if (!panel) return;
  let block = $('#v18-role-deck', panel);
  if (!block) {
    block = document.createElement('section');
    block.id = 'v18-role-deck';
    block.className = 'v18-role-deck';
    block.innerHTML = `
      <div class="v18-role-deck__head">
        <span>SQUADRON LOADOUT</span>
        <strong>ELIGE TU FUNCIÓN TÁCTICA</strong>
      </div>
      <div class="v18-role-grid">
        ${Object.values(ROLES).map((role) => `<button type="button" data-v18-role="${role.id}"><i>${role.icon}</i><b>${role.name}</b><span>${role.subtitle}</span></button>`).join('')}
      </div>
      <button type="button" class="v18-lobby-quick" data-v18-lobby-quick>⚡ PARTIDA RÁPIDA · AUTO MATCH</button>`;
    const anchor = $('[data-v16-connect-view]', panel) || panel.children[1];
    panel.insertBefore(block, anchor || null);
    block.addEventListener('click', (event) => {
      const roleButton = event.target.closest('[data-v18-role]');
      if (roleButton) setRole(roleButton.dataset.v18Role);
      if (event.target.closest('[data-v18-lobby-quick]')) startQuickMatch();
    });
  }
  for (const button of block.querySelectorAll('[data-v18-role]')) button.classList.toggle('active', button.dataset.v18Role === net.role);
}

function ensureHud() {
  let hud = $('#v18-squad-hud');
  if (hud) return hud;
  hud = document.createElement('aside');
  hud.id = 'v18-squad-hud';
  hud.className = 'v18-squad-hud hidden';
  hud.innerHTML = `
    <div class="v18-hud-head">
      <div><span>SQUADRON NETWORK</span><strong data-v18-role-name>ASSAULT</strong></div>
      <b data-v18-pilots>1 PILOTO</b>
    </div>
    <div class="v18-synergy">
      <div><span>FORMATION SYNERGY</span><strong data-v18-synergy-value>0%</strong></div>
      <i><b data-v18-synergy-fill></b></i>
    </div>
    <div class="v18-peer-list" data-v18-peer-list></div>
    <div class="v18-hud-actions">
      <button type="button" data-v18-power>ACTIVAR PODER</button>
      <button type="button" data-v18-revive class="hidden">REANIMAR</button>
    </div>
    <small data-v18-hud-status>CO-OP TÁCTICO LISTO</small>`;
  $('#app')?.append(hud);
  hud.addEventListener('click', (event) => {
    if (event.target.closest('[data-v18-power]')) activateRolePower();
    if (event.target.closest('[data-v18-revive]')) offerRevive();
  });
  return hud;
}

function ensureReviveAccept() {
  const panel = $('#game-over-screen .panel');
  if (!panel) return null;
  let box = $('#v18-revive-offer', panel);
  if (!box) {
    box = document.createElement('div');
    box.id = 'v18-revive-offer';
    box.className = 'v18-revive-offer hidden';
    box.innerHTML = '<span>REANIMACIÓN DE ESCUADRÓN</span><strong data-v18-revive-from>ALIADO</strong><button type="button" data-v18-accept-revive>ACEPTAR REANIMACIÓN</button>';
    panel.append(box);
    box.addEventListener('click', (event) => {
      if (event.target.closest('[data-v18-accept-revive]')) acceptRevive();
    });
  }
  return box;
}

function ensureRecap() {
  const panel = $('#game-over-screen .panel');
  if (!panel) return null;
  let recap = $('#v18-squad-recap', panel);
  if (!recap) {
    recap = document.createElement('section');
    recap.id = 'v18-squad-recap';
    recap.className = 'v18-squad-recap';
    recap.innerHTML = '<span>SQUADRON REPORT</span><div><div><small>EQUIPO</small><strong data-v18-recap-team>0</strong></div><div><small>PILOTOS</small><strong data-v18-recap-pilots>1</strong></div><div><small>ROL</small><strong data-v18-recap-role>ASSAULT</strong></div></div>';
    const restart = $('#restart-btn', panel);
    panel.insertBefore(recap, restart || null);
  }
  return recap;
}

function teamScore() {
  let total = Math.max(0, Number(game()?.score) || 0);
  for (const [id, peer] of net.peers) if (id !== net.playerId) total += Math.max(0, Number(peer.peakScore ?? peer.score) || 0);
  net.teamPeak = Math.max(net.teamPeak, Math.floor(total));
  return net.teamPeak;
}

function activePeers() {
  const now = Date.now();
  const list = [...net.peers.values()].filter((peer) => peer?.playerId && now - (peer.lastSeen ?? now) < 5000);
  if (!list.some((peer) => peer.playerId === net.playerId)) {
    const local = currentPilotMeta();
    if (local) list.push({ ...local, lastSeen: now });
  }
  return list.slice(0, 4);
}

function nearestDownedPeer() {
  const local = currentPilotMeta();
  if (!local) return null;
  const range = net.role === 'support' ? 14 : 8;
  return activePeers()
    .filter((peer) => peer.playerId !== net.playerId && peer.downed)
    .map((peer) => ({ ...peer, distance: Math.hypot((peer.x ?? 0) - local.x, (peer.y ?? 0) - local.y) }))
    .filter((peer) => peer.distance <= range)
    .sort((a, b) => a.distance - b.distance)[0] || null;
}

function renderHud() {
  const hud = ensureHud();
  const connected = net.connected;
  hud.classList.toggle('hidden', !connected);
  document.body.classList.toggle('v18-networked', connected);
  if (!connected) return;

  const role = ROLES[net.role];
  const peers = activePeers();
  $('[data-v18-role-name]', hud).textContent = `${role.icon} ${role.name}`;
  $('[data-v18-pilots]', hud).textContent = `${peers.length} PILOTO${peers.length === 1 ? '' : 'S'}`;
  $('[data-v18-synergy-value]', hud).textContent = `${Math.round(net.synergy)}%`;
  $('[data-v18-synergy-fill]', hud).style.width = `${clamp(net.synergy, 0, 100)}%`;

  const list = $('[data-v18-peer-list]', hud);
  list.replaceChildren(...peers.map((peer) => {
    const node = document.createElement('article');
    const peerRole = ROLES[peer.role] || ROLES.assault;
    node.className = peer.downed ? 'downed' : '';
    node.innerHTML = '<i></i><div><strong></strong><span></span></div><b></b>';
    node.querySelector('i').textContent = peerRole.icon;
    node.querySelector('strong').textContent = peer.callsign || 'PILOTO';
    node.querySelector('span').textContent = `${peerRole.name} · ESC ${Math.round(Number(peer.shield) || 0)}%`;
    node.querySelector('b').textContent = peer.downed ? 'DOWN' : 'ONLINE';
    return node;
  }));

  const power = $('[data-v18-power]', hud);
  const remaining = Math.max(0, net.nextPowerAt - Date.now());
  power.disabled = remaining > 0 || game()?.state !== 'playing';
  power.textContent = remaining > 0 ? `${role.power} · ${Math.ceil(remaining / 1000)}s` : role.power;

  const rescue = nearestDownedPeer();
  const revive = $('[data-v18-revive]', hud);
  const reviveRemain = Math.max(0, net.nextReviveAt - Date.now());
  revive.classList.toggle('hidden', !rescue);
  if (rescue) {
    revive.disabled = reviveRemain > 0;
    revive.textContent = reviveRemain > 0 ? `RESCATE · ${Math.ceil(reviveRemain / 1000)}s` : `REANIMAR ${rescue.callsign}`;
  }

  const status = $('[data-v18-hud-status]', hud);
  if (Date.now() < net.overdriveUntil) status.textContent = 'FORMATION OVERDRIVE · DAÑO Y MOVILIDAD ELEVADOS';
  else if (Date.now() < net.barrierUntil) status.textContent = 'AEGIS WALL · REDUCCIÓN DE DAÑO ACTIVA';
  else if (Date.now() < net.boostUntil) status.textContent = 'VECTOR RUSH · MOVILIDAD DE ESCUADRÓN ACTIVA';
  else status.textContent = isBattleAuthority() ? 'HOST · DIFICULTAD ADAPTATIVA ACTIVA' : 'CLIENT · SINCRONIZADO CON AUTORIDAD';
}

function renderRecap() {
  const recap = ensureRecap();
  if (!recap) return;
  $('[data-v18-recap-team]', recap).textContent = teamScore().toLocaleString('es-MX');
  $('[data-v18-recap-pilots]', recap).textContent = String(Math.max(1, activePeers().length));
  $('[data-v18-recap-role]', recap).textContent = ROLES[net.role].name;
}

function syncPresence() {
  const state = net.channel?.presenceState?.() ?? {};
  const seen = new Set();
  for (const entries of Object.values(state)) {
    for (const entry of entries ?? []) {
      if (!entry?.playerId) continue;
      seen.add(entry.playerId);
      net.peers.set(entry.playerId, { ...(net.peers.get(entry.playerId) ?? {}), ...entry, lastSeen: Date.now() });
    }
  }
  for (const id of [...net.peers.keys()]) if (id !== net.playerId && !seen.has(id)) net.peers.delete(id);
  const local = currentPilotMeta();
  if (local) net.peers.set(net.playerId, { ...(net.peers.get(net.playerId) ?? {}), ...local, lastSeen: Date.now(), peakScore: Math.max(local.score, net.peers.get(net.playerId)?.peakScore || 0) });
  renderHud();
}

function receivePilotMeta(payload) {
  if (!payload?.playerId || payload.playerId === net.playerId) return;
  const role = ROLES[payload.role] ? payload.role : 'assault';
  const previous = net.peers.get(String(payload.playerId)) ?? {};
  const safe = {
    playerId: String(payload.playerId).slice(0, 80),
    callsign: String(payload.callsign || 'PILOTO').slice(0, 18),
    joinedAt: Number(payload.joinedAt) || previous.joinedAt || Date.now(),
    role,
    state: String(payload.state || 'idle').slice(0, 16),
    x: clamp(Number(payload.x) || 0, -40, 40),
    y: clamp(Number(payload.y) || 0, -30, 30),
    z: clamp(Number(payload.z) || 10, -30, 30),
    shield: clamp(Number(payload.shield) || 0, 0, 100),
    score: Math.max(0, Math.floor(Number(payload.score) || 0)),
    sector: clamp(Math.floor(Number(payload.sector) || 1), 1, 999),
    downed: Boolean(payload.downed),
    lastSeen: Date.now(),
  };
  safe.peakScore = Math.max(safe.score, Number(previous.peakScore) || 0);
  net.peers.set(safe.playerId, { ...previous, ...safe });
  teamScore();
  renderHud();
}

function receiveRoleChange(payload) {
  if (!payload?.playerId || !ROLES[payload.role]) return;
  const peer = net.peers.get(String(payload.playerId));
  if (peer) peer.role = payload.role;
  renderHud();
}

function rateAllowed(map, sender, windowMs) {
  const now = Date.now();
  const last = Number(map.get(sender) || 0);
  if (now - last < windowMs) return false;
  map.set(sender, now);
  return true;
}

function applyBarrier() {
  net.barrierUntil = Math.max(net.barrierUntil, Date.now() + 8000);
  const g = game();
  if (g?.shield != null) g.shield = Math.min(maxShield(), g.shield + maxShield() * 0.1);
  g?.callbacks?.onAnnounce?.('AEGIS WALL · BARRERA DE ESCUADRÓN');
  g?.callbacks?.onHud?.(g.snapshot?.());
}

function applyNanoWave() {
  const g = game();
  if (g?.state === 'playing' && g.shield != null) {
    g.shield = Math.min(maxShield(), g.shield + maxShield() * 0.25);
    g.callbacks?.onHud?.(g.snapshot?.());
  }
  g?.callbacks?.onAnnounce?.('NANO WAVE · REPARACIÓN DE FORMACIÓN');
}

function applyVectorRush() {
  net.boostUntil = Math.max(net.boostUntil, Date.now() + 9000);
  game()?.callbacks?.onAnnounce?.('VECTOR RUSH · VELOCIDAD DE ESCUADRÓN');
}

function applyFormationOverdrive() {
  net.overdriveUntil = Math.max(net.overdriveUntil, Date.now() + 10000);
  const g = game();
  g?.callbacks?.onAnnounce?.('FORMATION OVERDRIVE · SINERGIA MÁXIMA');
  navigator.vibrate?.([45, 35, 45, 35, 70]);
}

function applyBarrageHost(senderRole = 'assault') {
  if (!isBattleAuthority() || senderRole !== 'assault') return;
  const g = game();
  if (!g?.scene) return;
  const pilots = Math.max(1, activePeers().length);
  if (g.boss) {
    const damage = 4 + Math.min(4, pilots - 1);
    g.boss.userData.hp -= damage;
    g.createExplosion?.(g.boss.position.clone(), 0xf43f8e, 16);
    if (g.boss.userData.hp <= 0) g.defeatBoss?.();
    else g.callbacks?.onHud?.(g.snapshot?.());
    return;
  }
  const targets = (g.drones ?? []).slice(0, 5);
  for (const drone of targets) {
    drone.userData.hp -= 2;
    g.createExplosion?.(drone.position.clone(), 0xfb7185, 7);
  }
}

function receiveRolePower(payload) {
  if (!payload?.from || !payload?.kind || payload.from === net.playerId) return;
  const peer = net.peers.get(String(payload.from));
  if (!peer || !rateAllowed(net.abilityRate, String(payload.from), 18000)) return;
  const expected = { barrage: 'assault', aegis: 'vanguard', nano: 'support', vector: 'interceptor' }[payload.kind];
  if (expected !== peer.role) return;
  if (payload.kind === 'barrage') applyBarrageHost(peer.role);
  if (payload.kind === 'aegis') applyBarrier();
  if (payload.kind === 'nano') applyNanoWave();
  if (payload.kind === 'vector') applyVectorRush();
  renderHud();
}

function activateRolePower() {
  const g = game();
  if (!net.connected || g?.state !== 'playing' || Date.now() < net.nextPowerAt) return;
  net.nextPowerAt = Date.now() + POWER_COOLDOWN_MS;
  const kind = { assault: 'barrage', vanguard: 'aegis', support: 'nano', interceptor: 'vector' }[net.role];
  send('role_power', { from: net.playerId, kind, at: Date.now() });
  if (kind === 'barrage') applyBarrageHost(net.role);
  if (kind === 'aegis') applyBarrier();
  if (kind === 'nano') {
    applyNanoWave();
    const downed = activePeers().find((peer) => peer.playerId !== net.playerId && peer.downed);
    if (downed) sendReviveOffer(downed, true);
  }
  if (kind === 'vector') applyVectorRush();
  addTeamAction(5, 'power');
  renderHud();
}

function sendReviveOffer(target, remote = false) {
  if (!target || Date.now() < net.nextReviveAt) return;
  net.nextReviveAt = Date.now() + REVIVE_COOLDOWN_MS;
  const shield = net.role === 'support' ? 65 : 42;
  send('revive_offer', { from: net.playerId, to: target.playerId, callsign: net.callsign, shield, remote: Boolean(remote), at: Date.now(), expiresAt: Date.now() + 10000 });
}

function offerRevive() {
  const target = nearestDownedPeer();
  if (!target) return;
  sendReviveOffer(target, false);
  game()?.callbacks?.onAnnounce?.(`REANIMACIÓN ENVIADA · ${target.callsign}`);
}

function receiveReviveOffer(payload) {
  if (payload?.to !== net.playerId || game()?.state !== 'gameover') return;
  const expiresAt = Number(payload.expiresAt) || 0;
  if (expiresAt < Date.now()) return;
  net.reviveOffer = {
    from: String(payload.from || ''),
    callsign: String(payload.callsign || 'ALIADO').slice(0, 18),
    shield: clamp(Number(payload.shield) || 42, 20, 80),
    expiresAt,
  };
  const box = ensureReviveAccept();
  if (box) {
    box.classList.remove('hidden');
    $('[data-v18-revive-from]', box).textContent = `${net.reviveOffer.callsign} · ${Math.round(net.reviveOffer.shield)}% ESCUDO`;
  }
}

async function acceptRevive() {
  const offer = net.reviveOffer;
  const g = game();
  if (!offer || offer.expiresAt < Date.now() || g?.state !== 'gameover') return;
  net.reviveOffer = null;
  $('#v18-revive-offer')?.classList.add('hidden');
  try {
    await g.start?.();
    g.shield = maxShield() * (offer.shield / 100);
    g.callbacks?.onHud?.(g.snapshot?.());
    send('revive_confirm', { from: offer.from, target: net.playerId, at: Date.now() });
    g.callbacks?.onAnnounce?.('PILOTO REANIMADO · REGRESA A FORMACIÓN');
  } catch (error) {
    console.error('[WAE V18] Revive failed', error);
  }
}

function receiveReviveConfirm(payload) {
  if (!payload?.target || !rateAllowed(net.rescueRate, String(payload.target), 8000)) return;
  const peer = net.peers.get(String(payload.target));
  if (peer) peer.downed = false;
  if (isBattleAuthority()) addSynergyHost(20, 'revive');
  renderHud();
}

function addTeamAction(delta, kind = 'action') {
  if (isBattleAuthority()) addSynergyHost(delta, kind);
  else send('team_action', { from: net.playerId, delta, kind, at: Date.now() });
}

function receiveTeamAction(payload) {
  if (!isBattleAuthority() || !payload?.from || payload.from === net.playerId) return;
  const delta = clamp(Number(payload.delta) || 0, 0, 25);
  addSynergyHost(delta, String(payload.kind || 'action'));
}

function addSynergyHost(delta) {
  if (!isBattleAuthority()) return;
  net.synergy = clamp(net.synergy + delta, 0, 100);
  if (net.synergy >= 100) {
    net.synergy = 0;
    applyFormationOverdrive();
    send('formation_overdrive', { at: Date.now(), until: net.overdriveUntil });
  }
  send('formation_meter', { value: net.synergy, at: Date.now() });
  renderHud();
}

function receiveFormationMeter(payload) {
  if (isBattleAuthority()) return;
  net.synergy = clamp(Number(payload?.value) || 0, 0, 100);
  renderHud();
}

function receiveFormationOverdrive(payload) {
  if (isBattleAuthority()) return;
  net.overdriveUntil = Math.max(net.overdriveUntil, Number(payload?.until) || Date.now() + 10000);
  applyFormationOverdrive();
}

function installGameHooks() {
  const g = game();
  if (!g || net.original) return;
  net.original = {
    damageShip: g.damageShip?.bind(g),
    fire: g.fire?.bind(g),
    getShip: g.getShip?.bind(g),
    getMaxShield: g.getMaxShield?.bind(g),
    start: g.start?.bind(g),
    registerKill: g.registerKill?.bind(g),
    registerDroneKill: g.registerDroneKill?.bind(g),
    defeatBoss: g.defeatBoss?.bind(g),
  };

  if (net.original.getMaxShield) {
    g.getMaxShield = () => {
      const base = Math.max(1, Number(net.original.getMaxShield()) || 100);
      return Math.round(base * (net.role === 'vanguard' ? 1.18 : 1));
    };
  }

  if (net.original.getShip) {
    g.getShip = () => {
      const base = net.original.getShip();
      if (!base) return base;
      let speed = Number(base.speed) || 1;
      if (net.role === 'interceptor') speed *= 1.12;
      if (Date.now() < net.boostUntil) speed *= 1.12;
      if (Date.now() < net.overdriveUntil) speed *= 1.08;
      return { ...base, speed };
    };
  }

  if (net.original.damageShip) {
    g.damageShip = (damage, position) => {
      let factor = net.role === 'vanguard' ? 0.8 : net.role === 'support' ? 0.92 : 1;
      if (Date.now() < net.barrierUntil) factor *= 0.58;
      return net.original.damageShip(Math.max(1, Number(damage) * factor), position);
    };
  }

  if (net.original.fire) {
    g.fire = (...args) => {
      const before = g.lasers?.length ?? 0;
      const result = net.original.fire(...args);
      if ((g.lasers?.length ?? 0) > before) {
        if (net.role === 'assault') g.fireCooldown *= 0.84;
        if (Date.now() < net.overdriveUntil) g.fireCooldown *= 0.82;
      }
      return result;
    };
  }

  if (net.original.start) {
    g.start = async (...args) => {
      const result = await net.original.start(...args);
      if (net.role === 'vanguard') g.shield = g.getMaxShield?.() ?? g.shield;
      net.runStartedAt = Date.now();
      net.runRecorded = false;
      net.teamPeak = 0;
      net.lastScore = 0;
      return result;
    };
  }

  if (net.original.registerKill) {
    g.registerKill = (...args) => {
      const result = net.original.registerKill(...args);
      if (isBattleAuthority() && net.connected) addSynergyHost(5, 'kill');
      return result;
    };
  }

  if (net.original.registerDroneKill) {
    g.registerDroneKill = (...args) => {
      const result = net.original.registerDroneKill(...args);
      if (isBattleAuthority() && net.connected) addSynergyHost(8, 'drone');
      return result;
    };
  }

  if (net.original.defeatBoss) {
    g.defeatBoss = (...args) => {
      const result = net.original.defeatBoss(...args);
      if (isBattleAuthority() && net.connected) addSynergyHost(35, 'boss');
      return result;
    };
  }
}

function scaleSharedDifficulty() {
  if (!net.connected || !isBattleAuthority()) return;
  const g = game();
  if (!g || g.state !== 'playing') return;
  const count = clamp(activePeers().filter((peer) => !peer.downed).length || 1, 1, 4);
  const droneScale = 1 + (count - 1) * 0.34;
  const bossScale = 1 + (count - 1) * 0.62;

  for (const drone of g.drones ?? []) {
    if (!drone?.userData) continue;
    if (!drone.userData.v18BaseMaxHp) drone.userData.v18BaseMaxHp = Math.max(1, Number(drone.userData.miniMaxHp || drone.userData.hp) || 1);
    const previousMax = Math.max(1, Number(drone.userData.v18ScaledMaxHp || drone.userData.hp) || 1);
    const ratio = clamp((Number(drone.userData.hp) || 0) / previousMax, 0, 1);
    const nextMax = Math.max(1, Math.ceil(drone.userData.v18BaseMaxHp * droneScale));
    if (nextMax !== drone.userData.v18ScaledMaxHp) {
      drone.userData.v18ScaledMaxHp = nextMax;
      drone.userData.hp = Math.max(1, Math.ceil(nextMax * ratio));
      if (drone.userData.miniMaxHp) drone.userData.miniMaxHp = nextMax;
    }
  }

  if (g.boss?.userData) {
    const data = g.boss.userData;
    if (!data.v18BaseMaxHp) data.v18BaseMaxHp = Math.max(1, Number(data.maxHp) || 1);
    const previousMax = Math.max(1, Number(data.v18ScaledMaxHp || data.maxHp) || 1);
    const ratio = clamp((Number(data.hp) || 0) / previousMax, 0, 1);
    const nextMax = Math.max(1, Math.ceil(data.v18BaseMaxHp * bossScale));
    if (nextMax !== data.v18ScaledMaxHp) {
      data.v18ScaledMaxHp = nextMax;
      data.maxHp = nextMax;
      data.hp = Math.max(1, Math.ceil(nextMax * ratio));
      g.callbacks?.onHud?.(g.snapshot?.());
    }
  }

  if (!g.boss && count > 1 && Date.now() >= net.extraSpawnAt) {
    net.extraSpawnAt = Date.now() + Math.max(850, 1900 - count * 260);
    const target = 4 + (count - 1) * 2;
    if ((g.drones?.length ?? 0) < target && typeof g.spawnDrone === 'function') g.spawnDrone();
  }
}

function supportRegen() {
  if (net.role !== 'support' || game()?.state !== 'playing' || Date.now() - net.lastSupportRegen < 1200) return;
  net.lastSupportRegen = Date.now();
  const g = game();
  if (g?.shield == null) return;
  const cap = maxShield();
  if (g.shield < cap) {
    g.shield = Math.min(cap, g.shield + cap * 0.012);
    g.callbacks?.onHud?.(g.snapshot?.());
  }
}

function recordRunIfNeeded() {
  const g = game();
  if (!g) return;
  const state = g.state;
  if (state === 'playing' && net.lastState !== 'playing') {
    net.runStartedAt = Date.now();
    net.runRecorded = false;
  }
  if (state === 'gameover' && net.lastState !== 'gameover') {
    renderRecap();
    if (!net.runRecorded) {
      net.runRecorded = true;
      const entry = {
        at: Date.now(), room: net.room, role: net.role,
        score: Math.max(0, Math.floor(Number(g.score) || 0)),
        teamScore: teamScore(), sector: Math.max(1, Math.floor(Number(g.sector) || 1)),
        pilots: Math.max(1, activePeers().length), duration: Math.max(0, Date.now() - (net.runStartedAt || Date.now())),
      };
      try {
        const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        const next = [entry, ...(Array.isArray(history) ? history : [])].slice(0, 20);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {}
    }
  }
  net.lastState = state;
}

function tick() {
  installGameHooks();
  decorateLobby();
  const local = currentPilotMeta();
  if (net.connected && local) {
    const existing = net.peers.get(net.playerId) ?? {};
    local.peakScore = Math.max(local.score, Number(existing.peakScore) || 0);
    net.peers.set(net.playerId, { ...existing, ...local, lastSeen: Date.now() });
    send('pilot_meta', local);
  }
  supportRegen();
  scaleSharedDifficulty();
  recordRunIfNeeded();
  if (net.reviveOffer && net.reviveOffer.expiresAt < Date.now()) {
    net.reviveOffer = null;
    $('#v18-revive-offer')?.classList.add('hidden');
  }
  renderHud();
}

async function connectMeta(room) {
  if (net.connecting || (net.connected && net.room === room) || !ROOM_RE.test(room)) return;
  if (net.connected) await disconnectMeta();
  net.connecting = true;
  net.room = room;
  net.callsign = localStorage.getItem('wae_neon_rider_callsign') || net.callsign;
  try {
    const client = makeClient();
    const channel = client.channel(`wae-neon-squadmeta:${room}`, {
      config: { broadcast: { self: false, ack: false }, presence: { key: net.playerId } },
    });
    net.channel = channel;
    channel
      .on('presence', { event: 'sync' }, syncPresence)
      .on('presence', { event: 'join' }, syncPresence)
      .on('presence', { event: 'leave' }, syncPresence)
      .on('broadcast', { event: 'pilot_meta' }, ({ payload }) => receivePilotMeta(payload))
      .on('broadcast', { event: 'role_change' }, ({ payload }) => receiveRoleChange(payload))
      .on('broadcast', { event: 'role_power' }, ({ payload }) => receiveRolePower(payload))
      .on('broadcast', { event: 'revive_offer' }, ({ payload }) => receiveReviveOffer(payload))
      .on('broadcast', { event: 'revive_confirm' }, ({ payload }) => receiveReviveConfirm(payload))
      .on('broadcast', { event: 'team_action' }, ({ payload }) => receiveTeamAction(payload))
      .on('broadcast', { event: 'formation_meter' }, ({ payload }) => receiveFormationMeter(payload))
      .on('broadcast', { event: 'formation_overdrive' }, ({ payload }) => receiveFormationOverdrive(payload));

    await new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('SQUAD_META_TIMEOUT')), 9000);
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          window.clearTimeout(timeout);
          net.connected = true;
          net.connecting = false;
          net.joinedAt = Date.now();
          await channel.track(localPresence());
          syncPresence();
          installGameHooks();
          renderHud();
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          window.clearTimeout(timeout);
          reject(new Error(status));
        }
      });
    });
  } catch (error) {
    console.error('[WAE V18] Squad meta connection failed', error);
    net.connected = false;
    net.connecting = false;
    renderHud();
  }
}

async function disconnectMeta() {
  if (net.channel) {
    try { await net.channel.untrack(); } catch {}
    try { await net.client?.removeChannel(net.channel); } catch {}
  }
  net.channel = null;
  net.room = '';
  net.connected = false;
  net.connecting = false;
  net.peers.clear();
  net.synergy = 0;
  net.reviveOffer = null;
  renderHud();
}

function hashRoom(seed) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  let room = '';
  let value = hash >>> 0;
  for (let i = 0; i < 6; i += 1) {
    room += alphabet[value % alphabet.length];
    value = Math.imul(value ^ (value >>> 13), 1597334677) >>> 0;
  }
  return room;
}

function quickStatus(text, danger = false) {
  const node = $('[data-v16-status]');
  if (node) {
    node.textContent = text;
    node.classList.toggle('danger', danger);
  }
  let toast = $('#v18-match-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'v18-match-toast';
    toast.className = 'v18-match-toast';
    document.body.append(toast);
  }
  toast.textContent = text;
  toast.classList.toggle('danger', danger);
  toast.classList.add('show');
  window.clearTimeout(quickStatus.timer);
  quickStatus.timer = window.setTimeout(() => toast.classList.remove('show'), 4200);
}

async function joinMatchedRoom(room) {
  const url = new URL(location.href);
  url.searchParams.set('squad', room);
  history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  quickStatus(`MATCH ENCONTRADO · SALA ${room}`);
  $('[data-open-v16-squad]')?.click();

  const started = Date.now();
  await new Promise((resolve) => {
    const poll = window.setInterval(() => {
      const roomInput = $('[data-v16-room]');
      const join = $('[data-v16-join]');
      if (roomInput && join) {
        window.clearInterval(poll);
        roomInput.value = room;
        const callsign = $('[data-v16-callsign]');
        if (callsign && !callsign.value) callsign.value = net.callsign;
        join.click();
        resolve();
      } else if (Date.now() - started > 5000) {
        window.clearInterval(poll);
        resolve();
      }
    }, 120);
  });
}

async function closeQuickChannel() {
  if (!net.quickChannel) return;
  try { await net.quickChannel.untrack(); } catch {}
  try { await net.client?.removeChannel(net.quickChannel); } catch {}
  net.quickChannel = null;
}

export async function startQuickMatch() {
  if (net.quickChannel) return;
  decorateLobby();
  quickStatus('MATCHMAKING · BUSCANDO PILOTOS COMPATIBLES');
  const client = makeClient();
  const joinedAt = Date.now();
  const channel = client.channel('wae-neon-matchmaking:v18', {
    config: { broadcast: { self: false, ack: false }, presence: { key: net.playerId } },
  });
  net.quickChannel = channel;
  let matched = false;
  let offerTimer = 0;

  const candidates = () => {
    const state = channel.presenceState?.() ?? {};
    const list = [];
    for (const entries of Object.values(state)) {
      for (const entry of entries ?? []) {
        if (!entry?.playerId || !entry.seeking) continue;
        if (Date.now() - (Number(entry.joinedAt) || Date.now()) > 18000) continue;
        list.push(entry);
      }
    }
    return list.sort((a, b) => (Number(a.joinedAt) || 0) - (Number(b.joinedAt) || 0) || String(a.playerId).localeCompare(String(b.playerId)));
  };

  const maybeOffer = () => {
    if (matched) return;
    const list = candidates();
    if (!list.length || list[0].playerId !== net.playerId) return;
    window.clearTimeout(offerTimer);
    offerTimer = window.setTimeout(async () => {
      if (matched) return;
      const group = candidates().slice(0, 4);
      if (!group.length || group[0].playerId !== net.playerId) return;
      const memberIds = group.map((item) => String(item.playerId));
      const room = hashRoom(`${memberIds.join('|')}|${Math.floor(joinedAt / 15000)}`);
      channel.send({ type: 'broadcast', event: 'match_offer', payload: { room, members: memberIds, leader: net.playerId, at: Date.now() } }).catch(() => {});
      matched = true;
      await joinMatchedRoom(room);
      window.setTimeout(() => closeQuickChannel(), 1800);
    }, QUICKMATCH_WAIT_MS);
  };

  channel
    .on('presence', { event: 'sync' }, maybeOffer)
    .on('presence', { event: 'join' }, maybeOffer)
    .on('presence', { event: 'leave' }, maybeOffer)
    .on('broadcast', { event: 'match_offer' }, async ({ payload }) => {
      if (matched || !Array.isArray(payload?.members) || !payload.members.includes(net.playerId) || !ROOM_RE.test(String(payload.room || ''))) return;
      matched = true;
      await joinMatchedRoom(String(payload.room));
      window.setTimeout(() => closeQuickChannel(), 1800);
    });

  await new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('MATCHMAKING_SUBSCRIBE_TIMEOUT')), 8000);
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        window.clearTimeout(timeout);
        await channel.track({ playerId: net.playerId, callsign: net.callsign, role: net.role, joinedAt, seeking: true, version: 18 });
        maybeOffer();
        resolve();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        window.clearTimeout(timeout);
        reject(new Error(status));
      }
    });
  }).catch(async (error) => {
    console.error('[WAE V18] Matchmaking subscribe failed', error);
    quickStatus('MATCHMAKING NO DISPONIBLE · USA CÓDIGO PRIVADO', true);
    await closeQuickChannel();
  });

  window.setTimeout(async () => {
    if (matched || net.quickChannel !== channel) return;
    const list = candidates();
    if (list.length === 1 && list[0].playerId === net.playerId) quickStatus('SIN RIVALES EN COLA · CREANDO ESCUADRÓN ABIERTO');
    const room = hashRoom(`${net.playerId}|solo|${Math.floor(joinedAt / 15000)}`);
    matched = true;
    await joinMatchedRoom(room);
    window.setTimeout(() => closeQuickChannel(), 1800);
  }, QUICKMATCH_TIMEOUT_MS);
}

function watchRoom() {
  let last = '';
  window.clearInterval(net.watchTimer);
  net.watchTimer = window.setInterval(() => {
    decorateLobby();
    const room = roomFromUrl();
    if (room !== last) {
      last = room;
      if (ROOM_RE.test(room)) connectMeta(room);
      else if (net.connected || net.connecting) disconnectMeta();
    }
  }, WATCH_MS);
}

window.addEventListener('beforeunload', () => {
  net.channel?.untrack?.();
  net.quickChannel?.untrack?.();
});

document.addEventListener('click', (event) => {
  const role = event.target.closest('[data-v18-role]');
  if (role) setRole(role.dataset.v18Role);
});

ensureHud();
ensureReviveAccept();
ensureRecap();
installGameHooks();
decorateLobby();
watchRoom();
window.clearInterval(net.metaTimer);
net.metaTimer = window.setInterval(tick, META_MS);
const initialRoom = roomFromUrl();
if (ROOM_RE.test(initialRoom)) connectMeta(initialRoom);
