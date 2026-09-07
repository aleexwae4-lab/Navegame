import * as THREE from 'three';
import { NeonRiderGame as RogueGame } from '../v6/game.js';
import { CONFIG as V6_CONFIG } from '../v6/config.js';
import { CONFIG, CONTRACTS, GUARDIANS, RARE_EVENTS } from './config.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function readJson(key) {
  try { return JSON.parse(localStorage.getItem(key) ?? '{}'); }
  catch { return {}; }
}

function mergeProfile(base) {
  const saved = readJson(CONFIG.profileKey);
  if (!Object.keys(saved).length) return { ...base, eliteKills: base.eliteKills ?? 0, guardiansDefeated: base.guardiansDefeated ?? 0 };
  return {
    ...base,
    ...saved,
    unlockedShips: Array.isArray(saved.unlockedShips) ? saved.unlockedShips : base.unlockedShips,
    unlockedWeapons: Array.isArray(saved.unlockedWeapons) ? saved.unlockedWeapons : base.unlockedWeapons,
    eliteKills: Number.isFinite(saved.eliteKills) ? Math.max(0, Math.floor(saved.eliteKills)) : 0,
    guardiansDefeated: Number.isFinite(saved.guardiansDefeated) ? Math.max(0, Math.floor(saved.guardiansDefeated)) : 0,
  };
}

export class NeonRiderGame extends RogueGame {
  constructor(container, callbacks = {}) {
    super(container, callbacks);
    this.profile = mergeProfile(this.profile);
    this.eliteRegistry = new Map();
    this.pendingRoutes = [];
    this.sectorContract = CONTRACTS.stable;
    this.dashCooldown = 0;
    this.eventTriggered = false;
    this.currentGuardian = GUARDIANS[this.currentBiome?.id] ?? GUARDIANS['cyan-void'];
  }

  saveProfile() {
    const payload = JSON.stringify(this.profile);
    localStorage.setItem(CONFIG.profileKey, payload);
    localStorage.setItem(V6_CONFIG.profileKey, payload);
  }

  metaSnapshot() {
    return {
      ...super.metaSnapshot(),
      eliteKills: this.profile.eliteKills ?? 0,
      guardiansDefeated: this.profile.guardiansDefeated ?? 0,
    };
  }

  resetEngagementState() {
    super.resetEngagementState();
    this.pendingRoutes = [];
    this.sectorContract = CONTRACTS.stable;
    this.dashCooldown = 0;
    this.eventTriggered = false;
    this.eliteRegistry?.clear?.();
    this.currentGuardian = GUARDIANS[this.currentBiome?.id] ?? GUARDIANS['cyan-void'];
  }

  snapshot() {
    const state = super.snapshot();
    return {
      ...state,
      guardian: this.boss ? {
        id: this.currentGuardian?.id,
        name: this.currentGuardian?.name,
        title: this.currentGuardian?.title,
      } : null,
      dash: {
        ready: this.dashCooldown <= 0,
        cooldown: Math.max(0, this.dashCooldown),
        percent: clamp((1 - this.dashCooldown / CONFIG.dash.cooldown) * 100, 0, 100),
      },
      contract: this.sectorContract,
      route: { pending: [...(this.pendingRoutes ?? [])] },
      meta: this.metaSnapshot(),
    };
  }

  createReusableResources() {
    super.createReusableResources();
    this.resources.eliteRingGeometry = new THREE.TorusGeometry(1.62, 0.1, 8, 28);
    this.resources.eliteRingMaterial = new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.9 });
  }

  applyBiome(sector = this.sector) {
    super.applyBiome(sector);
    this.currentGuardian = GUARDIANS[this.currentBiome?.id] ?? GUARDIANS['cyan-void'];
    this.callbacks.onGuardian?.(this.currentGuardian);
  }

  promoteElite(drone) {
    if (!drone || drone.userData.elite) return drone;
    const id = `elite-${performance.now().toFixed(2)}-${Math.random().toString(16).slice(2)}`;
    drone.userData.elite = true;
    drone.userData.eliteId = id;
    drone.userData.hp = Math.max(2, Math.ceil(drone.userData.hp * CONFIG.elite.hpMultiplier));
    drone.scale.multiplyScalar(CONFIG.elite.scale);
    const ring = new THREE.Mesh(this.resources.eliteRingGeometry, this.resources.eliteRingMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.z = 0.1;
    drone.add(ring);
    this.eliteRegistry.set(id, drone.position.clone());
    this.callbacks.onAnnounce?.('CONTACTO ÉLITE · RECOMPENSA AUMENTADA');
    return drone;
  }

  spawnDrone(forceElite = false) {
    super.spawnDrone();
    const drone = this.drones[this.drones.length - 1];
    if (!drone || this.sector < CONFIG.elite.minSector) return;
    if (forceElite || Math.random() < (this.sectorContract?.eliteChance ?? 0)) this.promoteElite(drone);
  }

  syncEliteRegistry() {
    const active = new Set();
    for (const drone of this.drones) {
      const id = drone.userData.eliteId;
      if (!id) continue;
      active.add(id);
      this.eliteRegistry.set(id, drone.position.clone());
      const ring = drone.children[drone.children.length - 1];
      if (drone.userData.elite && ring) ring.rotation.z += 0.055;
    }
    for (const id of this.eliteRegistry.keys()) if (!active.has(id)) this.eliteRegistry.delete(id);
  }

  findEliteAt(position) {
    let match = null;
    let best = 8;
    for (const [id, elitePosition] of this.eliteRegistry.entries()) {
      const distance = elitePosition.distanceToSquared(position);
      if (distance < best) { best = distance; match = id; }
    }
    return match;
  }

  registerKill(position) {
    const before = this.score;
    super.registerKill(position);
    const gained = this.score - before;
    const multiplier = this.sectorContract?.scoreMultiplier ?? 1;
    if (gained > 0 && multiplier !== 1) this.score = Math.round(before + gained * multiplier);
    this.callbacks.onHud?.(this.snapshot());
  }

  registerDroneKill(position) {
    const eliteId = this.findEliteAt(position);
    const before = this.score;
    super.registerDroneKill(position);
    const gained = this.score - before;
    const multiplier = this.sectorContract?.scoreMultiplier ?? 1;
    if (gained > 0 && multiplier !== 1) this.score = Math.round(before + gained * multiplier);

    if (eliteId) {
      this.eliteRegistry.delete(eliteId);
      const rewardScale = this.sectorContract?.eliteReward ?? 1;
      const coreReward = Math.max(1, Math.round(CONFIG.elite.cores * rewardScale));
      this.score += Math.round(CONFIG.elite.score * rewardScale);
      this.profile.cores += coreReward;
      this.profile.eliteKills = (this.profile.eliteKills ?? 0) + 1;
      this.saveProfile();
      this.addHeat(22);
      this.callbacks.onAnnounce?.(`ÉLITE DESTRUIDO · +${coreReward} CORE${coreReward > 1 ? 'S' : ''}`);
      this.callbacks.onMeta?.(this.metaSnapshot());
    }
    this.callbacks.onHud?.(this.snapshot());
  }

  damageShip(damage, position) {
    super.damageShip(damage * (this.sectorContract?.damageMultiplier ?? 1), position);
  }

  activateDash() {
    if (this.state !== 'playing' || this.dashCooldown > 0) return false;
    let x = Number(this.input.right) - Number(this.input.left);
    let y = Number(this.input.up) - Number(this.input.down);
    if (x === 0 && y === 0) y = 1;
    const length = Math.hypot(x, y) || 1;
    x /= length;
    y /= length;
    const origin = this.ship.position.clone();
    this.ship.position.x = clamp(this.ship.position.x + x * CONFIG.dash.distance, CONFIG.world.xMin, CONFIG.world.xMax);
    this.ship.position.y = clamp(this.ship.position.y + y * CONFIG.dash.distance, CONFIG.world.yMin, CONFIG.world.yMax);
    this.invulnerabilityTimer = Math.max(this.invulnerabilityTimer ?? 0, CONFIG.dash.invulnerability);
    this.dashCooldown = CONFIG.dash.cooldown;
    this.createExplosion(origin, this.currentBiome?.accent ?? 0x67e8f9, 12);
    this.createExplosion(this.ship.position, this.currentBiome?.accent ?? 0x67e8f9, 16);
    this.cameraKick = Math.max(this.cameraKick, 0.52);
    navigator.vibrate?.(28);
    this.callbacks.onAnnounce?.('PHASE DASH');
    this.callbacks.onHud?.(this.snapshot());
    return true;
  }

  spawnBoss() {
    super.spawnBoss();
    if (!this.boss) return;
    this.currentGuardian = GUARDIANS[this.currentBiome?.id] ?? GUARDIANS['cyan-void'];
    const hp = Math.max(1, Math.round(this.boss.userData.maxHp * this.currentGuardian.hp));
    this.boss.userData.hp = hp;
    this.boss.userData.maxHp = hp;
    this.boss.userData.signatureTimer = 1.65;
    this.callbacks.onAnnounce?.(`${this.currentGuardian.name} · ${this.currentGuardian.title}`);
    this.callbacks.onGuardian?.(this.currentGuardian);
    this.callbacks.onHud?.(this.snapshot());
  }

  updateBoss(delta) {
    super.updateBoss(delta);
    if (!this.boss || this.boss.userData.entering || this.state !== 'playing') return;
    const boss = this.boss;
    boss.userData.signatureTimer -= delta;
    if (boss.userData.signatureTimer > 0) return;

    const phase = boss.userData.phase ?? 1;
    const guardian = this.currentGuardian ?? GUARDIANS['cyan-void'];
    const origin = boss.position.clone();
    const baseSpeed = CONFIG.boss.bulletSpeed + this.sector * 1.4 + phase * 2.2;

    if (guardian.id === 'helix') {
      this.fireEnemy(origin, baseSpeed * 1.35, 0.18);
      if (phase >= 2) this.fireEnemy(origin, baseSpeed * 1.15, 2.4);
    } else if (guardian.id === 'forge') {
      for (const spread of [2, 4, 6, 8, 11]) this.fireEnemy(origin, baseSpeed * 0.95, spread);
    } else if (guardian.id === 'seer') {
      this.fireEnemy(origin, baseSpeed * 0.72, 1.2);
      this.fireEnemy(origin, baseSpeed, 5.5);
      this.fireEnemy(origin, baseSpeed * 1.28, 8.5);
    } else if (guardian.id === 'bastion') {
      if (this.drones.length < CONFIG.drone.maxActive - 1) {
        this.spawnDrone(phase >= 2);
        this.spawnDrone(phase >= 3);
      }
      this.fireEnemy(origin, baseSpeed * 0.88, 5.2);
    }

    boss.userData.signatureTimer = Math.max(1.25, guardian.signature - phase * 0.3);
    this.callbacks.onAnnounce?.(`${guardian.name} · ATAQUE FIRMA`);
  }

  triggerRareEvent() {
    if (this.eventTriggered || this.boss || this.sectorTime < CONFIG.events.firstWindow) return;
    this.eventTriggered = true;
    if (Math.random() > CONFIG.events.chance) return;
    const event = RARE_EVENTS[Math.floor(Math.random() * RARE_EVENTS.length)];

    if (event.id === 'cache') {
      this.profile.cores += 1;
      this.addHeat(28);
      this.saveProfile();
      this.callbacks.onMeta?.(this.metaSnapshot());
    } else if (event.id === 'repair') {
      this.shield = Math.min(this.getMaxShield(), this.shield + this.getMaxShield() * 0.22);
    } else if (event.id === 'surge') {
      this.addHeat(CONFIG.heat.max);
    } else if (event.id === 'hunters') {
      if (this.drones.length < CONFIG.drone.maxActive - 1) {
        this.spawnDrone(true);
        this.spawnDrone(true);
      }
    }

    this.callbacks.onEvent?.(event);
    this.callbacks.onAnnounce?.(`${event.name} · ${event.description}`);
    this.callbacks.onHud?.(this.snapshot());
  }

  beginRouteSelection() {
    this.pendingRoutes = Object.keys(CONTRACTS);
    this.clearInput();
    this.state = 'route';
    const snapshot = this.snapshot();
    this.callbacks.onRoute?.({ choices: [...this.pendingRoutes], sector: this.sector });
    this.callbacks.onState?.('route', snapshot);
    this.callbacks.onHud?.(snapshot);
  }

  chooseRoute(id) {
    if (this.state !== 'route' || !this.pendingRoutes.includes(id) || !CONTRACTS[id]) return false;
    this.sectorContract = CONTRACTS[id];
    this.pendingRoutes = [];
    this.eventTriggered = false;
    if (this.sectorContract.repair > 0) {
      const max = this.getMaxShield();
      this.shield = Math.min(max, this.shield + max * this.sectorContract.repair);
    }
    this.state = 'playing';
    const snapshot = this.snapshot();
    this.callbacks.onRoute?.({ choices: [], sector: this.sector });
    this.callbacks.onState?.('playing', snapshot);
    this.callbacks.onAnnounce?.(`${this.sectorContract.name} · SECTOR ${this.sector}`);
    this.callbacks.onHud?.(snapshot);
    return true;
  }

  choosePerk(id) {
    const chosen = super.choosePerk(id);
    if (!chosen) return false;
    this.beginRouteSelection();
    return true;
  }

  defeatBoss() {
    const contract = this.sectorContract;
    super.defeatBoss();
    this.profile.guardiansDefeated = (this.profile.guardiansDefeated ?? 0) + 1;
    if (contract?.bossCores > 0) this.profile.cores += contract.bossCores;
    this.saveProfile();
    this.callbacks.onMeta?.(this.metaSnapshot());
    this.callbacks.onHud?.(this.snapshot());
  }

  async start() {
    await super.start();
    this.sectorContract = CONTRACTS.stable;
    this.dashCooldown = 0;
    this.eventTriggered = false;
    this.eliteRegistry.clear();
    this.applyBiome(this.sector);
    this.callbacks.onRoute?.({ choices: [], sector: this.sector });
    this.callbacks.onHud?.(this.snapshot());
  }

  updatePlaying(delta, elapsed) {
    this.dashCooldown = Math.max(0, this.dashCooldown - delta);
    super.updatePlaying(delta, elapsed);
    this.syncEliteRegistry();
    if (this.state !== 'playing') return;
    this.triggerRareEvent();
  }

  endGame() {
    this.saveProfile();
    super.endGame();
  }
}
