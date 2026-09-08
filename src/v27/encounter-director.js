import * as THREE from 'three';
import { CONFIG, ENEMY_ROLES } from '../v8/config.js';

const $ = (selector, root = document) => root.querySelector(selector);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const CELL_SIZE = 5;
const DOCTRINE_MS = 11000;
const VOLLEY_MS = 7200;
const REINFORCE_MS = 8600;

const FORMATIONS = Object.freeze({
  wedge: [[0,0],[-2.7,1.2],[2.7,1.2],[-5.4,2.5],[5.4,2.5]],
  spear: [[0,-1.2],[-2,1.1],[2,1.1],[-3.8,3.1],[3.8,3.1]],
  pincer: [[-7.4,0],[7.4,0],[-10.2,2.3],[10.2,2.3],[0,-1.8]],
  wall: [[-7.6,0],[-3.8,0],[0,0],[3.8,0],[7.6,0]],
  hunter: [[-5.4,-.8],[5.4,-.8],[-2.8,2.1],[2.8,2.1],[0,3.6]],
  swarm: [[0,0],[-3.6,1.2],[3.6,-1.2],[-1.8,3.3],[1.8,-3.3]],
});

const BIOME_DOCTRINES = Object.freeze({
  'cyan-void': ['wedge','spear','hunter'],
  'solar-storm': ['pincer','spear','wedge'],
  'violet-rift': ['hunter','swarm','pincer'],
  'emerald-front': ['wall','wedge','hunter'],
});

const state = {
  installed: false,
  baseUpdate: null,
  baseSpawnDrone: null,
  baseStart: null,
  baseReset: null,
  cells: new Map(),
  nextCellId: 1,
  doctrine: 'wedge',
  doctrineAt: 0,
  volleyAt: 0,
  reinforceAt: 0,
  lastAnnounceAt: 0,
  lastSector: 0,
  leaderBeaconGeo: null,
  leaderBeaconMat: null,
};

function game() { return window.__waeNeonRiderGame; }
function hasRoom() { return String(new URLSearchParams(location.search).get('squad') || '').length >= 4; }
function isAuthority() {
  if (!hasRoom()) return true;
  return /HOST AUTHORITY/i.test($('[data-v17-role]')?.textContent || '');
}
function activePilotCount() {
  const peers = document.querySelectorAll('#v18-squad-hud .v18-peer-list article:not(.downed)').length;
  return clamp(peers || 1, 1, 4);
}
function biomeId(g) { return String(g?.currentBiome?.id || 'cyan-void'); }
function currentPool(g) { return BIOME_DOCTRINES[biomeId(g)] || BIOME_DOCTRINES['cyan-void']; }

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function chooseDoctrine(g, force = false) {
  const now = performance.now();
  if (!force && now - state.doctrineAt < DOCTRINE_MS) return state.doctrine;
  const pool = currentPool(g);
  const sector = Math.max(1, Number(g?.sector) || 1);
  const slot = Math.floor((Number(g?.sectorTime) || 0) / (DOCTRINE_MS / 1000));
  state.doctrine = pool[hash(`${biomeId(g)}|${sector}|${slot}`) % pool.length];
  state.doctrineAt = now;
  return state.doctrine;
}

function ensureBeaconResources() {
  if (!state.leaderBeaconGeo) state.leaderBeaconGeo = new THREE.TorusGeometry(1.95, 0.045, 8, 36);
  if (!state.leaderBeaconMat) state.leaderBeaconMat = new THREE.MeshBasicMaterial({ color: 0xfde68a, transparent: true, opacity: 0.46, depthWrite: false, blending: THREE.AdditiveBlending });
}

function markLeader(drone) {
  if (!drone || drone.userData.v27Leader) return;
  ensureBeaconResources();
  drone.userData.v27Leader = true;
  const ring = new THREE.Mesh(state.leaderBeaconGeo, state.leaderBeaconMat.clone());
  ring.name = 'WAE_V27_LEADER_BEACON';
  ring.rotation.x = Math.PI / 2;
  ring.position.z = 0.35;
  ring.userData.v27LeaderRing = true;
  drone.add(ring);
}

function ensureCell(drone, g) {
  if (!drone?.userData || drone.userData.v27CellId) return;
  let cell = [...state.cells.values()].find((item) => item.members.size < CELL_SIZE && item.sector === g.sector);
  if (!cell) {
    const id = `cell-${state.nextCellId++}`;
    cell = { id, sector: g.sector, members: new Set(), leader: null, createdAt: performance.now() };
    state.cells.set(id, cell);
  }
  drone.userData.v27CellId = cell.id;
  drone.userData.v27Slot = cell.members.size;
  drone.userData.v27MaxHp = Math.max(1, Number(drone.userData.miniMaxHp || drone.userData.hp) || 1);
  drone.userData.v27AnchorX = Number(drone.userData.baseX ?? drone.position.x) || 0;
  drone.userData.v27AnchorY = Number(drone.userData.baseY ?? drone.position.y) || 0;
  drone.userData.v27Retreat = 0;
  cell.members.add(drone);
  const candidateScore = (drone.userData.minibossId ? 3 : 0) + (drone.userData.elite ? 2 : 0) + (Number(drone.userData.hp) || 0) / 10;
  const leaderScore = cell.leader ? ((cell.leader.userData.minibossId ? 3 : 0) + (cell.leader.userData.elite ? 2 : 0) + (Number(cell.leader.userData.hp) || 0) / 10) : -1;
  if (!cell.leader || candidateScore > leaderScore) cell.leader = drone;
}

function cleanCells(g) {
  const active = new Set(g.drones || []);
  for (const [id, cell] of state.cells.entries()) {
    for (const drone of [...cell.members]) if (!active.has(drone)) cell.members.delete(drone);
    if (!cell.members.size) { state.cells.delete(id); continue; }
    if (!cell.leader || !active.has(cell.leader)) cell.leader = [...cell.members].sort((a,b)=>(Number(b.userData.hp)||0)-(Number(a.userData.hp)||0))[0] || null;
    if (cell.leader) markLeader(cell.leader);
  }
}

function tacticalTarget(drone, g, doctrine) {
  const formation = FORMATIONS[doctrine] || FORMATIONS.wedge;
  const slot = formation[Number(drone.userData.v27Slot) % formation.length] || formation[0];
  const ship = g.ship?.position || { x: 0, y: 0, z: 0 };
  const role = String(drone.userData.role || 'raider');
  const sign = (Number(drone.userData.v27Slot) % 2 === 0) ? 1 : -1;
  let x = Number(drone.userData.v27AnchorX) + slot[0];
  let y = Number(drone.userData.v27AnchorY) + slot[1];

  if (doctrine === 'pincer') x = ship.x + slot[0];
  if (doctrine === 'hunter') x = ship.x + sign * (role === 'sniper' ? 7.8 : 5.6);
  if (doctrine === 'wall' && role === 'sentinel') x = clamp(slot[0], CONFIG.world.xMin + 2, CONFIG.world.xMax - 2);
  if (doctrine === 'swarm' || role === 'swarm') {
    const t = (Number(drone.userData.age) || 0) * 2.4 + Number(drone.userData.v27Slot);
    x += Math.sin(t) * 2.8;
    y += Math.cos(t * 1.17) * 2.2;
  }
  if (role === 'raider' && g.sector >= 3) x += sign * Math.sin((Number(drone.userData.age) || 0) * 1.8) * 1.5;

  return {
    x: clamp(x, CONFIG.world.xMin + 1, CONFIG.world.xMax - 1),
    y: clamp(y, CONFIG.world.yMin + 1, CONFIG.world.yMax - 1),
  };
}

function applyRoleBehavior(drone, g, delta, doctrine) {
  const role = String(drone.userData.role || 'raider');
  const hp = Math.max(0, Number(drone.userData.hp) || 0);
  const maxHp = Math.max(1, Number(drone.userData.v27MaxHp) || hp || 1);
  const ratio = hp / maxHp;
  const mini = Boolean(drone.userData.minibossId);
  const elite = Boolean(drone.userData.elite);

  if (!mini && !elite && ratio <= 0.34 && g.sector >= 4) drone.userData.v27Retreat = Math.max(Number(drone.userData.v27Retreat) || 0, 1.8);
  if (drone.userData.v27Retreat > 0) {
    drone.userData.v27Retreat = Math.max(0, drone.userData.v27Retreat - delta);
    drone.position.z -= delta * 12;
    drone.position.x += Math.sign(drone.position.x || 1) * delta * 4.2;
    drone.userData.fireTimer = Math.max(Number(drone.userData.fireTimer) || 0, 0.8);
    return 'RETREAT';
  }

  const target = tacticalTarget(drone, g, doctrine);
  const blend = 1 - Math.exp(-delta * (role === 'swarm' ? 3.8 : role === 'sentinel' ? 1.7 : 2.5));
  drone.position.x += (target.x - drone.position.x) * blend * 0.42;
  drone.position.y += (target.y - drone.position.y) * blend * 0.32;

  if (role === 'sniper') {
    const holdZ = (g.ship?.position.z ?? 0) - 18;
    if (drone.position.z > holdZ) drone.position.z -= delta * 8.5;
  }
  if (role === 'sentinel' && drone.userData.v27Leader) drone.userData.fireTimer = Math.min(Number(drone.userData.fireTimer) || 1, 0.95);
  return doctrine.toUpperCase();
}

function primeVolley(g) {
  const now = performance.now();
  if (g.sector < 3 || now - state.volleyAt < VOLLEY_MS) return false;
  state.volleyAt = now;
  let primed = 0;
  for (const cell of state.cells.values()) {
    const members = [...cell.members].filter((d) => d?.parent && !d.userData.v27Retreat);
    members.forEach((drone, index) => {
      if (drone.position.z > -72 && drone.position.z < 5) {
        drone.userData.fireTimer = Math.min(Number(drone.userData.fireTimer) || 1, 0.16 + index * 0.07);
        primed += 1;
      }
    });
  }
  if (primed >= 2 && now - state.lastAnnounceAt > 3500) {
    state.lastAnnounceAt = now;
    g.callbacks?.onAnnounce?.(`TACTICAL LINK · ${state.doctrine.toUpperCase()} VOLLEY`);
  }
  return primed >= 2;
}

function maybeReinforce(g) {
  const now = performance.now();
  if (g.boss || g.sector < 5 || now - state.reinforceAt < REINFORCE_MS) return false;
  const max = Math.max(4, Number(CONFIG.drone.maxActive) || 6);
  const pilots = activePilotCount();
  const threshold = Math.min(max - 1, 1 + pilots);
  if ((g.drones?.length || 0) > threshold) return false;
  state.reinforceAt = now;
  const count = g.sector >= 9 && pilots >= 3 ? 2 : 1;
  for (let i = 0; i < count && (g.drones?.length || 0) < max; i += 1) g.spawnDrone?.(g.sector >= 8 && i === 0);
  g.callbacks?.onAnnounce?.('TACTICAL DIRECTOR · REINFORCEMENTS INBOUND');
  return true;
}

function updateLeaderBeacons(delta, elapsed) {
  for (const cell of state.cells.values()) {
    const leader = cell.leader;
    if (!leader?.parent) continue;
    const ring = leader.children?.find((child) => child.userData?.v27LeaderRing);
    if (!ring) continue;
    ring.rotation.z += delta * 0.85;
    ring.material.opacity = 0.34 + Math.sin(elapsed * 4.2) * 0.12;
    ring.scale.setScalar(1 + Math.sin(elapsed * 3.1) * 0.035);
  }
}

function renderHud(g, tactic = '') {
  const hud = $('#v27-tactical-hud');
  if (!hud) return;
  const active = g?.state === 'playing' && !g?.boss && (g?.drones?.length || 0) > 0;
  hud.classList.toggle('hidden', !active);
  if (!active) return;
  $('[data-v27-doctrine]', hud).textContent = state.doctrine.toUpperCase();
  $('[data-v27-tactic]', hud).textContent = tactic || 'FORMATION';
  $('[data-v27-cells]', hud).textContent = String(state.cells.size);
}

function resetDirector() {
  state.cells.clear();
  state.nextCellId = 1;
  state.doctrineAt = 0;
  state.volleyAt = 0;
  state.reinforceAt = 0;
  state.lastAnnounceAt = 0;
  state.lastSector = 0;
}

export function installEncounterDirector() {
  const g = game();
  if (!g || state.installed || g.__waeV27EncounterDirector) return false;
  state.installed = true;
  g.__waeV27EncounterDirector = true;
  state.baseUpdate = typeof g.updatePlaying === 'function' ? g.updatePlaying.bind(g) : null;
  state.baseSpawnDrone = typeof g.spawnDrone === 'function' ? g.spawnDrone.bind(g) : null;
  state.baseStart = typeof g.start === 'function' ? g.start.bind(g) : null;
  state.baseReset = typeof g.resetEngagementState === 'function' ? g.resetEngagementState.bind(g) : null;

  if (state.baseSpawnDrone) {
    g.spawnDrone = (...args) => {
      const before = g.drones?.length || 0;
      const result = state.baseSpawnDrone(...args);
      for (let i = before; i < (g.drones?.length || 0); i += 1) ensureCell(g.drones[i], g);
      return result;
    };
  }
  if (state.baseReset) {
    g.resetEngagementState = (...args) => { resetDirector(); return state.baseReset(...args); };
  }
  if (state.baseStart) {
    g.start = async (...args) => { resetDirector(); const result = await state.baseStart(...args); chooseDoctrine(g, true); return result; };
  }
  if (state.baseUpdate) {
    g.updatePlaying = (delta, elapsed) => {
      state.baseUpdate(delta, elapsed);
      if (g.state !== 'playing' || !isAuthority()) { renderHud(g); return; }
      if (state.lastSector !== g.sector) { state.lastSector = g.sector; chooseDoctrine(g, true); }
      else chooseDoctrine(g);
      for (const drone of g.drones || []) ensureCell(drone, g);
      cleanCells(g);
      let tactic = '';
      for (const drone of g.drones || []) tactic = applyRoleBehavior(drone, g, delta, state.doctrine) || tactic;
      if (primeVolley(g)) tactic = 'COORDINATED VOLLEY';
      if (maybeReinforce(g)) tactic = 'REINFORCEMENTS';
      updateLeaderBeacons(delta, elapsed);
      renderHud(g, tactic);
    };
  }

  chooseDoctrine(g, true);
  window.dispatchEvent(new CustomEvent('wae:v27-encounter-ready'));
  return true;
}

window.addEventListener('beforeunload', () => {
  state.leaderBeaconGeo?.dispose?.();
  state.leaderBeaconMat?.dispose?.();
});
