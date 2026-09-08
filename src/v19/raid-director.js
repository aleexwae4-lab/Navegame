import * as THREE from 'three';
import { CONFIG as COMBAT_CONFIG } from '../v4/config.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const PROFILE_KEY = 'wae_neon_rider_v19_raid_profile';
const ROLE_KEY = 'wae_neon_rider_v18_role';
const TICK_MS = 90;
const MAX_RESOLVED_ATTACKS = 28;

const RAID_DEFS = Object.freeze({
  helix: Object.freeze({
    id: 'helix', name: 'HELIX WARDEN', title: 'GUARDIÁN DEL VACÍO', relic: 'HELIX PRISM', accent: 0x22d3ee,
    phases: Object.freeze([
      Object.freeze({ name: 'SPIRAL LOCK', role: 'assault', attack: 'sweep', attackName: 'HELIX LANCE' }),
      Object.freeze({ name: 'DOUBLE HELIX', role: 'interceptor', attack: 'cross', attackName: 'VECTOR CROSS' }),
      Object.freeze({ name: 'ZERO-POINT CORE', role: 'support', attack: 'gate', attackName: 'NULL GATE' }),
    ]),
  }),
  forge: Object.freeze({
    id: 'forge', name: 'SOLAR FORGE', title: 'CORAZÓN DE LA TORMENTA', relic: 'SOLAR HEART', accent: 0xf97316,
    phases: Object.freeze([
      Object.freeze({ name: 'IGNITION', role: 'vanguard', attack: 'gate', attackName: 'SOLAR WALL' }),
      Object.freeze({ name: 'CORONA BURST', role: 'assault', attack: 'sweep', attackName: 'CORONA BEAM' }),
      Object.freeze({ name: 'SUPERNOVA', role: 'support', attack: 'cross', attackName: 'STARFIRE CROSS' }),
    ]),
  }),
  seer: Object.freeze({
    id: 'seer', name: 'RIFT SEER', title: 'ORÁCULO DE LA FALLA', relic: 'RIFT EYE', accent: 0xd946ef,
    phases: Object.freeze([
      Object.freeze({ name: 'FORETELL', role: 'interceptor', attack: 'sweep', attackName: 'PROPHECY CUT' }),
      Object.freeze({ name: 'FRACTURE', role: 'support', attack: 'gate', attackName: 'RIFT GATE' }),
      Object.freeze({ name: 'PARADOX', role: 'assault', attack: 'cross', attackName: 'PARADOX CROSS' }),
    ]),
  }),
  bastion: Object.freeze({
    id: 'bastion', name: 'VERDANT BASTION', title: 'FORTALEZA VIVIENTE', relic: 'BASTION SEED', accent: 0x34d399,
    phases: Object.freeze([
      Object.freeze({ name: 'ROOT ARMOR', role: 'vanguard', attack: 'cross', attackName: 'ROOT CRUSH' }),
      Object.freeze({ name: 'THORN CROWN', role: 'assault', attack: 'gate', attackName: 'THORN WALL' }),
      Object.freeze({ name: 'LIVING CITADEL', role: 'interceptor', attack: 'sweep', attackName: 'EMERALD LANCE' }),
    ]),
  }),
});

const RARITIES = Object.freeze([
  Object.freeze({ id: 'rare', name: 'RARE', rank: 1, shards: 1 }),
  Object.freeze({ id: 'epic', name: 'EPIC', rank: 2, shards: 2 }),
  Object.freeze({ id: 'legendary', name: 'LEGENDARY', rank: 3, shards: 4 }),
  Object.freeze({ id: 'mythic', name: 'MYTHIC', rank: 4, shards: 7 }),
]);

const raid = {
  active: null,
  wrappers: new Map(),
  resolvedAttacks: new Set(),
  visualBoss: null,
  tickTimer: 0,
  lastGameState: '',
  lastSector: 1,
};

function game() {
  return window.__waeNeonRiderGame;
}

function roomFromUrl() {
  return String(new URLSearchParams(location.search).get('squad') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function isNetworkSession() {
  return roomFromUrl().length >= 4;
}

function isAuthority() {
  if (!isNetworkSession()) return true;
  return /HOST AUTHORITY/i.test($('[data-v17-role]')?.textContent || '');
}

function guardianId() {
  const id = String(game()?.currentGuardian?.id || '').toLowerCase();
  return RAID_DEFS[id] ? id : 'helix';
}

function raidDef(id = guardianId()) {
  return RAID_DEFS[id] || RAID_DEFS.helix;
}

function localRole() {
  const value = String(localStorage.getItem(ROLE_KEY) || 'assault').toLowerCase();
  return ['assault', 'vanguard', 'support', 'interceptor'].includes(value) ? value : 'assault';
}

function activeRoles() {
  const roles = new Set([localRole()]);
  for (const span of $$('#v18-squad-hud .v18-peer-list article span')) {
    const text = String(span.textContent || '').toLowerCase();
    for (const role of ['assault', 'vanguard', 'support', 'interceptor']) if (text.includes(role)) roles.add(role);
  }
  return roles;
}

function activePilotCount() {
  const count = $$('#v18-squad-hud .v18-peer-list article:not(.downed)').length;
  return clamp(count || 1, 1, 4);
}

function loadProfile() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
    return {
      raids: Math.max(0, Math.floor(Number(parsed.raids) || 0)),
      shards: Math.max(0, Math.floor(Number(parsed.shards) || 0)),
      streak: Math.max(0, Math.floor(Number(parsed.streak) || 0)),
      bestStreak: Math.max(0, Math.floor(Number(parsed.bestStreak) || 0)),
      inventory: parsed.inventory && typeof parsed.inventory === 'object' ? parsed.inventory : {},
      guardians: parsed.guardians && typeof parsed.guardians === 'object' ? parsed.guardians : {},
      history: Array.isArray(parsed.history) ? parsed.history.slice(0, 12) : [],
    };
  } catch {
    return { raids: 0, shards: 0, streak: 0, bestStreak: 0, inventory: {}, guardians: {}, history: [] };
  }
}

function saveProfile(profile) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch {}
}

function hashSeed(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rollLoot(summary) {
  const playerId = sessionStorage.getItem('wae_neon_rider_player_id') || 'solo';
  const seed = hashSeed(`${summary.guardianId}|${summary.sector}|${summary.startedAt}|${playerId}`);
  const roll = seed % 10000 / 100;
  const skillBoost = Math.min(16, summary.perfectEvades * 1.7 + summary.sector * 0.55 + (summary.resonance ? 4 : 0));
  let rarity = RARITIES[0];
  if (roll < 4 + skillBoost * 0.26) rarity = RARITIES[3];
  else if (roll < 15 + skillBoost * 0.55) rarity = RARITIES[2];
  else if (roll < 42 + skillBoost) rarity = RARITIES[1];
  const def = raidDef(summary.guardianId);
  return {
    id: `${def.id}-${rarity.id}`,
    guardianId: def.id,
    guardian: def.name,
    relic: def.relic,
    rarity: rarity.id,
    rarityName: rarity.name,
    rarityRank: rarity.rank,
    shards: rarity.shards + Math.min(3, Math.floor(summary.sector / 4)),
    perfectEvades: summary.perfectEvades,
    sector: summary.sector,
    at: Date.now(),
  };
}

function grantLoot(summary) {
  if (summary.lootGranted) return null;
  summary.lootGranted = true;
  const drop = rollLoot(summary);
  const profile = loadProfile();
  const existing = profile.inventory[drop.guardianId] || { relic: drop.relic, count: 0, bestRarityRank: 0, bestRarity: '—' };
  existing.count = Math.max(0, Number(existing.count) || 0) + 1;
  if (drop.rarityRank >= (Number(existing.bestRarityRank) || 0)) {
    existing.bestRarityRank = drop.rarityRank;
    existing.bestRarity = drop.rarityName;
  }
  profile.inventory[drop.guardianId] = existing;
  profile.raids += 1;
  profile.shards += drop.shards;
  profile.streak += 1;
  profile.bestStreak = Math.max(profile.bestStreak, profile.streak);
  const guardian = profile.guardians[drop.guardianId] || { kills: 0, bestRarityRank: 0, bestRarity: '—' };
  guardian.kills += 1;
  if (drop.rarityRank >= guardian.bestRarityRank) {
    guardian.bestRarityRank = drop.rarityRank;
    guardian.bestRarity = drop.rarityName;
  }
  profile.guardians[drop.guardianId] = guardian;
  profile.history = [drop, ...profile.history].slice(0, 12);
  saveProfile(profile);
  showLoot(drop, profile);
  return drop;
}

function resetRaidStreak() {
  const profile = loadProfile();
  if (!profile.streak) return;
  profile.streak = 0;
  saveProfile(profile);
}

function ensureRaidHud() {
  let hud = $('#v19-raid-hud');
  if (hud) return hud;
  hud = document.createElement('aside');
  hud.id = 'v19-raid-hud';
  hud.className = 'v19-raid-hud hidden';
  hud.innerHTML = `
    <div class="v19-raid-head">
      <div><span>BOSS RAID</span><strong data-v19-guardian>GUARDIÁN</strong></div>
      <b data-v19-phase>PHASE I</b>
    </div>
    <div class="v19-raid-bars">
      <div><span>ARMOR / CORE</span><strong data-v19-core-label>ARMORED</strong></div>
      <i><b data-v19-core-fill></b></i>
    </div>
    <div class="v19-raid-grid">
      <div><span>MECHANIC</span><strong data-v19-mechanic>—</strong></div>
      <div><span>RESONANCE</span><strong data-v19-resonance>—</strong></div>
      <div><span>EVADE</span><strong data-v19-evades>0</strong></div>
    </div>
    <small data-v19-raid-status>COMBAT DIRECTOR ONLINE</small>`;
  $('#app')?.append(hud);
  return hud;
}

function ensureTelegraph() {
  let layer = $('#v19-telegraph');
  if (layer) return layer;
  layer = document.createElement('div');
  layer.id = 'v19-telegraph';
  layer.className = 'v19-telegraph hidden';
  layer.innerHTML = `
    <div class="v19-telegraph__label"><span>RAID TELEGRAPH</span><strong data-v19-attack-name>INCOMING</strong><b data-v19-countdown>0.0</b></div>
    <div class="v19-danger v19-danger-a"></div>
    <div class="v19-danger v19-danger-b"></div>
    <div class="v19-safe-zone"><span>SAFE VECTOR</span></div>`;
  document.body.append(layer);
  return layer;
}

function ensureLootModal() {
  let modal = $('#v19-loot-modal');
  if (modal) return modal;
  modal = document.createElement('section');
  modal.id = 'v19-loot-modal';
  modal.className = 'v19-modal hidden';
  modal.innerHTML = `
    <div class="v19-modal-card v19-loot-card" role="dialog" aria-modal="true" aria-label="Raid loot">
      <button type="button" class="v19-modal-close" data-v19-close>×</button>
      <span class="v19-kicker">RAID CLEARED · PERSONAL DROP</span>
      <div class="v19-relic-glyph">◇</div>
      <h2 data-v19-loot-name>RELIC</h2>
      <strong data-v19-loot-rarity>RARE</strong>
      <p data-v19-loot-meta>GUARDIAN RELIC</p>
      <div class="v19-loot-metrics"><div><span>RAID SHARDS</span><b data-v19-loot-shards>+1</b></div><div><span>PERFECT EVADES</span><b data-v19-loot-evades>0</b></div></div>
      <button type="button" class="v19-primary" data-v19-open-archive>ABRIR RAID ARCHIVE</button>
    </div>`;
  document.body.append(modal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal || event.target.closest('[data-v19-close]')) modal.classList.add('hidden');
    if (event.target.closest('[data-v19-open-archive]')) {
      modal.classList.add('hidden');
      openRaidArchive();
    }
  });
  return modal;
}

function ensureArchiveModal() {
  let modal = $('#v19-archive-modal');
  if (modal) return modal;
  modal = document.createElement('section');
  modal.id = 'v19-archive-modal';
  modal.className = 'v19-modal hidden';
  modal.innerHTML = `
    <div class="v19-modal-card v19-archive-card" role="dialog" aria-modal="true" aria-label="Raid Archive">
      <button type="button" class="v19-modal-close" data-v19-close>×</button>
      <span class="v19-kicker">WAE COMBAT DIRECTOR</span>
      <h2>RAID ARCHIVE</h2>
      <div class="v19-archive-metrics"><div><span>RAIDS</span><strong data-v19-archive-raids>0</strong></div><div><span>SHARDS</span><strong data-v19-archive-shards>0</strong></div><div><span>BEST STREAK</span><strong data-v19-archive-streak>0</strong></div></div>
      <div class="v19-relic-list" data-v19-relic-list></div>
      <div class="v19-drop-history" data-v19-drop-history></div>
    </div>`;
  document.body.append(modal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal || event.target.closest('[data-v19-close]')) modal.classList.add('hidden');
  });
  return modal;
}

function showLoot(drop, profile) {
  const modal = ensureLootModal();
  modal.classList.remove('hidden');
  modal.dataset.rarity = drop.rarity;
  $('[data-v19-loot-name]', modal).textContent = drop.relic;
  $('[data-v19-loot-rarity]', modal).textContent = drop.rarityName;
  $('[data-v19-loot-meta]', modal).textContent = `${drop.guardian} · SECTOR ${drop.sector} · STREAK ${profile.streak}`;
  $('[data-v19-loot-shards]', modal).textContent = `+${drop.shards}`;
  $('[data-v19-loot-evades]', modal).textContent = String(drop.perfectEvades);
}

export function openRaidArchive() {
  const modal = ensureArchiveModal();
  const profile = loadProfile();
  $('[data-v19-archive-raids]', modal).textContent = profile.raids.toLocaleString('es-MX');
  $('[data-v19-archive-shards]', modal).textContent = profile.shards.toLocaleString('es-MX');
  $('[data-v19-archive-streak]', modal).textContent = profile.bestStreak.toLocaleString('es-MX');
  const list = $('[data-v19-relic-list]', modal);
  list.replaceChildren(...Object.values(RAID_DEFS).map((def) => {
    const item = profile.inventory[def.id] || { count: 0, bestRarity: '—' };
    const node = document.createElement('article');
    node.innerHTML = '<i>◇</i><div><strong></strong><span></span></div><b></b>';
    node.querySelector('strong').textContent = def.relic;
    node.querySelector('span').textContent = `${def.name} · BEST ${item.bestRarity || '—'}`;
    node.querySelector('b').textContent = `×${Math.max(0, Number(item.count) || 0)}`;
    return node;
  }));
  const history = $('[data-v19-drop-history]', modal);
  history.replaceChildren(...profile.history.slice(0, 6).map((drop) => {
    const node = document.createElement('div');
    node.innerHTML = '<span></span><strong></strong><b></b>';
    node.querySelector('span').textContent = drop.rarityName || 'RARE';
    node.querySelector('strong').textContent = drop.relic || 'RELIC';
    node.querySelector('b').textContent = `S${drop.sector || 1}`;
    return node;
  }));
  modal.classList.remove('hidden');
}

function findRemoteBoss() {
  const g = game();
  if (!g?.scene) return null;
  let found = null;
  g.scene.traverse((object) => {
    if (!found && typeof object.name === 'string' && object.name.startsWith('V17_boss_')) found = object;
  });
  return found;
}

function currentBoss() {
  const g = game();
  if (g?.boss?.parent) return { object: g.boss, remote: false };
  const shadow = findRemoteBoss();
  return shadow ? { object: shadow, remote: true } : null;
}

function bossStats(ref) {
  if (!ref?.object) return null;
  const data = ref.remote ? ref.object.userData?.v17 : ref.object.userData;
  if (!data) return null;
  const hp = Math.max(0, Number(data.hp) || 0);
  const maxHp = Math.max(1, Number(data.maxHp) || 1);
  return { hp, maxHp, percent: clamp(hp / maxHp, 0, 1), data };
}

function phaseForPercent(percent) {
  if (percent <= 0.34) return 3;
  if (percent <= 0.68) return 2;
  return 1;
}

function phaseRoman(phase) {
  return ['I', 'II', 'III'][clamp(phase, 1, 3) - 1];
}

function raidElapsed() {
  const g = game();
  return Math.max(0, Number(g?.sectorTime) - Number(COMBAT_CONFIG.boss.sectorSeconds || 42));
}

function deterministicFloat(seedText, slot = 0) {
  return ((hashSeed(`${seedText}|${slot}`) % 10000) / 10000);
}

function attackState(active, stats) {
  const phase = phaseForPercent(stats.percent);
  const def = raidDef(active.guardianId);
  const phaseDef = def.phases[phase - 1];
  const elapsed = raidElapsed();
  const interval = [7.2, 5.9, 4.7][phase - 1];
  const lead = [2.15, 1.78, 1.46][phase - 1];
  const exposure = [2.5, 2.8, 3.1][phase - 1];
  const cycle = Math.max(0, Math.floor(elapsed / interval));
  const cycleTime = elapsed - cycle * interval;
  const seed = `${active.guardianId}|${active.sector}|${phase}|${cycle}`;
  return {
    id: `${active.sector}-${phase}-${cycle}`,
    kind: phaseDef.attack,
    name: phaseDef.attackName,
    phase,
    cycle,
    cycleTime,
    lead,
    interval,
    requiredRole: phaseDef.role,
    mechanic: phaseDef.name,
    telegraphing: cycleTime < lead,
    resolving: cycleTime >= lead && cycleTime < lead + 0.24,
    vulnerable: cycleTime >= lead + 0.24 && cycleTime < lead + 0.24 + exposure,
    countdown: Math.max(0, lead - cycleTime),
    damage: [17, 23, 30][phase - 1],
    laneX: -10.5 + deterministicFloat(seed, 1) * 21,
    laneY: -5.8 + deterministicFloat(seed, 2) * 11.6,
    width: [3.3, 2.9, 2.55][phase - 1],
  };
}

function ensureActiveRaid(ref, stats) {
  const g = game();
  const sector = Math.max(1, Math.floor(Number(g?.sector) || 1));
  const id = guardianId();
  if (raid.active && raid.active.sector === sector && raid.active.guardianId === id) return raid.active;
  const def = raidDef(id);
  raid.active = {
    guardianId: id,
    sector,
    startedAt: Date.now(),
    phase: phaseForPercent(stats.percent),
    lastHp: stats.hp,
    lastMaxHp: stats.maxHp,
    perfectEvades: 0,
    hitsTaken: 0,
    resonance: false,
    lootGranted: false,
  };
  raid.resolvedAttacks.clear();
  g?.callbacks?.onAnnounce?.(`${def.name} · RAID PROTOCOL ACTIVE`);
  g?.triggerCinematic?.('boss-phase', 0.18);
  return raid.active;
}

function attachWeakpoints(ref, def) {
  const boss = ref?.object;
  if (!boss || boss.userData.v19Weakpoints) return boss?.userData?.v19Weakpoints || null;
  const root = new THREE.Group();
  root.name = 'WAE_V19_WEAKPOINTS';
  const glow = new THREE.MeshBasicMaterial({ color: def.accent, transparent: true, opacity: 0.5, depthWrite: false });
  const core = new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: def.accent, emissiveIntensity: 0.8, metalness: 0.72, roughness: 0.2 });
  const positions = [[-2.45, 0.2, 0.8], [2.45, 0.2, 0.8], [0, 2.25, 0.15]];
  for (const [x, y, z] of positions) {
    const point = new THREE.Group();
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), core.clone());
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.045, 6, 26), glow.clone());
    ring.rotation.x = Math.PI / 2;
    point.position.set(x, y, z);
    point.add(orb, ring);
    root.add(point);
  }
  boss.add(root);
  boss.userData.v19Weakpoints = root;
  return root;
}

function syncWeakpoints(ref, attack, resonance) {
  const def = raidDef(raid.active?.guardianId);
  const root = attachWeakpoints(ref, def);
  if (!root) return;
  const exposed = attack.vulnerable;
  root.rotation.z += exposed ? 0.035 : 0.012;
  root.scale.setScalar(exposed ? 1.16 : 0.9 + Math.sin(performance.now() * 0.004) * 0.035);
  for (const point of root.children) {
    const orb = point.children[0];
    const ring = point.children[1];
    if (orb?.material) orb.material.emissiveIntensity = exposed ? (resonance ? 2.6 : 1.9) : 0.55;
    if (ring?.material) ring.material.opacity = exposed ? 0.95 : 0.28;
    if (ring) ring.rotation.z += exposed ? 0.08 : 0.025;
  }
}

function teamHasRole(role) {
  return activeRoles().has(role);
}

function applyHostDamageTuning(active, stats, attack) {
  if (!isAuthority() || !game()?.boss || !active) return;
  const boss = game().boss;
  const currentHp = Math.max(0, Number(boss.userData.hp) || 0);
  if (!Number.isFinite(active.lastHp)) active.lastHp = currentHp;
  const rawDamage = active.lastHp - currentHp;
  const resonance = teamHasRole(attack.requiredRole);
  active.resonance = resonance;
  if (rawDamage > 0.0001) {
    if (attack.vulnerable) {
      const extra = rawDamage * (resonance ? 0.8 : 0.45);
      boss.userData.hp = Math.max(0, currentHp - extra);
    } else {
      const refund = rawDamage * (resonance ? 0.48 : 0.68);
      boss.userData.hp = Math.min(Number(boss.userData.maxHp) || stats.maxHp, currentHp + refund);
    }
  }
  active.lastHp = Math.max(0, Number(boss.userData.hp) || 0);
  active.lastMaxHp = Math.max(1, Number(boss.userData.maxHp) || stats.maxHp);
}

function localAttackHit(attack) {
  const ship = game()?.ship;
  if (!ship) return false;
  const x = Number(ship.position.x) || 0;
  const y = Number(ship.position.y) || 0;
  if (attack.kind === 'sweep') return Math.abs(x - attack.laneX) <= attack.width;
  if (attack.kind === 'cross') return Math.abs(x - attack.laneX * 0.32) <= attack.width || Math.abs(y - attack.laneY * 0.28) <= attack.width * 0.72;
  if (attack.kind === 'gate') return Math.abs(y - attack.laneY) > attack.width;
  return false;
}

function resolveAttack(active, attack) {
  const g = game();
  if (!g || g.state !== 'playing' || raid.resolvedAttacks.has(attack.id)) return;
  raid.resolvedAttacks.add(attack.id);
  if (raid.resolvedAttacks.size > MAX_RESOLVED_ATTACKS) raid.resolvedAttacks.delete(raid.resolvedAttacks.values().next().value);
  if (localAttackHit(attack)) {
    active.hitsTaken += 1;
    g.damageShip?.(attack.damage, g.ship?.position?.clone?.());
    g.callbacks?.onAnnounce?.(`${attack.name} · IMPACTO`);
    navigator.vibrate?.([35, 25, 55]);
  } else {
    active.perfectEvades += 1;
    g.addHeat?.(7 + attack.phase * 2);
    g.callbacks?.onAnnounce?.(`PERFECT EVADE · ${attack.name}`);
  }
}

function renderTelegraph(attack) {
  const layer = ensureTelegraph();
  const active = Boolean(raid.active && currentBoss());
  if (!active || (!attack.telegraphing && !attack.vulnerable)) {
    layer.classList.add('hidden');
    return;
  }
  layer.classList.remove('hidden', 'sweep', 'cross', 'gate', 'exposed');
  layer.classList.add(attack.vulnerable ? 'exposed' : attack.kind);
  const xPct = clamp((attack.laneX + 16) / 32 * 100, 5, 95);
  const yPct = clamp((9.5 - attack.laneY) / 19 * 100, 8, 92);
  layer.style.setProperty('--v19-x', `${xPct}%`);
  layer.style.setProperty('--v19-y', `${yPct}%`);
  layer.style.setProperty('--v19-width', `${clamp(attack.width / 32 * 100, 6, 18)}%`);
  $('[data-v19-attack-name]', layer).textContent = attack.vulnerable ? 'CORE EXPOSED · FIRE NOW' : attack.name;
  $('[data-v19-countdown]', layer).textContent = attack.vulnerable ? 'VULNERABLE' : `${attack.countdown.toFixed(1)}s`;
}

function renderRaidHud(ref, stats, active, attack) {
  const hud = ensureRaidHud();
  if (!ref || !active || !stats) {
    hud.classList.add('hidden');
    ensureTelegraph().classList.add('hidden');
    return;
  }
  const def = raidDef(active.guardianId);
  const phaseDef = def.phases[attack.phase - 1];
  const resonance = teamHasRole(attack.requiredRole);
  active.resonance = resonance;
  hud.classList.remove('hidden');
  hud.style.setProperty('--v19-accent', `#${new THREE.Color(def.accent).getHexString()}`);
  $('[data-v19-guardian]', hud).textContent = def.name;
  $('[data-v19-phase]', hud).textContent = `PHASE ${phaseRoman(attack.phase)}`;
  $('[data-v19-mechanic]', hud).textContent = phaseDef.name;
  $('[data-v19-resonance]', hud).textContent = `${attack.requiredRole.toUpperCase()} · ${resonance ? 'LINKED' : 'BONUS'}`;
  $('[data-v19-evades]', hud).textContent = String(active.perfectEvades);
  const coreLabel = $('[data-v19-core-label]', hud);
  const coreFill = $('[data-v19-core-fill]', hud);
  if (attack.vulnerable) {
    coreLabel.textContent = resonance ? 'EXPOSED · RESONANCE x1.8' : 'EXPOSED · x1.45';
    coreFill.style.width = '100%';
    hud.classList.add('vulnerable');
  } else {
    coreLabel.textContent = resonance ? 'ARMOR · ROLE RESONANCE' : 'ARMORED';
    coreFill.style.width = `${Math.round(stats.percent * 100)}%`;
    hud.classList.remove('vulnerable');
  }
  $('[data-v19-raid-status]', hud).textContent = attack.telegraphing ? `EVADE ${attack.name} · ${attack.countdown.toFixed(1)}s` : attack.vulnerable ? 'WEAK POINTS OPEN · MAXIMUM DAMAGE WINDOW' : `${def.title} · COMBAT DIRECTOR ACTIVE`;
  renderTelegraph(attack);
}

function phaseChanged(active, phase) {
  if (active.phase === phase) return;
  active.phase = phase;
  const def = raidDef(active.guardianId);
  const phaseDef = def.phases[phase - 1];
  const g = game();
  if (g?.boss?.userData) g.boss.userData.phase = phase;
  g?.callbacks?.onAnnounce?.(`RAID PHASE ${phaseRoman(phase)} · ${phaseDef.name}`);
  g?.triggerCinematic?.('boss-phase', 0.22);
  navigator.vibrate?.([45, 35, 70]);
}

function raidSummary(active) {
  return {
    guardianId: active.guardianId,
    sector: active.sector,
    startedAt: active.startedAt,
    perfectEvades: active.perfectEvades,
    hitsTaken: active.hitsTaken,
    resonance: active.resonance,
    lootGranted: active.lootGranted,
  };
}

function finalizeRaid(active) {
  if (!active || active.lootGranted) return;
  const summary = raidSummary(active);
  const drop = grantLoot(summary);
  active.lootGranted = true;
  if (drop) game()?.callbacks?.onAnnounce?.(`${drop.rarityName} RELIC · ${drop.relic} · +${drop.shards} SHARDS`);
  raid.active = null;
  ensureRaidHud().classList.add('hidden');
  ensureTelegraph().classList.add('hidden');
}

function wrapGameMethod(name, factory) {
  const g = game();
  if (!g || typeof g[name] !== 'function' || !isAuthority()) return;
  const current = g[name];
  if (current.__waeV19) return;
  const wrapped = factory(current.bind(g));
  Object.defineProperty(wrapped, '__waeV19', { value: true });
  g[name] = wrapped;
  raid.wrappers.set(name, wrapped);
}

function installHooks() {
  if (!isAuthority()) return;
  wrapGameMethod('spawnBoss', (base) => (...args) => {
    const result = base(...args);
    const ref = currentBoss();
    const stats = bossStats(ref);
    if (ref && !ref.remote && stats) {
      const pilots = activePilotCount();
      const multiplier = 1.22 + (pilots - 1) * 0.08;
      const boss = ref.object;
      if (!boss.userData.v19RaidScaled) {
        boss.userData.v19RaidScaled = true;
        boss.userData.maxHp = Math.max(1, Math.ceil((Number(boss.userData.maxHp) || stats.maxHp) * multiplier));
        boss.userData.hp = boss.userData.maxHp;
      }
      ensureActiveRaid(ref, bossStats(ref));
    }
    return result;
  });

  wrapGameMethod('updateBoss', (base) => (delta, ...args) => {
    const result = base(delta, ...args);
    const ref = currentBoss();
    const stats = bossStats(ref);
    if (ref && !ref.remote && stats) {
      const active = ensureActiveRaid(ref, stats);
      const attack = attackState(active, stats);
      phaseChanged(active, attack.phase);
      applyHostDamageTuning(active, stats, attack);
      if (attack.resolving) resolveAttack(active, attack);
    }
    return result;
  });

  wrapGameMethod('defeatBoss', (base) => (...args) => {
    const ref = currentBoss();
    const stats = bossStats(ref);
    if (raid.active && ref && !ref.remote && stats) {
      const attack = attackState(raid.active, stats);
      if (!attack.vulnerable) {
        ref.object.userData.hp = Math.max(1, Math.ceil(ref.object.userData.maxHp * 0.035));
        raid.active.lastHp = ref.object.userData.hp;
        game()?.callbacks?.onAnnounce?.('FINAL CORE SEALED · EVADE TO EXPOSE');
        return false;
      }
      const summary = raidSummary(raid.active);
      const result = base(...args);
      grantLoot(summary);
      raid.active.lootGranted = true;
      raid.active = null;
      ensureRaidHud().classList.add('hidden');
      ensureTelegraph().classList.add('hidden');
      return result;
    }
    return base(...args);
  });
}

function syncRaid() {
  const g = game();
  if (!g) return;
  installHooks();
  const ref = currentBoss();
  const stats = bossStats(ref);

  if (ref && stats) {
    const active = ensureActiveRaid(ref, stats);
    const attack = attackState(active, stats);
    phaseChanged(active, attack.phase);
    if (attack.resolving) resolveAttack(active, attack);
    syncWeakpoints(ref, attack, teamHasRole(attack.requiredRole));
    renderRaidHud(ref, stats, active, attack);
  } else {
    if (raid.active && Number(g.sector) > Number(raid.active.sector)) finalizeRaid(raid.active);
    if (!raid.active) {
      ensureRaidHud().classList.add('hidden');
      ensureTelegraph().classList.add('hidden');
    }
  }

  if (g.state === 'gameover' && raid.lastGameState !== 'gameover' && raid.active) resetRaidStreak();
  raid.lastGameState = g.state;
  raid.lastSector = Math.max(1, Math.floor(Number(g.sector) || 1));
}

ensureRaidHud();
ensureTelegraph();
ensureLootModal();
ensureArchiveModal();
installHooks();
window.clearInterval(raid.tickTimer);
raid.tickTimer = window.setInterval(syncRaid, TICK_MS);
