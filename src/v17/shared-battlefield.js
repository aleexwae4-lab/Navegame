import * as THREE from 'three';
import { createClient } from '@supabase/supabase-js';
import { CONFIG as COMBAT_CONFIG } from '../v4/config.js';

const $ = (selector, root = document) => root.querySelector(selector);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const SNAPSHOT_MS = 80;
const PILOT_MS = 100;
const PING_MS = 2200;
const STALE_MS = 3200;
const ROOM_RE = /^[A-Z0-9]{4,8}$/;

const env = {
  url: String(import.meta.env.VITE_WAE_SUPABASE_URL ?? '').replace(/\/$/, ''),
  key: String(import.meta.env.VITE_WAE_SUPABASE_PUBLISHABLE_KEY ?? ''),
};

const battle = {
  client: null,
  channel: null,
  room: '',
  playerId: sessionStorage.getItem('wae_neon_rider_player_id') || crypto.randomUUID?.() || `p-${Math.random().toString(36).slice(2)}`,
  callsign: localStorage.getItem('wae_neon_rider_callsign') || 'PILOTO',
  joinedAt: Number(sessionStorage.getItem('wae_v17_joined_at')) || Date.now(),
  connected: false,
  connecting: false,
  peers: new Map(),
  authorityId: '',
  isAuthority: false,
  originals: null,
  shadows: new Map(),
  root: null,
  latest: null,
  tick: 0,
  snapshotTimer: 0,
  pilotTimer: 0,
  pingTimer: 0,
  raf: 0,
  ping: 0,
  pendingPings: new Map(),
  consumed: new Set(),
  hitRate: new Map(),
  lastSector: 0,
  takeoverPending: false,
};

sessionStorage.setItem('wae_neon_rider_player_id', battle.playerId);
sessionStorage.setItem('wae_v17_joined_at', String(battle.joinedAt));

function game() {
  return window.__waeNeonRiderGame;
}

function roomFromUrl() {
  return String(new URLSearchParams(location.search).get('squad') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function v16LeaderCallsign() {
  const value = $('[data-v16-leader]')?.textContent?.trim();
  return value && value !== '—' ? value : '';
}

function authorityPeer() {
  const peers = [...battle.peers.values()].filter((item) => item?.playerId);
  const leaderName = v16LeaderCallsign();
  if (leaderName) {
    const byName = peers.find((item) => item.callsign === leaderName);
    if (byName) return byName;
  }
  peers.sort((a, b) => (a.joinedAt ?? Number.MAX_SAFE_INTEGER) - (b.joinedAt ?? Number.MAX_SAFE_INTEGER) || String(a.playerId).localeCompare(String(b.playerId)));
  return peers[0] ?? null;
}

function localPresence() {
  const g = game();
  return {
    playerId: battle.playerId,
    callsign: battle.callsign,
    joinedAt: battle.joinedAt,
    version: 17,
    state: g?.state || 'idle',
  };
}

function localPilotState() {
  const g = game();
  if (!g?.ship) return null;
  const snap = g.snapshot?.() ?? {};
  return {
    playerId: battle.playerId,
    callsign: battle.callsign,
    t: Date.now(),
    state: g.state,
    x: Number(g.ship.position.x.toFixed(3)),
    y: Number(g.ship.position.y.toFixed(3)),
    z: Number(g.ship.position.z.toFixed(3)),
    shield: clamp(Number(snap.shield ?? 100) || 0, 0, 100),
    sector: clamp(Math.floor(Number(snap.sector ?? g.sector ?? 1) || 1), 1, 999),
  };
}

function ensureHud() {
  let hud = $('#v17-shared-hud');
  if (hud) return hud;
  hud = document.createElement('aside');
  hud.id = 'v17-shared-hud';
  hud.className = 'v17-shared-hud hidden';
  hud.innerHTML = `
    <div class="v17-shared-hud__top">
      <span class="v17-live-dot"></span>
      <strong>SHARED BATTLEFIELD</strong>
      <b data-v17-role>SYNC</b>
    </div>
    <div class="v17-shared-hud__grid">
      <div><span>SECTOR</span><strong data-v17-sector>1</strong></div>
      <div><span>LINK</span><strong data-v17-link>—</strong></div>
      <div><span>AUTORIDAD</span><strong data-v17-authority>—</strong></div>
      <div><span>OBJETIVO</span><strong data-v17-objective>FORMACIÓN</strong></div>
    </div>
    <div class="v17-boss hidden" data-v17-boss>
      <div><span data-v17-boss-name>GUARDIÁN</span><strong data-v17-boss-value>100%</strong></div>
      <i><b data-v17-boss-fill></b></i>
    </div>
    <small data-v17-status>Esperando enlace de batalla…</small>`;
  $('#app')?.append(hud);
  return hud;
}

function setStatus(text, danger = false) {
  const hud = ensureHud();
  const node = $('[data-v17-status]', hud);
  if (node) {
    node.textContent = text;
    node.classList.toggle('danger', danger);
  }
}

function networkQuality() {
  if (!battle.connected) return 'OFFLINE';
  if (battle.isAuthority) return 'HOST';
  if (!battle.ping) return 'SYNC';
  if (battle.ping < 80) return `${battle.ping}ms · ELITE`;
  if (battle.ping < 150) return `${battle.ping}ms · ÓPTIMO`;
  if (battle.ping < 260) return `${battle.ping}ms · ESTABLE`;
  return `${battle.ping}ms · ALTO`;
}

function renderHud() {
  const hud = ensureHud();
  hud.classList.toggle('hidden', !battle.connected);
  if (!battle.connected) return;
  const authority = battle.peers.get(battle.authorityId);
  const snapshot = battle.latest;
  $('[data-v17-role]', hud).textContent = battle.isAuthority ? 'HOST AUTHORITY' : 'CLIENT SYNC';
  $('[data-v17-link]', hud).textContent = networkQuality();
  $('[data-v17-authority]', hud).textContent = authority?.callsign || (battle.isAuthority ? battle.callsign : '—');
  $('[data-v17-sector]', hud).textContent = String(snapshot?.sector ?? game()?.sector ?? 1);
  const mission = snapshot?.mission;
  const objective = snapshot?.objective;
  $('[data-v17-objective]', hud).textContent = String(objective?.name || mission?.title || 'FORMACIÓN').slice(0, 28);
  const boss = snapshot?.boss;
  const bossPanel = $('[data-v17-boss]', hud);
  bossPanel.classList.toggle('hidden', !boss);
  if (boss) {
    const hp = Math.max(0, Number(boss.hp) || 0);
    const maxHp = Math.max(1, Number(boss.maxHp) || 1);
    const percent = clamp((hp / maxHp) * 100, 0, 100);
    $('[data-v17-boss-name]', hud).textContent = String(boss.name || 'GUARDIÁN COMPARTIDO').slice(0, 28);
    $('[data-v17-boss-value]', hud).textContent = `${Math.round(percent)}%`;
    $('[data-v17-boss-fill]', hud).style.width = `${percent}%`;
  }
}

function makeClient() {
  if (!env.url || !env.key) throw new Error('REALTIME_BACKEND_NOT_CONFIGURED');
  if (!battle.client) {
    battle.client = createClient(env.url, env.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 40 } },
    });
  }
  return battle.client;
}

function broadcast(event, payload) {
  battle.channel?.send({ type: 'broadcast', event, payload }).catch(() => {});
}

async function connectBattle(room) {
  if (battle.connecting || (battle.connected && battle.room === room)) return;
  if (!ROOM_RE.test(room)) return;
  if (battle.connected) await disconnectBattle();
  battle.connecting = true;
  battle.room = room;
  battle.callsign = localStorage.getItem('wae_neon_rider_callsign') || battle.callsign;
  setStatus('NEGOCIANDO AUTORIDAD DE CAMPO…');

  try {
    const supabase = makeClient();
    const channel = supabase.channel(`wae-neon-battle:${room}`, {
      config: {
        broadcast: { self: false, ack: false },
        presence: { key: battle.playerId },
      },
    });
    battle.channel = channel;
    channel
      .on('presence', { event: 'sync' }, syncPresence)
      .on('presence', { event: 'join' }, syncPresence)
      .on('presence', { event: 'leave' }, syncPresence)
      .on('broadcast', { event: 'pilot_state' }, ({ payload }) => receivePilot(payload))
      .on('broadcast', { event: 'world_snapshot' }, ({ payload }) => receiveSnapshot(payload))
      .on('broadcast', { event: 'hit_intent' }, ({ payload }) => receiveHitIntent(payload))
      .on('broadcast', { event: 'collision_intent' }, ({ payload }) => receiveCollisionIntent(payload))
      .on('broadcast', { event: 'ping' }, ({ payload }) => receivePing(payload))
      .on('broadcast', { event: 'pong' }, ({ payload }) => receivePong(payload))
      .on('broadcast', { event: 'authority_notice' }, ({ payload }) => receiveAuthorityNotice(payload));

    await new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('BATTLEFIELD_TIMEOUT')), 9000);
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          window.clearTimeout(timeout);
          battle.connected = true;
          battle.connecting = false;
          await channel.track(localPresence());
          startLoops();
          syncPresence();
          ensureBattleHooks();
          setStatus('CAMPO COMPARTIDO · SINCRONIZACIÓN ACTIVA');
          renderHud();
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          window.clearTimeout(timeout);
          reject(new Error(status));
        }
      });
    });
  } catch (error) {
    console.error('[WAE V17] Shared battlefield connection failed', error);
    battle.connected = false;
    battle.connecting = false;
    setStatus('CAMPO COMPARTIDO NO DISPONIBLE · EL JUEGO LOCAL SIGUE ACTIVO', true);
  }
}

function syncPresence() {
  const state = battle.channel?.presenceState?.() ?? {};
  const seen = new Set();
  for (const entries of Object.values(state)) {
    for (const entry of entries ?? []) {
      if (!entry?.playerId) continue;
      seen.add(entry.playerId);
      battle.peers.set(entry.playerId, { ...(battle.peers.get(entry.playerId) ?? {}), ...entry, lastSeen: Date.now() });
    }
  }
  if (!seen.has(battle.playerId)) battle.peers.set(battle.playerId, { ...localPresence(), lastSeen: Date.now() });
  for (const id of [...battle.peers.keys()]) if (id !== battle.playerId && !seen.has(id)) battle.peers.delete(id);
  electAuthority();
  renderHud();
}

function receivePilot(payload) {
  if (!payload?.playerId || payload.playerId === battle.playerId) return;
  const safe = {
    playerId: String(payload.playerId),
    callsign: String(payload.callsign || 'PILOTO').slice(0, 18),
    state: String(payload.state || 'idle').slice(0, 16),
    x: clamp(Number(payload.x) || 0, -40, 40),
    y: clamp(Number(payload.y) || 0, -30, 30),
    z: clamp(Number(payload.z) || COMBAT_CONFIG.world.shipZ, -30, 30),
    shield: clamp(Number(payload.shield) || 0, 0, 100),
    sector: clamp(Math.floor(Number(payload.sector) || 1), 1, 999),
    t: Number(payload.t) || Date.now(),
    lastSeen: Date.now(),
  };
  battle.peers.set(safe.playerId, { ...(battle.peers.get(safe.playerId) ?? {}), ...safe });
  electAuthority();
}

function electAuthority() {
  const selected = authorityPeer();
  const nextId = selected?.playerId || battle.playerId;
  if (battle.authorityId === nextId && battle.isAuthority === (nextId === battle.playerId)) return;
  const wasAuthority = battle.isAuthority;
  battle.authorityId = nextId;
  battle.isAuthority = nextId === battle.playerId;
  if (battle.isAuthority) becomeAuthority(!wasAuthority);
  else becomeClient();
  renderHud();
}

function assignId(entity, prefix) {
  if (!entity?.userData) return '';
  if (!entity.userData.v17NetId) entity.userData.v17NetId = `${prefix}-${battle.playerId.slice(0, 8)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  return entity.userData.v17NetId;
}

function worldSnapshot() {
  const g = game();
  if (!g?.scene) return null;
  const snapshot = g.snapshot?.() ?? {};
  const drones = (g.drones ?? []).slice(0, 16).map((item) => ({
    id: assignId(item, 'd'),
    x: Number(item.position.x.toFixed(2)), y: Number(item.position.y.toFixed(2)), z: Number(item.position.z.toFixed(2)),
    rx: Number(item.rotation.x.toFixed(2)), ry: Number(item.rotation.y.toFixed(2)), rz: Number(item.rotation.z.toFixed(2)),
    hp: Math.max(0, Number(item.userData.hp) || 1), maxHp: Math.max(1, Number(item.userData.miniMaxHp || item.userData.hp) || 1),
    radius: clamp(Number(item.userData.radius) || 1.45, 0.5, 6),
    role: String(item.userData.role || item.userData.miniboss || (item.userData.elite ? 'elite' : 'drone')).slice(0, 18),
    elite: Boolean(item.userData.elite),
  }));
  const asteroids = (g.asteroids ?? []).slice(0, 20).map((item) => ({
    id: assignId(item, 'a'),
    x: Number(item.position.x.toFixed(2)), y: Number(item.position.y.toFixed(2)), z: Number(item.position.z.toFixed(2)),
    rx: Number(item.rotation.x.toFixed(2)), ry: Number(item.rotation.y.toFixed(2)), rz: Number(item.rotation.z.toFixed(2)),
    radius: clamp(Number(item.userData.radius) || 1.2, 0.45, 3),
  }));
  const bullets = (g.enemyBullets ?? []).slice(0, 40).map((item) => ({
    id: assignId(item, 'b'),
    x: Number(item.position.x.toFixed(2)), y: Number(item.position.y.toFixed(2)), z: Number(item.position.z.toFixed(2)),
    targetId: String(item.userData.v17TargetId || ''),
    damage: clamp(Number(item.userData.v17Damage) || COMBAT_CONFIG.drone.bulletDamage, 1, 45),
  }));
  const boss = g.boss ? {
    id: assignId(g.boss, 'boss'),
    x: Number(g.boss.position.x.toFixed(2)), y: Number(g.boss.position.y.toFixed(2)), z: Number(g.boss.position.z.toFixed(2)),
    rx: Number(g.boss.rotation.x.toFixed(2)), ry: Number(g.boss.rotation.y.toFixed(2)), rz: Number(g.boss.rotation.z.toFixed(2)),
    hp: Math.max(0, Number(g.boss.userData.hp) || 0), maxHp: Math.max(1, Number(g.boss.userData.maxHp) || 1),
    radius: clamp(Number(g.boss.userData.radius) || 4.4, 2, 9),
    phase: clamp(Math.floor(Number(g.boss.userData.phase) || 1), 1, 8),
    name: String(g.currentGuardian?.name || 'GUARDIÁN COMPARTIDO').slice(0, 28),
  } : null;
  return {
    v: 17,
    tick: ++battle.tick,
    authorityId: battle.playerId,
    sentAt: Date.now(),
    sector: clamp(Math.floor(Number(snapshot.sector ?? g.sector ?? 1) || 1), 1, 999),
    sectorTime: clamp(Number(g.sectorTime) || 0, 0, 9999),
    mission: snapshot.mission ? { type: snapshot.mission.type, title: String(snapshot.mission.title || '').slice(0, 40), target: Number(snapshot.mission.target) || 0, progress: Number(snapshot.mission.progress) || 0, complete: Boolean(snapshot.mission.complete) } : null,
    objective: snapshot.campaign?.objective ? { name: String(snapshot.campaign.objective.name || '').slice(0, 40), progress: Number(snapshot.campaign.objective.progress) || 0, target: Number(snapshot.campaign.objective.target) || 0 } : null,
    boss,
    drones,
    asteroids,
    bullets,
  };
}

function receiveSnapshot(payload) {
  if (!payload || payload.authorityId !== battle.authorityId || battle.isAuthority) return;
  if ((Number(payload.tick) || 0) <= (Number(battle.latest?.tick) || 0)) return;
  battle.latest = sanitizeSnapshot(payload);
  applySharedState();
}

function sanitizeSnapshot(payload) {
  const entity = (item, radiusFallback = 1) => ({
    id: String(item?.id || '').slice(0, 80),
    x: clamp(Number(item?.x) || 0, -55, 55), y: clamp(Number(item?.y) || 0, -40, 40), z: clamp(Number(item?.z) || 0, -170, 50),
    rx: clamp(Number(item?.rx) || 0, -10, 10), ry: clamp(Number(item?.ry) || 0, -10, 10), rz: clamp(Number(item?.rz) || 0, -10, 10),
    hp: Math.max(0, Number(item?.hp) || 0), maxHp: Math.max(1, Number(item?.maxHp) || 1),
    radius: clamp(Number(item?.radius) || radiusFallback, 0.2, 10),
    role: String(item?.role || '').slice(0, 18), elite: Boolean(item?.elite),
    targetId: String(item?.targetId || '').slice(0, 80), damage: clamp(Number(item?.damage) || COMBAT_CONFIG.drone.bulletDamage, 1, 45),
    phase: clamp(Math.floor(Number(item?.phase) || 1), 1, 8), name: String(item?.name || '').slice(0, 28),
  });
  const boss = payload.boss ? entity(payload.boss, 4.4) : null;
  if (boss) boss.name = String(payload.boss.name || 'GUARDIÁN COMPARTIDO').slice(0, 28);
  return {
    tick: Math.max(0, Math.floor(Number(payload.tick) || 0)),
    authorityId: String(payload.authorityId || ''),
    sentAt: Number(payload.sentAt) || Date.now(),
    sector: clamp(Math.floor(Number(payload.sector) || 1), 1, 999),
    sectorTime: clamp(Number(payload.sectorTime) || 0, 0, 9999),
    mission: payload.mission ? { ...payload.mission, title: String(payload.mission.title || '').slice(0, 40), target: Math.max(0, Number(payload.mission.target) || 0), progress: Math.max(0, Number(payload.mission.progress) || 0), complete: Boolean(payload.mission.complete) } : null,
    objective: payload.objective ? { ...payload.objective, name: String(payload.objective.name || '').slice(0, 40), target: Math.max(0, Number(payload.objective.target) || 0), progress: Math.max(0, Number(payload.objective.progress) || 0) } : null,
    boss,
    drones: Array.isArray(payload.drones) ? payload.drones.slice(0, 16).map((item) => entity(item, 1.45)).filter((item) => item.id) : [],
    asteroids: Array.isArray(payload.asteroids) ? payload.asteroids.slice(0, 20).map((item) => entity(item, 1.2)).filter((item) => item.id) : [],
    bullets: Array.isArray(payload.bullets) ? payload.bullets.slice(0, 40).map((item) => entity(item, 0.36)).filter((item) => item.id) : [],
  };
}

function ensureRoot() {
  const g = game();
  if (!g?.scene) return null;
  if (battle.root?.parent) return battle.root;
  const root = new THREE.Group();
  root.name = 'WAE_V17_SHARED_BATTLEFIELD';
  g.scene.add(root);
  battle.root = root;
  return root;
}

function shadowMaterial(kind, role = '') {
  const palettes = {
    boss: [0x5b21b6, 0xd946ef], bullet: [0x9f1239, 0xfb7185], asteroid: [0x334155, 0x67e8f9],
    drone: role === 'sniper' ? [0x581c87, 0xe879f9] : role === 'sentinel' ? [0x1e3a8a, 0x60a5fa] : role === 'elite' ? [0x92400e, 0xfbbf24] : [0x7f1d1d, 0xfb7185],
  };
  const [base, glow] = palettes[kind] || palettes.drone;
  return {
    metal: new THREE.MeshStandardMaterial({ color: base, emissive: glow, emissiveIntensity: kind === 'boss' ? 0.58 : 0.28, metalness: 0.72, roughness: 0.26 }),
    glow: new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.88 }),
  };
}

function createShadow(kind, item) {
  const root = ensureRoot();
  if (!root) return null;
  const group = new THREE.Group();
  group.name = `V17_${kind}_${item.id}`;
  const materials = shadowMaterial(kind, item.role);
  if (kind === 'asteroid') {
    const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(item.radius || 1.2, 1), materials.metal);
    group.add(mesh);
  } else if (kind === 'bullet') {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.23, 8, 8), materials.glow);
    const light = new THREE.PointLight(materials.glow.color, 1.4, 4, 2);
    group.add(mesh, light);
  } else if (kind === 'boss') {
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(3.2, 1), materials.metal);
    const ringA = new THREE.Mesh(new THREE.TorusGeometry(4.3, 0.22, 10, 42), materials.glow);
    const ringB = new THREE.Mesh(new THREE.TorusGeometry(4.3, 0.14, 10, 42), materials.glow.clone());
    ringA.rotation.x = Math.PI / 2;
    ringB.rotation.y = Math.PI / 2;
    group.add(core, ringA, ringB);
  } else {
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(1.08, 0), materials.metal);
    core.scale.set(1.05, 0.7, 1.55);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.12, 1.1), materials.metal.clone());
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.23, 8, 8), materials.glow);
    eye.position.z = 1.28;
    group.add(core, wing, eye);
    if (item.elite || item.role === 'elite') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.08, 8, 28), materials.glow.clone());
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
    }
  }
  group.userData.v17 = { kind, id: item.id, target: new THREE.Vector3(item.x, item.y, item.z), targetRotation: new THREE.Euler(item.rx || 0, item.ry || 0, item.rz || 0), radius: item.radius || 1, hp: item.hp, maxHp: item.maxHp, damage: item.damage, targetId: item.targetId, lastSeen: Date.now() };
  group.position.copy(group.userData.v17.target);
  group.rotation.copy(group.userData.v17.targetRotation);
  root.add(group);
  battle.shadows.set(item.id, group);
  return group;
}

function upsertShadow(kind, item) {
  let group = battle.shadows.get(item.id);
  if (!group || group.userData.v17?.kind !== kind) {
    if (group) removeShadow(item.id);
    group = createShadow(kind, item);
  }
  if (!group) return;
  const data = group.userData.v17;
  data.target.set(item.x, item.y, item.z);
  data.targetRotation.set(item.rx || 0, item.ry || 0, item.rz || 0);
  data.radius = item.radius || data.radius;
  data.hp = item.hp;
  data.maxHp = item.maxHp;
  data.damage = item.damage;
  data.targetId = item.targetId;
  data.lastSeen = Date.now();
}

function removeShadow(id) {
  const group = battle.shadows.get(id);
  if (!group) return;
  group.parent?.remove(group);
  group.traverse((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose?.());
    else child.material?.dispose?.();
  });
  battle.shadows.delete(id);
  battle.consumed.delete(id);
}

function clearShadows() {
  for (const id of [...battle.shadows.keys()]) removeShadow(id);
  if (battle.root?.parent) battle.root.parent.remove(battle.root);
  battle.root = null;
  battle.consumed.clear();
}

function applySharedState() {
  const g = game();
  const snapshot = battle.latest;
  if (!g || !snapshot || battle.isAuthority) return;
  const seen = new Set();
  for (const item of snapshot.asteroids) { seen.add(item.id); upsertShadow('asteroid', item); }
  for (const item of snapshot.drones) { seen.add(item.id); upsertShadow('drone', item); }
  for (const item of snapshot.bullets) { seen.add(item.id); upsertShadow('bullet', item); }
  if (snapshot.boss) { seen.add(snapshot.boss.id); upsertShadow('boss', snapshot.boss); }
  for (const id of [...battle.shadows.keys()]) if (!seen.has(id)) removeShadow(id);

  if (g.sector !== snapshot.sector) {
    battle.lastSector = snapshot.sector;
    g.sector = snapshot.sector;
    g.sectorTime = snapshot.sectorTime;
    g.applyBiome?.(snapshot.sector);
    g.callbacks?.onAnnounce?.(`SECTOR COMPARTIDO ${snapshot.sector} · HOST SYNC`);
  } else g.sectorTime = snapshot.sectorTime;
  if (snapshot.mission && g.mission) g.mission = { ...g.mission, ...snapshot.mission };
  g.callbacks?.onHud?.(g.snapshot?.());
  renderHud();
}

function clearLocalHostiles() {
  const g = game();
  if (!g?.scene) return;
  for (const item of g.drones ?? []) g.scene.remove(item);
  for (const item of g.enemyBullets ?? []) g.scene.remove(item);
  for (const item of g.asteroids ?? []) g.scene.remove(item);
  if (g.boss) g.scene.remove(g.boss);
  if (g.drones) g.drones.length = 0;
  if (g.enemyBullets) g.enemyBullets.length = 0;
  if (g.asteroids) g.asteroids.length = 0;
  g.boss = null;
}

function ensureBattleHooks() {
  const g = game();
  if (!g || battle.originals) return;
  battle.originals = {
    spawnDrone: g.spawnDrone?.bind(g), spawnBoss: g.spawnBoss?.bind(g), spawnAsteroid: g.spawnAsteroid?.bind(g), fireEnemy: g.fireEnemy?.bind(g),
    updateDrones: g.updateDrones?.bind(g), updateBoss: g.updateBoss?.bind(g), updateEnemyBullets: g.updateEnemyBullets?.bind(g), updateAsteroids: g.updateAsteroids?.bind(g),
    updateLasers: g.updateLasers?.bind(g), updateMission: g.updateMission?.bind(g), activateSecondary: g.activateSecondary?.bind(g),
  };
  electAuthority();
}

function restoreOriginals() {
  const g = game();
  const o = battle.originals;
  if (!g || !o) return;
  for (const [key, fn] of Object.entries(o)) if (typeof fn === 'function') g[key] = fn;
}

function becomeClient() {
  const g = game();
  const o = battle.originals;
  if (!g || !o) return;
  clearLocalHostiles();
  g.spawnDrone = () => null;
  g.spawnBoss = () => null;
  g.spawnAsteroid = () => null;
  g.fireEnemy = () => null;
  g.updateDrones = () => {};
  g.updateBoss = () => {};
  g.updateEnemyBullets = () => {};
  g.updateAsteroids = () => {};
  g.updateMission = () => {};
  g.updateLasers = (delta) => {
    o.updateLasers?.(delta);
    detectLaserHits();
  };
  if (o.activateSecondary) {
    g.activateSecondary = (...args) => {
      const result = o.activateSecondary(...args);
      if (result) sendAreaHit();
      return result;
    };
  }
  setStatus('CLIENT SYNC · EL HOST CONTROLA ENEMIGOS Y GUARDIANES');
}

function becomeAuthority(fromMigration = false) {
  const g = game();
  if (!g || !battle.originals) return;
  restoreOriginals();
  clearShadows();
  const originalFireEnemy = battle.originals.fireEnemy;
  if (originalFireEnemy) {
    g.fireEnemy = (origin, speed = COMBAT_CONFIG.drone.bulletSpeed, spread = 0) => fireSharedEnemy(origin, speed, spread);
  }
  if (fromMigration && battle.latest && !battle.takeoverPending) {
    battle.takeoverPending = true;
    g.sector = battle.latest.sector || g.sector;
    g.sectorTime = Math.min(Number(battle.latest.sectorTime) || 0, 8);
    g.bossSpawned = false;
    if (battle.latest.mission && g.mission) g.mission = { ...g.mission, ...battle.latest.mission, progress: Math.min(Number(battle.latest.mission.progress) || 0, Number(battle.latest.mission.target) || 0) };
    clearLocalHostiles();
    g.callbacks?.onAnnounce?.('AUTORIDAD DE BATALLA TRANSFERIDA · FORMACIÓN RECUPERADA');
    window.setTimeout(() => { battle.takeoverPending = false; }, 1200);
  }
  broadcast('authority_notice', { authorityId: battle.playerId, callsign: battle.callsign, at: Date.now() });
  setStatus('HOST AUTHORITY · SIMULACIÓN COMPARTIDA ACTIVA');
}

function fireSharedEnemy(origin, speed, spread) {
  const g = game();
  if (!g?.scene || !battle.isAuthority) return;
  const candidates = [...battle.peers.values()].filter((peer) => peer.state === 'playing' && Date.now() - (peer.lastSeen ?? 0) < STALE_MS);
  candidates.push({ playerId: battle.playerId, ...localPilotState() });
  const unique = [...new Map(candidates.map((item) => [item.playerId, item])).values()];
  const target = unique[Math.floor(Math.random() * Math.max(1, unique.length))] || localPilotState();
  const bullet = new THREE.Mesh(g.resources.enemyBulletGeometry, g.resources.enemyBulletMaterial);
  bullet.position.copy(origin);
  const targetVector = new THREE.Vector3(target?.x ?? g.ship.position.x, target?.y ?? g.ship.position.y, target?.z ?? g.ship.position.z);
  targetVector.x += THREE.MathUtils.randFloatSpread(spread || 0);
  targetVector.y += THREE.MathUtils.randFloatSpread(spread || 0);
  bullet.userData = {
    velocity: targetVector.sub(origin).normalize().multiplyScalar(Number(speed) || COMBAT_CONFIG.drone.bulletSpeed),
    radius: 0.36,
    life: 5,
    v17TargetId: target?.playerId || battle.playerId,
    v17Damage: COMBAT_CONFIG.drone.bulletDamage,
  };
  assignId(bullet, 'b');
  g.scene.add(bullet);
  g.enemyBullets.push(bullet);
  g.audio?.play?.('enemyLaser');
}

function detectLaserHits() {
  if (battle.isAuthority) return;
  const g = game();
  if (!g?.lasers?.length) return;
  const targets = [...battle.shadows.values()].filter((group) => ['asteroid', 'drone', 'boss'].includes(group.userData.v17?.kind));
  for (let i = g.lasers.length - 1; i >= 0; i -= 1) {
    const laser = g.lasers[i];
    for (const group of targets) {
      const data = group.userData.v17;
      const radius = (data.radius || 1) + (laser.userData.radius || COMBAT_CONFIG.laser.radius);
      if (laser.position.distanceToSquared(group.position) > radius * radius) continue;
      g.scene.remove(laser);
      g.lasers.splice(i, 1);
      g.createExplosion?.(laser.position.clone(), data.kind === 'boss' ? 0xe879f9 : 0x67e8f9, data.kind === 'boss' ? 8 : 5);
      broadcast('hit_intent', { from: battle.playerId, targetId: data.id, targetType: data.kind, damage: 1, at: Date.now() });
      break;
    }
  }
}

function sendAreaHit() {
  const targets = [...battle.shadows.values()]
    .filter((group) => ['drone', 'boss'].includes(group.userData.v17?.kind))
    .sort((a, b) => a.position.distanceToSquared(game()?.ship?.position ?? new THREE.Vector3()) - b.position.distanceToSquared(game()?.ship?.position ?? new THREE.Vector3()))
    .slice(0, 8);
  for (const group of targets) {
    const data = group.userData.v17;
    broadcast('hit_intent', { from: battle.playerId, targetId: data.id, targetType: data.kind, damage: data.kind === 'boss' ? 1 : 2, ability: 'nova', at: Date.now() });
  }
}

function hitAllowed(sender) {
  const now = Date.now();
  const current = battle.hitRate.get(sender) ?? { start: now, count: 0 };
  if (now - current.start > 1000) { current.start = now; current.count = 0; }
  current.count += 1;
  battle.hitRate.set(sender, current);
  return current.count <= 45;
}

function receiveHitIntent(payload) {
  if (!battle.isAuthority || !payload?.from || payload.from === battle.playerId || !hitAllowed(String(payload.from))) return;
  const g = game();
  if (!g) return;
  const targetId = String(payload.targetId || '');
  const type = String(payload.targetType || '');
  const damage = clamp(Number(payload.damage) || 1, 1, 3);
  if (type === 'boss' && g.boss?.userData?.v17NetId === targetId) {
    g.boss.userData.hp -= damage;
    g.createExplosion?.(g.boss.position.clone(), 0xe879f9, 5);
    if (g.boss.userData.hp <= 0) g.defeatBoss?.();
    else g.callbacks?.onHud?.(g.snapshot?.());
    return;
  }
  if (type === 'drone') {
    const index = (g.drones ?? []).findIndex((item) => item.userData?.v17NetId === targetId);
    if (index < 0) return;
    const drone = g.drones[index];
    drone.userData.hp -= damage;
    g.createExplosion?.(drone.position.clone(), 0xfb7185, 4);
    if (drone.userData.hp <= 0) {
      const position = drone.position.clone();
      g.scene.remove(drone);
      g.drones.splice(index, 1);
      g.audio?.play?.('explosion');
      g.createExplosion?.(position, 0xfb7185, 14);
      g.registerDroneKill?.(position);
    }
    return;
  }
  if (type === 'asteroid') {
    const index = (g.asteroids ?? []).findIndex((item) => item.userData?.v17NetId === targetId);
    if (index < 0) return;
    const asteroid = g.asteroids[index];
    const position = asteroid.position.clone();
    g.scene.remove(asteroid);
    asteroid.geometry?.dispose?.();
    g.asteroids.splice(index, 1);
    g.createExplosion?.(position, 0x67e8f9, 12);
    g.registerKill?.(position);
  }
}

function detectClientCollisions() {
  if (battle.isAuthority) return;
  const g = game();
  if (!g?.ship || g.state !== 'playing') return;
  for (const group of battle.shadows.values()) {
    const data = group.userData.v17;
    if (!data || battle.consumed.has(data.id) || data.kind === 'boss') continue;
    const radius = data.kind === 'bullet' ? 1.8 : (data.radius || 1) + COMBAT_CONFIG.ship.radius;
    if (group.position.distanceToSquared(g.ship.position) > radius * radius) continue;
    battle.consumed.add(data.id);
    const damage = data.kind === 'bullet' ? (data.damage || COMBAT_CONFIG.drone.bulletDamage) : COMBAT_CONFIG.ship.hitDamage;
    g.damageShip?.(damage, group.position.clone());
    broadcast('collision_intent', { from: battle.playerId, targetId: data.id, targetType: data.kind, at: Date.now() });
    group.visible = false;
  }
}

function receiveCollisionIntent(payload) {
  if (!battle.isAuthority || !payload?.from || payload.from === battle.playerId) return;
  const g = game();
  if (!g) return;
  const id = String(payload.targetId || '');
  const type = String(payload.targetType || '');
  const map = type === 'bullet' ? g.enemyBullets : type === 'drone' ? g.drones : type === 'asteroid' ? g.asteroids : null;
  if (!Array.isArray(map)) return;
  const index = map.findIndex((item) => item.userData?.v17NetId === id);
  if (index < 0) return;
  const item = map[index];
  g.scene?.remove(item);
  if (type === 'asteroid') item.geometry?.dispose?.();
  map.splice(index, 1);
}

function receivePing(payload) {
  if (!battle.isAuthority || !payload?.id || !payload?.from) return;
  broadcast('pong', { id: String(payload.id), to: String(payload.from), at: Date.now() });
}

function receivePong(payload) {
  if (payload?.to !== battle.playerId || !payload?.id) return;
  const started = battle.pendingPings.get(String(payload.id));
  if (!started) return;
  battle.pendingPings.delete(String(payload.id));
  battle.ping = clamp(Date.now() - started, 1, 9999);
  renderHud();
}

function receiveAuthorityNotice(payload) {
  if (!payload?.authorityId || payload.authorityId === battle.authorityId) return;
  battle.authorityId = String(payload.authorityId);
  battle.isAuthority = battle.authorityId === battle.playerId;
  if (battle.isAuthority) becomeAuthority(true);
  else becomeClient();
}

function animateSharedWorld() {
  const now = Date.now();
  if (!battle.isAuthority) {
    for (const [id, group] of battle.shadows.entries()) {
      const data = group.userData.v17;
      if (!data || now - data.lastSeen > STALE_MS) { removeShadow(id); continue; }
      group.position.lerp(data.target, data.kind === 'bullet' ? 0.42 : 0.28);
      group.rotation.x += (data.targetRotation.x - group.rotation.x) * 0.22;
      group.rotation.y += (data.targetRotation.y - group.rotation.y) * 0.22;
      group.rotation.z += (data.targetRotation.z - group.rotation.z) * 0.22;
      if (data.kind === 'boss') {
        if (group.children[1]) group.children[1].rotation.z += 0.035;
        if (group.children[2]) group.children[2].rotation.x += 0.028;
      }
      if (data.kind === 'drone' && group.children[3]) group.children[3].rotation.z += 0.045;
    }
    detectClientCollisions();
  }
  renderHud();
  battle.raf = requestAnimationFrame(animateSharedWorld);
}

function startLoops() {
  window.clearInterval(battle.snapshotTimer);
  window.clearInterval(battle.pilotTimer);
  window.clearInterval(battle.pingTimer);
  battle.snapshotTimer = window.setInterval(() => {
    if (!battle.connected || !battle.isAuthority || game()?.state !== 'playing') return;
    const snapshot = worldSnapshot();
    if (!snapshot) return;
    battle.latest = snapshot;
    broadcast('world_snapshot', snapshot);
  }, SNAPSHOT_MS);
  battle.pilotTimer = window.setInterval(() => {
    if (!battle.connected) return;
    const state = localPilotState();
    if (state) {
      battle.peers.set(battle.playerId, { ...(battle.peers.get(battle.playerId) ?? localPresence()), ...state, lastSeen: Date.now() });
      broadcast('pilot_state', state);
    }
    electAuthority();
  }, PILOT_MS);
  battle.pingTimer = window.setInterval(() => {
    if (!battle.connected || battle.isAuthority) return;
    const id = `${battle.playerId.slice(0, 6)}-${Date.now().toString(36)}`;
    battle.pendingPings.set(id, Date.now());
    broadcast('ping', { id, from: battle.playerId, at: Date.now() });
    for (const [key, time] of battle.pendingPings) if (Date.now() - time > 7000) battle.pendingPings.delete(key);
  }, PING_MS);
  if (!battle.raf) battle.raf = requestAnimationFrame(animateSharedWorld);
}

async function disconnectBattle() {
  window.clearInterval(battle.snapshotTimer);
  window.clearInterval(battle.pilotTimer);
  window.clearInterval(battle.pingTimer);
  battle.snapshotTimer = battle.pilotTimer = battle.pingTimer = 0;
  if (battle.channel) {
    try { await battle.channel.untrack(); } catch {}
    try { await battle.client?.removeChannel(battle.channel); } catch {}
  }
  restoreOriginals();
  clearShadows();
  battle.channel = null;
  battle.room = '';
  battle.connected = false;
  battle.connecting = false;
  battle.peers.clear();
  battle.authorityId = '';
  battle.isAuthority = false;
  battle.latest = null;
  battle.ping = 0;
  battle.pendingPings.clear();
  ensureHud().classList.add('hidden');
}

function watchRoom() {
  let last = '';
  window.setInterval(() => {
    const room = roomFromUrl();
    if (room === last && ((room && battle.connected) || (!room && !battle.connected))) return;
    last = room;
    if (ROOM_RE.test(room)) connectBattle(room);
    else if (battle.connected || battle.connecting) disconnectBattle();
  }, 500);
}

window.addEventListener('beforeunload', () => {
  battle.channel?.untrack?.();
});

ensureHud();
watchRoom();
const initialRoom = roomFromUrl();
if (ROOM_RE.test(initialRoom)) connectBattle(initialRoom);
