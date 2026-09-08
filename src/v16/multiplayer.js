import * as THREE from 'three';
import { createClient } from '@supabase/supabase-js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const ROOM_RE = /^[A-Z0-9]{4,8}$/;
const MAX_PLAYERS = 4;
const STATE_INTERVAL = 100;
const STALE_MS = 4500;

const env = {
  url: String(import.meta.env.VITE_WAE_SUPABASE_URL ?? '').replace(/\/$/, ''),
  key: String(import.meta.env.VITE_WAE_SUPABASE_PUBLISHABLE_KEY ?? ''),
};

const multiplayer = {
  client: null,
  channel: null,
  room: '',
  playerId: readOrCreateId(),
  callsign: localStorage.getItem('wae_neon_rider_callsign') || randomCallsign(),
  joinedAt: 0,
  connected: false,
  connecting: false,
  players: new Map(),
  remoteShips: new Map(),
  remoteShots: [],
  interval: 0,
  raf: 0,
  gameHooksInstalled: false,
};

function readOrCreateId() {
  let id = sessionStorage.getItem('wae_neon_rider_player_id');
  if (!id) {
    id = crypto.randomUUID?.() || `p-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
    sessionStorage.setItem('wae_neon_rider_player_id', id);
  }
  return id;
}

function randomCallsign() {
  const left = ['NOVA', 'VIPER', 'ECHO', 'HELIX', 'ORBIT', 'NEON', 'AEGIS', 'RAVEN'];
  const right = Math.floor(10 + Math.random() * 90);
  return `${left[Math.floor(Math.random() * left.length)]}-${right}`;
}

function generateRoom() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (const byte of bytes) code += alphabet[byte % alphabet.length];
  return code;
}

function normalizeRoom(value) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function game() {
  return window.__waeNeonRiderGame;
}

function ensureLobby() {
  let overlay = $('#v16-squad-overlay');
  if (overlay) return overlay;
  overlay = document.createElement('section');
  overlay.id = 'v16-squad-overlay';
  overlay.className = 'v16-squad-overlay hidden';
  overlay.innerHTML = `
    <div class="v16-squad-panel" role="dialog" aria-modal="true" aria-label="Escuadrón multijugador">
      <button class="v16-squad-close" type="button" data-v16-close aria-label="Cerrar">×</button>
      <header class="v16-squad-head">
        <span>WAE REALTIME CO-OP</span>
        <h2>ESCUADRÓN ONLINE</h2>
        <p>Forma una escuadra de hasta ${MAX_PLAYERS} pilotos. Cada jugador usa su propio dispositivo y aparece en tiempo real dentro de la formación.</p>
      </header>
      <section class="v16-squad-connect" data-v16-connect-view>
        <label>INDICATIVO<input data-v16-callsign maxlength="18" autocomplete="nickname"></label>
        <label>CÓDIGO DE SALA<input data-v16-room maxlength="8" inputmode="text" autocomplete="off" placeholder="ABC123"></label>
        <div class="v16-squad-actions">
          <button type="button" class="v16-primary" data-v16-create>CREAR ESCUADRÓN</button>
          <button type="button" data-v16-join>UNIRME</button>
        </div>
        <small data-v16-status>Realtime listo para crear una sala privada por código.</small>
      </section>
      <section class="v16-squad-room hidden" data-v16-room-view>
        <div class="v16-room-code"><span>SALA</span><strong data-v16-room-code>------</strong><button type="button" data-v16-copy>COMPARTIR INVITACIÓN</button></div>
        <div class="v16-squad-metrics"><div><span>PILOTOS</span><strong data-v16-count>1 / ${MAX_PLAYERS}</strong></div><div><span>PUNTUACIÓN DE ESCUADRÓN</span><strong data-v16-team-score>0</strong></div><div><span>LÍDER</span><strong data-v16-leader>—</strong></div></div>
        <div class="v16-roster" data-v16-roster></div>
        <div class="v16-room-actions"><button type="button" class="v16-primary" data-v16-launch>LANZAR ESCUADRÓN</button><button type="button" data-v16-leave>SALIR DE SALA</button></div>
        <small data-v16-live-status>Conectando con WAE Realtime…</small>
      </section>
    </div>`;
  document.body.append(overlay);

  overlay.addEventListener('click', async (event) => {
    if (event.target === overlay || event.target.closest('[data-v16-close]')) closeLobby();
    if (event.target.closest('[data-v16-create]')) {
      const callsign = readCallsign(overlay);
      if (!callsign) return;
      const code = generateRoom();
      $('[data-v16-room]', overlay).value = code;
      await connect(code, callsign);
    }
    if (event.target.closest('[data-v16-join]')) {
      const callsign = readCallsign(overlay);
      const code = normalizeRoom($('[data-v16-room]', overlay).value);
      if (!callsign || !ROOM_RE.test(code)) {
        setStatus('Escribe un código de sala válido de 4 a 8 caracteres.', true);
        return;
      }
      await connect(code, callsign);
    }
    if (event.target.closest('[data-v16-copy]')) await copyInvite();
    if (event.target.closest('[data-v16-leave]')) await leaveRoom();
    if (event.target.closest('[data-v16-launch]')) launchSquad(true);
  });
  return overlay;
}

function readCallsign(root) {
  const input = $('[data-v16-callsign]', root);
  const value = String(input.value ?? '').trim().replace(/[^\p{L}\p{N}_\- ]/gu, '').slice(0, 18);
  if (!value) {
    setStatus('Escribe un indicativo para que tu equipo te identifique.', true);
    input.focus();
    return '';
  }
  multiplayer.callsign = value;
  localStorage.setItem('wae_neon_rider_callsign', value);
  return value;
}

function setStatus(message, danger = false) {
  const overlay = ensureLobby();
  const nodes = [$('[data-v16-status]', overlay), $('[data-v16-live-status]', overlay)].filter(Boolean);
  for (const node of nodes) {
    node.textContent = message;
    node.classList.toggle('danger', danger);
  }
}

function showRoomView(connected) {
  const overlay = ensureLobby();
  $('[data-v16-connect-view]', overlay).classList.toggle('hidden', connected);
  $('[data-v16-room-view]', overlay).classList.toggle('hidden', !connected);
}

export function openSquadLobby(room = '') {
  const overlay = ensureLobby();
  overlay.classList.remove('hidden');
  document.body.classList.add('v16-lobby-open');
  $('[data-v16-callsign]', overlay).value = multiplayer.callsign;
  const code = normalizeRoom(room);
  if (code) $('[data-v16-room]', overlay).value = code;
  showRoomView(multiplayer.connected);
  renderLobby();
}

function closeLobby() {
  $('#v16-squad-overlay')?.classList.add('hidden');
  document.body.classList.remove('v16-lobby-open');
}

function createSupabaseClient() {
  if (!env.url || !env.key) throw new Error('REALTIME_BACKEND_NOT_CONFIGURED');
  if (!multiplayer.client) {
    multiplayer.client = createClient(env.url, env.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 20 } },
    });
  }
  return multiplayer.client;
}

async function connect(room, callsign) {
  if (multiplayer.connecting) return;
  if (multiplayer.connected && multiplayer.room === room) return;
  multiplayer.connecting = true;
  setStatus('ENLAZANDO CANAL REALTIME…');
  if (multiplayer.connected) await leaveRoom();

  try {
    const supabase = createSupabaseClient();
    multiplayer.room = room;
    multiplayer.callsign = callsign;
    multiplayer.joinedAt = Date.now();
    const channel = supabase.channel(`wae-neon-squad:${room}`, {
      config: {
        broadcast: { self: false, ack: false },
        presence: { key: multiplayer.playerId },
      },
    });
    multiplayer.channel = channel;

    channel
      .on('presence', { event: 'sync' }, syncPresence)
      .on('presence', { event: 'join' }, syncPresence)
      .on('presence', { event: 'leave' }, syncPresence)
      .on('broadcast', { event: 'player_state' }, ({ payload }) => receivePlayerState(payload))
      .on('broadcast', { event: 'fire' }, ({ payload }) => receiveFire(payload))
      .on('broadcast', { event: 'ability' }, ({ payload }) => receiveAbility(payload))
      .on('broadcast', { event: 'launch' }, ({ payload }) => receiveLaunch(payload));

    await new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('REALTIME_TIMEOUT')), 9000);
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          window.clearTimeout(timeout);
          multiplayer.connected = true;
          multiplayer.connecting = false;
          await channel.track(localPresence());
          startSyncLoop();
          installGameHooks();
          updateInviteUrl();
          showRoomView(true);
          setStatus('ESCUADRÓN ONLINE · SINCRONIZACIÓN ACTIVA');
          renderLobby();
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          window.clearTimeout(timeout);
          reject(new Error(status));
        }
      });
    });
  } catch (error) {
    multiplayer.connecting = false;
    multiplayer.connected = false;
    console.error('[WAE V16] Realtime connection failed', error);
    setStatus('No se pudo abrir la sala en tiempo real. Revisa conexión e inténtalo nuevamente.', true);
    showRoomView(false);
  }
}

function localPresence() {
  return {
    playerId: multiplayer.playerId,
    callsign: multiplayer.callsign,
    joinedAt: multiplayer.joinedAt,
    version: 16,
  };
}

function syncPresence() {
  const state = multiplayer.channel?.presenceState?.() ?? {};
  const seen = new Set();
  for (const entries of Object.values(state)) {
    for (const entry of entries ?? []) {
      if (!entry?.playerId) continue;
      seen.add(entry.playerId);
      const existing = multiplayer.players.get(entry.playerId) ?? {};
      multiplayer.players.set(entry.playerId, { ...existing, ...entry, lastSeen: Date.now() });
    }
  }
  for (const id of [...multiplayer.players.keys()]) {
    if (id !== multiplayer.playerId && !seen.has(id)) removeRemotePlayer(id);
  }
  if (!multiplayer.players.has(multiplayer.playerId)) multiplayer.players.set(multiplayer.playerId, { ...localPresence(), lastSeen: Date.now(), score: currentScore(), shield: currentShield() });
  renderLobby();
}

function currentScore() {
  return Number(game()?.score ?? 0) || 0;
}

function currentShield() {
  const snapshot = game()?.snapshot?.();
  return clamp(Number(snapshot?.shield ?? 100) || 0, 0, 100);
}

function localState() {
  const g = game();
  if (!g?.ship) return null;
  const snapshot = g.snapshot?.() ?? {};
  return {
    playerId: multiplayer.playerId,
    callsign: multiplayer.callsign,
    t: Date.now(),
    state: g.state,
    x: Number(g.ship.position.x.toFixed(3)),
    y: Number(g.ship.position.y.toFixed(3)),
    z: Number(g.ship.position.z.toFixed(3)),
    rx: Number(g.ship.rotation.x.toFixed(3)),
    ry: Number(g.ship.rotation.y.toFixed(3)),
    rz: Number(g.ship.rotation.z.toFixed(3)),
    score: Number(g.score ?? 0) || 0,
    shield: clamp(Number(snapshot.shield ?? 100) || 0, 0, 100),
    sector: Number(snapshot.sector ?? g.sector ?? 1) || 1,
    shipSku: localStorage.getItem('wae_neon_rider_v12_ship_sku') || '',
  };
}

function startSyncLoop() {
  window.clearInterval(multiplayer.interval);
  multiplayer.interval = window.setInterval(() => {
    if (!multiplayer.connected || !multiplayer.channel) return;
    const payload = localState();
    if (!payload) return;
    multiplayer.players.set(multiplayer.playerId, { ...(multiplayer.players.get(multiplayer.playerId) ?? localPresence()), ...payload, lastSeen: Date.now() });
    multiplayer.channel.send({ type: 'broadcast', event: 'player_state', payload }).catch(() => {});
    renderSquadHud();
  }, STATE_INTERVAL);
  if (!multiplayer.raf) multiplayer.raf = requestAnimationFrame(animateRemotePlayers);
}

function receivePlayerState(payload) {
  if (!payload?.playerId || payload.playerId === multiplayer.playerId || typeof payload.x !== 'number' || typeof payload.y !== 'number') return;
  const safe = {
    playerId: String(payload.playerId),
    callsign: String(payload.callsign || 'PILOTO').slice(0, 18),
    t: Number(payload.t) || Date.now(),
    state: String(payload.state || 'idle').slice(0, 16),
    x: clamp(Number(payload.x) || 0, -40, 40),
    y: clamp(Number(payload.y) || 0, -30, 30),
    z: clamp(Number(payload.z) || 6, -20, 20),
    rx: clamp(Number(payload.rx) || 0, -Math.PI * 2, Math.PI * 2),
    ry: clamp(Number(payload.ry) || 0, -Math.PI * 2, Math.PI * 2),
    rz: clamp(Number(payload.rz) || 0, -Math.PI * 2, Math.PI * 2),
    score: Math.max(0, Math.floor(Number(payload.score) || 0)),
    shield: clamp(Number(payload.shield) || 0, 0, 100),
    sector: clamp(Math.floor(Number(payload.sector) || 1), 1, 999),
    shipSku: String(payload.shipSku || '').slice(0, 40),
    lastSeen: Date.now(),
  };
  multiplayer.players.set(safe.playerId, { ...(multiplayer.players.get(safe.playerId) ?? {}), ...safe });
  ensureRemoteShip(safe.playerId);
  renderLobby();
  renderSquadHud();
}

function playerColor(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  const hue = ((Math.abs(hash) % 320) + 20) / 360;
  return new THREE.Color().setHSL(hue, 0.82, 0.62);
}

function ensureRemoteShip(id) {
  if (multiplayer.remoteShips.has(id)) return multiplayer.remoteShips.get(id);
  const g = game();
  if (!g?.scene) return null;
  const color = playerColor(id);
  const group = new THREE.Group();
  group.name = `WAE_REMOTE_${id}`;
  const metal = new THREE.MeshStandardMaterial({ color: 0x111827, emissive: color, emissiveIntensity: 0.36, metalness: 0.78, roughness: 0.25, transparent: true, opacity: 0.82 });
  const glow = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.82 });
  const bodyGeometry = new THREE.ConeGeometry(0.72, 3.3, 6);
  bodyGeometry.rotateX(Math.PI / 2);
  const body = new THREE.Mesh(bodyGeometry, metal);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.11, 1.15), metal.clone());
  wing.position.z = 0.42;
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 0), glow);
  core.position.set(0, 0.42, -0.18);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.035, 6, 26), glow.clone());
  ring.rotation.x = Math.PI / 2;
  ring.position.z = 1.1;
  const light = new THREE.PointLight(color, 2.2, 7, 2);
  light.position.z = 1.4;
  group.add(body, wing, core, ring, light);
  group.scale.setScalar(0.9);
  group.userData.target = new THREE.Vector3();
  group.userData.targetRotation = new THREE.Euler();
  g.scene.add(group);
  multiplayer.remoteShips.set(id, group);
  return group;
}

function animateRemotePlayers() {
  const now = Date.now();
  for (const [id, group] of multiplayer.remoteShips.entries()) {
    const player = multiplayer.players.get(id);
    if (!player || now - (player.lastSeen ?? 0) > STALE_MS) {
      removeRemotePlayer(id);
      continue;
    }
    group.userData.target.set(player.x ?? 0, player.y ?? 0, player.z ?? 6);
    group.position.lerp(group.userData.target, 0.24);
    group.rotation.x += ((player.rx ?? 0) - group.rotation.x) * 0.18;
    group.rotation.y += ((player.ry ?? 0) - group.rotation.y) * 0.18;
    group.rotation.z += ((player.rz ?? 0) - group.rotation.z) * 0.18;
    group.visible = player.state === 'playing' || player.state === 'paused';
    const ring = group.children.find((child) => child.geometry?.type === 'TorusGeometry');
    if (ring) ring.rotation.z += 0.035;
  }

  for (let i = multiplayer.remoteShots.length - 1; i >= 0; i -= 1) {
    const shot = multiplayer.remoteShots[i];
    shot.life -= 1 / 60;
    shot.mesh.position.z -= 1.15;
    if (shot.life <= 0 || shot.mesh.position.z < -90) {
      game()?.scene?.remove(shot.mesh);
      shot.mesh.geometry?.dispose?.();
      shot.mesh.material?.dispose?.();
      multiplayer.remoteShots.splice(i, 1);
    }
  }
  multiplayer.raf = requestAnimationFrame(animateRemotePlayers);
}

function receiveFire(payload) {
  if (!payload?.playerId || payload.playerId === multiplayer.playerId) return;
  const g = game();
  if (!g?.scene) return;
  const color = playerColor(String(payload.playerId));
  for (const offset of [-0.8, 0.8]) {
    const geometry = new THREE.CylinderGeometry(0.055, 0.055, 1.8, 6);
    geometry.rotateX(Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.82 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(clamp(Number(payload.x) || 0, -40, 40) + offset, clamp(Number(payload.y) || 0, -30, 30), clamp(Number(payload.z) || 6, -20, 20) - 1.1);
    g.scene.add(mesh);
    multiplayer.remoteShots.push({ mesh, life: 0.9 });
  }
}

function receiveAbility(payload) {
  if (!payload?.playerId || payload.playerId === multiplayer.playerId) return;
  const group = multiplayer.remoteShips.get(payload.playerId);
  const g = game();
  if (!group || !g?.scene) return;
  const color = playerColor(String(payload.playerId));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(payload.kind === 'missile' ? 1.8 : 2.8, 0.08, 8, 34), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72, depthWrite: false }));
  ring.rotation.x = Math.PI / 2;
  ring.position.copy(group.position);
  g.scene.add(ring);
  let life = 0.55;
  const animate = () => {
    life -= 1 / 60;
    ring.scale.multiplyScalar(1.035);
    ring.material.opacity = Math.max(0, life / 0.55 * 0.72);
    if (life <= 0) {
      g.scene.remove(ring);
      ring.geometry.dispose();
      ring.material.dispose();
    } else requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}

function installGameHooks() {
  const g = game();
  if (!g || multiplayer.gameHooksInstalled) return;
  multiplayer.gameHooksInstalled = true;
  const baseFire = g.fire.bind(g);
  g.fire = (...args) => {
    const before = g.lasers?.length ?? 0;
    const result = baseFire(...args);
    if ((g.lasers?.length ?? 0) > before && multiplayer.connected) sendBroadcast('fire', { playerId: multiplayer.playerId, x: g.ship.position.x, y: g.ship.position.y, z: g.ship.position.z });
    return result;
  };
  for (const [method, kind] of [['activateSecondary', 'nova'], ['activateDash', 'dash'], ['activateMissile', 'missile']]) {
    if (typeof g[method] !== 'function') continue;
    const base = g[method].bind(g);
    g[method] = (...args) => {
      const result = base(...args);
      if (result && multiplayer.connected) sendBroadcast('ability', { playerId: multiplayer.playerId, kind });
      return result;
    };
  }
}

function sendBroadcast(event, payload) {
  multiplayer.channel?.send({ type: 'broadcast', event, payload }).catch(() => {});
}

function leader() {
  const players = [...multiplayer.players.values()].filter((player) => player.playerId);
  players.sort((a, b) => (a.joinedAt ?? Number.MAX_SAFE_INTEGER) - (b.joinedAt ?? Number.MAX_SAFE_INTEGER) || String(a.playerId).localeCompare(String(b.playerId)));
  return players[0] ?? null;
}

function launchSquad(emit) {
  const currentLeader = leader();
  if (currentLeader?.playerId !== multiplayer.playerId) {
    setStatus(`Solo ${currentLeader?.callsign ?? 'el líder'} puede lanzar la formación.`, true);
    return;
  }
  if (emit) sendBroadcast('launch', { playerId: multiplayer.playerId, at: Date.now() + 350 });
  closeLobby();
  const g = game();
  if (g?.state === 'idle' || g?.state === 'gameover') window.setTimeout(() => $('#start-btn')?.click(), emit ? 350 : 0);
}

function receiveLaunch(payload) {
  const currentLeader = leader();
  if (!payload?.playerId || payload.playerId !== currentLeader?.playerId) return;
  const delay = clamp((Number(payload.at) || Date.now()) - Date.now(), 0, 1200);
  closeLobby();
  const g = game();
  if (g?.state === 'idle' || g?.state === 'gameover') window.setTimeout(() => $('#start-btn')?.click(), delay);
}

function teamScore() {
  let total = 0;
  for (const player of multiplayer.players.values()) total += Math.max(0, Number(player.score) || 0);
  return Math.floor(total);
}

function renderLobby() {
  const overlay = $('#v16-squad-overlay');
  if (!overlay) return;
  if (multiplayer.connected) {
    $('[data-v16-room-code]', overlay).textContent = multiplayer.room;
    const players = [...multiplayer.players.values()].filter((player) => player.playerId).sort((a, b) => (a.joinedAt ?? 0) - (b.joinedAt ?? 0)).slice(0, MAX_PLAYERS + 2);
    $('[data-v16-count]', overlay).textContent = `${Math.min(players.length, MAX_PLAYERS)} / ${MAX_PLAYERS}`;
    $('[data-v16-team-score]', overlay).textContent = teamScore().toLocaleString('es-MX');
    const currentLeader = leader();
    $('[data-v16-leader]', overlay).textContent = currentLeader?.callsign ?? '—';
    $('[data-v16-launch]', overlay).disabled = currentLeader?.playerId !== multiplayer.playerId;
    $('[data-v16-launch]', overlay).textContent = currentLeader?.playerId === multiplayer.playerId ? 'LANZAR ESCUADRÓN' : 'ESPERANDO AL LÍDER';
    $('[data-v16-roster]', overlay).replaceChildren(...players.map((player) => rosterNode(player, currentLeader?.playerId)));
    if (players.length > MAX_PLAYERS) setStatus('La sala superó el límite recomendado de 4 pilotos. Crea otra sala para mantener baja latencia.', true);
  }
  renderSquadHud();
}

function rosterNode(player, leaderId) {
  const node = document.createElement('article');
  node.className = 'v16-roster-player';
  node.innerHTML = '<i></i><div><strong></strong><span></span></div><b></b>';
  node.querySelector('strong').textContent = player.callsign || 'PILOTO';
  node.querySelector('span').textContent = player.playerId === multiplayer.playerId ? 'ESTE DISPOSITIVO' : `SECTOR ${player.sector ?? 1} · ESC ${Math.round(player.shield ?? 100)}%`;
  node.querySelector('b').textContent = player.playerId === leaderId ? 'LÍDER' : 'ONLINE';
  const color = playerColor(String(player.playerId));
  node.style.setProperty('--pilot-color', `#${color.getHexString()}`);
  return node;
}

function ensureSquadHud() {
  let hud = $('#v16-squad-hud');
  if (hud) return hud;
  hud = document.createElement('aside');
  hud.id = 'v16-squad-hud';
  hud.className = 'v16-squad-hud hidden';
  hud.innerHTML = '<div><span>SQUAD</span><strong data-v16-hud-room>------</strong></div><div><span>EQUIPO</span><strong data-v16-hud-count>1/4</strong></div><div><span>SCORE</span><strong data-v16-hud-score>0</strong></div>';
  $('#app')?.append(hud);
  return hud;
}

function renderSquadHud() {
  const hud = ensureSquadHud();
  hud.classList.toggle('hidden', !multiplayer.connected);
  if (!multiplayer.connected) return;
  $('[data-v16-hud-room]', hud).textContent = multiplayer.room;
  $('[data-v16-hud-count]', hud).textContent = `${Math.min(multiplayer.players.size, MAX_PLAYERS)}/${MAX_PLAYERS}`;
  $('[data-v16-hud-score]', hud).textContent = teamScore().toLocaleString('es-MX');
}

async function copyInvite() {
  const url = new URL(window.location.href);
  url.searchParams.set('squad', multiplayer.room);
  url.hash = '';
  try {
    await navigator.clipboard.writeText(url.toString());
    setStatus('INVITACIÓN COPIADA · ENVÍALA AL EQUIPO');
  } catch {
    setStatus(`CÓDIGO DE SALA: ${multiplayer.room}`);
  }
}

function updateInviteUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set('squad', multiplayer.room);
  history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function clearInviteUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('squad');
  history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function removeRemotePlayer(id) {
  multiplayer.players.delete(id);
  const ship = multiplayer.remoteShips.get(id);
  if (ship) {
    game()?.scene?.remove(ship);
    ship.traverse?.((child) => {
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose?.());
      else child.material?.dispose?.();
    });
    multiplayer.remoteShips.delete(id);
  }
}

async function leaveRoom() {
  window.clearInterval(multiplayer.interval);
  multiplayer.interval = 0;
  if (multiplayer.channel) {
    try { await multiplayer.channel.untrack(); } catch {}
    try { await multiplayer.client?.removeChannel(multiplayer.channel); } catch {}
  }
  multiplayer.channel = null;
  multiplayer.room = '';
  multiplayer.connected = false;
  multiplayer.connecting = false;
  for (const id of [...multiplayer.remoteShips.keys()]) removeRemotePlayer(id);
  multiplayer.players.clear();
  clearInviteUrl();
  showRoomView(false);
  renderSquadHud();
  setStatus('Desconectado. Puedes crear o unirte a otro escuadrón.');
}

window.addEventListener('beforeunload', () => {
  if (multiplayer.channel) multiplayer.channel.untrack?.();
});

ensureSquadHud();
