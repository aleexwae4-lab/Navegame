import * as THREE from 'three';
import { NeonRiderGame as LegendaryGame } from '../v7/game.js';
import { CONFIG as V7_CONFIG } from '../v7/config.js';
import { CINEMATIC_ENCOUNTERS, CONFIG, MINI_BOSSES } from './config.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function readJson(key) {
  try { return JSON.parse(localStorage.getItem(key) ?? '{}'); }
  catch { return {}; }
}

function mergeProfile(base) {
  const saved = readJson(CONFIG.profileKey);
  if (!Object.keys(saved).length) {
    return {
      ...base,
      minibossesDefeated: base.minibossesDefeated ?? 0,
      missilesFired: base.missilesFired ?? 0,
    };
  }
  return {
    ...base,
    ...saved,
    unlockedShips: Array.isArray(saved.unlockedShips) ? saved.unlockedShips : base.unlockedShips,
    unlockedWeapons: Array.isArray(saved.unlockedWeapons) ? saved.unlockedWeapons : base.unlockedWeapons,
    minibossesDefeated: Number.isFinite(saved.minibossesDefeated) ? Math.max(0, Math.floor(saved.minibossesDefeated)) : 0,
    missilesFired: Number.isFinite(saved.missilesFired) ? Math.max(0, Math.floor(saved.missilesFired)) : 0,
  };
}

export class NeonRiderGame extends LegendaryGame {
  constructor(container, callbacks = {}) {
    super(container, callbacks);
    this.profile = mergeProfile(this.profile);
    this.missiles = [];
    this.minibossRegistry = new Map();
    this.missileCooldown = 0;
    this.wingmanFireTimer = 0.55;
    this.cinematicTimer = 0;
    this.cinematicKind = '';
    this.minibossRollDone = false;
    this.encounterRollDone = false;
    this.activeEncounter = null;
  }

  saveProfile() {
    const payload = JSON.stringify(this.profile);
    localStorage.setItem(CONFIG.profileKey, payload);
    localStorage.setItem(V7_CONFIG.profileKey, payload);
  }

  metaSnapshot() {
    return {
      ...super.metaSnapshot(),
      minibossesDefeated: this.profile.minibossesDefeated ?? 0,
      missilesFired: this.profile.missilesFired ?? 0,
    };
  }

  resetEngagementState() {
    super.resetEngagementState();
    this.missileCooldown = 0;
    this.wingmanFireTimer = 0.55;
    this.cinematicTimer = 0;
    this.cinematicKind = '';
    this.minibossRollDone = false;
    this.encounterRollDone = false;
    this.activeEncounter = null;
    this.minibossRegistry?.clear?.();
  }

  snapshot() {
    const state = super.snapshot();
    return {
      ...state,
      missile: {
        ready: this.missileCooldown <= 0,
        cooldown: Math.max(0, this.missileCooldown),
        percent: clamp((1 - this.missileCooldown / CONFIG.missile.cooldown) * 100, 0, 100),
      },
      wingman: { active: Boolean(this.wingman) },
      cinematic: {
        active: this.cinematicTimer > 0,
        kind: this.cinematicKind,
      },
      miniboss: this.currentMinibossSnapshot(),
      encounter: this.activeEncounter,
      meta: this.metaSnapshot(),
    };
  }

  createReusableResources() {
    super.createReusableResources();
    this.resources.missileGeometry = new THREE.ConeGeometry(0.16, 1.35, 8);
    this.resources.missileGeometry.rotateX(-Math.PI / 2);
    this.resources.missileMaterial = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
    this.resources.missileGlowMaterial = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.86 });
    this.resources.wingmanGeometry = new THREE.OctahedronGeometry(0.42, 0);
    this.resources.wingmanMaterial = new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x0e7490, emissiveIntensity: 0.9, metalness: 0.78, roughness: 0.2 });
    this.resources.telegraphGeometry = new THREE.TorusGeometry(5.6, 0.09, 8, 54);
    this.resources.telegraphMaterial = new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.76, depthWrite: false });
    this.resources.minibossRingGeometry = new THREE.TorusGeometry(2.05, 0.12, 8, 32);
    this.resources.minibossRingMaterial = new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.9 });
  }

  createShip() {
    super.createShip();
    this.createWingman();
  }

  createWingman() {
    if (!this.ship || this.wingman) return;
    const wingman = new THREE.Group();
    wingman.name = 'v8-wingman';
    const core = new THREE.Mesh(this.resources.wingmanGeometry, this.resources.wingmanMaterial);
    core.scale.set(1.05, 0.72, 1.4);
    const glow = new THREE.PointLight(0x22d3ee, 2.4, 7, 2);
    wingman.add(core, glow);
    wingman.position.set(CONFIG.wingman.orbitRadius, 1.05, 0.6);
    this.ship.add(wingman);
    this.wingman = wingman;
  }

  clearEntities() {
    for (const missile of this.missiles ?? []) this.scene?.remove(missile);
    if (this.missiles) this.missiles.length = 0;
    this.minibossRegistry?.clear?.();
    super.clearEntities();
  }

  triggerCinematic(kind = 'impact', duration = CONFIG.cinematic.slowmoDuration) {
    this.cinematicKind = kind;
    this.cinematicTimer = Math.max(this.cinematicTimer, duration);
    this.cameraKick = Math.max(this.cameraKick ?? 0, kind === 'boss-phase' ? 0.8 : 0.52);
    this.callbacks.onCinematic?.({ kind, duration });
  }

  findTarget() {
    if (this.boss?.parent) return this.boss;
    let best = null;
    let bestScore = Infinity;
    for (const drone of this.drones) {
      if (!drone?.parent) continue;
      const priority = drone.userData.minibossId ? -220 : drone.userData.elite ? -110 : 0;
      const distance = drone.position.distanceToSquared(this.ship.position) + priority;
      if (distance < bestScore) { bestScore = distance; best = drone; }
    }
    return best;
  }

  activateMissile() {
    if (this.state !== 'playing' || this.missileCooldown > 0) return false;
    const target = this.findTarget();
    if (!target) {
      this.callbacks.onAnnounce?.('MISIL · SIN BLANCO');
      return false;
    }

    const missile = new THREE.Group();
    const body = new THREE.Mesh(this.resources.missileGeometry, this.resources.missileMaterial);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), this.resources.missileGlowMaterial);
    glow.position.z = 0.72;
    missile.add(body, glow);
    missile.position.copy(this.ship.position).add(new THREE.Vector3(0, -0.24, -1.7));
    missile.userData = {
      target,
      velocity: new THREE.Vector3(0, 0, -CONFIG.missile.speed),
      life: 4.5,
    };
    this.scene.add(missile);
    this.missiles.push(missile);
    this.missileCooldown = CONFIG.missile.cooldown;
    this.profile.missilesFired = (this.profile.missilesFired ?? 0) + 1;
    this.saveProfile();
    this.audio.play('laser');
    navigator.vibrate?.(22);
    this.callbacks.onAnnounce?.('MISIL WAE · BLOQUEO CONFIRMADO');
    this.callbacks.onHud?.(this.snapshot());
    return true;
  }

  damageTarget(target, droneDamage = CONFIG.missile.droneDamage, bossDamage = CONFIG.missile.bossDamage) {
    if (!target) return;
    if (target === this.boss) {
      target.userData.hp -= bossDamage;
      if (target.userData.hp <= 0) this.defeatBoss();
      return;
    }
    if (!this.drones.includes(target)) return;
    target.userData.hp -= droneDamage;
    if (target.userData.hp <= 0) {
      const position = target.position.clone();
      this.scene.remove(target);
      const index = this.drones.indexOf(target);
      if (index >= 0) this.drones.splice(index, 1);
      this.audio.play('explosion');
      this.createExplosion(position, 0x38bdf8, 18);
      this.registerDroneKill(position);
    }
  }

  updateMissiles(delta) {
    for (let i = this.missiles.length - 1; i >= 0; i -= 1) {
      const missile = this.missiles[i];
      missile.userData.life -= delta;
      let target = missile.userData.target;
      if (!target?.parent) {
        target = this.findTarget();
        missile.userData.target = target;
      }

      if (target) {
        const desired = target.position.clone().sub(missile.position).normalize().multiplyScalar(CONFIG.missile.speed);
        const turn = 1 - Math.exp(-CONFIG.missile.turnRate * delta);
        missile.userData.velocity.lerp(desired, turn);
        missile.lookAt(target.position);
      }
      missile.position.addScaledVector(missile.userData.velocity, delta);

      const hitRadius = target === this.boss ? (target?.userData?.radius ?? 4.4) + 0.7 : (target?.userData?.radius ?? 1.4) + 0.55;
      const impacted = target && missile.position.distanceToSquared(target.position) <= hitRadius * hitRadius;
      if (impacted) {
        const impact = missile.position.clone();
        this.createExplosion(impact, 0x7dd3fc, 26);
        this.audio.play('explosion');
        this.damageTarget(target);
        this.scene.remove(missile);
        this.missiles.splice(i, 1);
        this.triggerCinematic('missile-impact', 0.14);
        continue;
      }

      if (missile.userData.life <= 0 || missile.position.z < CONFIG.laser.lifetimeZ) {
        this.scene.remove(missile);
        this.missiles.splice(i, 1);
      }
    }
  }

  updateWingman(delta, elapsed) {
    if (!this.wingman || this.state !== 'playing') return;
    const radius = CONFIG.wingman.orbitRadius;
    const angle = elapsed * CONFIG.wingman.orbitSpeed;
    this.wingman.position.x = Math.cos(angle) * radius;
    this.wingman.position.y = 0.85 + Math.sin(angle * 1.35) * 0.82;
    this.wingman.position.z = 0.55 + Math.sin(angle) * 0.45;
    this.wingman.rotation.y += delta * 1.8;

    this.wingmanFireTimer -= delta;
    if (this.wingmanFireTimer > 0) return;
    const target = this.findTarget();
    if (!target) {
      this.wingmanFireTimer = 0.25;
      return;
    }

    const position = target.position.clone();
    this.createExplosion(position, 0x22d3ee, 4);
    this.damageTarget(target, 1, 1);
    this.wingmanFireTimer = CONFIG.wingman.fireInterval;
  }

  minibossForBiome() {
    const id = this.currentBiome?.id;
    if (id === 'solar-storm') return MINI_BOSSES.lancer;
    if (id === 'violet-rift') return MINI_BOSSES.phantom;
    if (id === 'emerald-front') return MINI_BOSSES.citadel;
    return MINI_BOSSES.breaker;
  }

  spawnMiniboss() {
    if (this.boss || this.state !== 'playing') return false;
    const before = this.drones.length;
    super.spawnDrone(true);
    if (this.drones.length <= before) return false;
    const drone = this.drones[this.drones.length - 1];
    const archetype = this.minibossForBiome();
    const id = `mini-${performance.now().toFixed(2)}-${Math.random().toString(16).slice(2)}`;
    drone.userData.minibossId = id;
    drone.userData.miniboss = archetype.id;
    drone.userData.hp = Math.max(12, Math.ceil((4 + this.sector * 1.4) * archetype.hpMultiplier));
    drone.userData.miniMaxHp = drone.userData.hp;
    drone.userData.miniSpecialTimer = 1.15;
    drone.scale.multiplyScalar(archetype.scale);
    const ring = new THREE.Mesh(this.resources.minibossRingGeometry, this.resources.minibossRingMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.z = 0.2;
    drone.add(ring);
    this.minibossRegistry.set(id, drone.position.clone());
    this.callbacks.onMiniboss?.({ ...archetype, hp: drone.userData.hp });
    this.callbacks.onAnnounce?.(`${archetype.name} · ${archetype.title}`);
    this.triggerCinematic('miniboss-entry', 0.18);
    return true;
  }

  syncMinibossRegistry(delta) {
    const active = new Set();
    for (const drone of this.drones) {
      const id = drone.userData.minibossId;
      if (!id) continue;
      active.add(id);
      this.minibossRegistry.set(id, drone.position.clone());
      drone.userData.miniSpecialTimer -= delta;
      if (drone.userData.miniSpecialTimer <= 0 && drone.position.z > -72 && drone.position.z < 4) {
        const speed = CONFIG.drone.bulletSpeed + this.sector * 1.25;
        this.fireEnemy(drone.position.clone(), speed, 1.2);
        this.fireEnemy(drone.position.clone(), speed * 0.94, 5.4);
        this.fireEnemy(drone.position.clone(), speed * 1.06, 7.5);
        drone.userData.miniSpecialTimer = Math.max(0.72, 1.75 - this.sector * 0.04);
      }
    }
    for (const id of this.minibossRegistry.keys()) if (!active.has(id)) this.minibossRegistry.delete(id);
  }

  findMinibossAt(position) {
    let match = null;
    let best = 11;
    for (const [id, p] of this.minibossRegistry.entries()) {
      const distance = p.distanceToSquared(position);
      if (distance < best) { best = distance; match = id; }
    }
    return match;
  }

  currentMinibossSnapshot() {
    for (const drone of this.drones ?? []) {
      if (!drone.userData.minibossId) continue;
      const archetype = Object.values(MINI_BOSSES).find((item) => item.id === drone.userData.miniboss);
      return {
        id: archetype?.id ?? drone.userData.miniboss,
        name: archetype?.name ?? 'MINI-BOSS',
        hp: Math.max(0, drone.userData.hp),
        maxHp: Math.max(1, drone.userData.miniMaxHp ?? drone.userData.hp),
      };
    }
    return null;
  }

  registerDroneKill(position) {
    const minibossId = this.findMinibossAt(position);
    super.registerDroneKill(position);
    if (!minibossId) return;
    this.minibossRegistry.delete(minibossId);
    const archetype = this.minibossForBiome();
    this.score += archetype.rewardScore;
    this.profile.cores += archetype.rewardCores;
    this.profile.minibossesDefeated = (this.profile.minibossesDefeated ?? 0) + 1;
    this.saveProfile();
    this.addHeat(34);
    this.callbacks.onMeta?.(this.metaSnapshot());
    this.callbacks.onMiniboss?.(null);
    this.callbacks.onAnnounce?.(`${archetype.name} DESTRUIDO · +${archetype.rewardCores} CORES`);
    this.triggerCinematic('miniboss-kill', 0.3);
    this.callbacks.onHud?.(this.snapshot());
  }

  triggerEncounter() {
    if (this.encounterRollDone || this.boss || this.sectorTime < CONFIG.encounter.spawnAt) return;
    this.encounterRollDone = true;
    if (Math.random() > CONFIG.encounter.chance) return;
    const encounter = CINEMATIC_ENCOUNTERS[Math.floor(Math.random() * CINEMATIC_ENCOUNTERS.length)];
    this.activeEncounter = encounter;
    if (encounter.kind === 'elites') {
      if (this.drones.length < CONFIG.drone.maxActive - 1) {
        this.spawnDrone(true);
        this.spawnDrone(true);
      }
    } else if (encounter.kind === 'heat') {
      this.addHeat(48);
    } else if (encounter.kind === 'repair') {
      const max = this.getMaxShield();
      this.shield = Math.min(max, this.shield + max * 0.2);
    }
    this.callbacks.onEncounter?.(encounter);
    this.callbacks.onAnnounce?.(`${encounter.name} · ${encounter.description}`);
    this.triggerCinematic('encounter', 0.18);
    this.callbacks.onHud?.(this.snapshot());
  }

  updateBoss(delta) {
    if (!this.boss) return;
    const boss = this.boss;
    const phaseBefore = boss.userData.phase ?? 1;
    const timerBefore = boss.userData.signatureTimer ?? Infinity;

    if (!boss.userData.entering && timerBefore > 0 && timerBefore <= CONFIG.cinematic.telegraphWindow && !boss.userData.telegraphMesh) {
      const ring = new THREE.Mesh(this.resources.telegraphGeometry, this.resources.telegraphMaterial);
      ring.rotation.x = Math.PI / 2;
      ring.position.z = 0.45;
      boss.add(ring);
      boss.userData.telegraphMesh = ring;
      this.callbacks.onTelegraph?.({ guardian: this.currentGuardian?.name ?? 'GUARDIÁN', seconds: timerBefore });
    }

    super.updateBoss(delta);
    if (!this.boss) return;

    const phaseAfter = this.boss.userData.phase ?? 1;
    if (phaseAfter !== phaseBefore) this.triggerCinematic('boss-phase', CONFIG.cinematic.bossSlowmoDuration);

    const telegraph = this.boss.userData.telegraphMesh;
    if (telegraph) {
      telegraph.rotation.z += delta * 3.8;
      const timerAfter = this.boss.userData.signatureTimer ?? Infinity;
      if (timerAfter > CONFIG.cinematic.telegraphWindow) {
        this.boss.remove(telegraph);
        this.boss.userData.telegraphMesh = null;
        this.triggerCinematic('signature-fire', 0.12);
      } else {
        const progress = 1 - clamp(timerAfter / CONFIG.cinematic.telegraphWindow, 0, 1);
        telegraph.scale.setScalar(0.82 + progress * 0.34);
        telegraph.material.opacity = 0.38 + progress * 0.5;
      }
    }
  }

  async start() {
    await super.start();
    this.missileCooldown = 0;
    this.wingmanFireTimer = 0.55;
    this.cinematicTimer = 0;
    this.cinematicKind = '';
    this.minibossRollDone = false;
    this.encounterRollDone = false;
    this.activeEncounter = null;
    this.minibossRegistry.clear();
    this.callbacks.onMiniboss?.(null);
    this.callbacks.onEncounter?.(null);
    this.callbacks.onHud?.(this.snapshot());
  }

  updatePlaying(delta, elapsed) {
    const realDelta = delta;
    const cinematicActive = this.cinematicTimer > 0;
    if (cinematicActive) this.cinematicTimer = Math.max(0, this.cinematicTimer - realDelta);
    if (this.cinematicTimer === 0 && cinematicActive) this.cinematicKind = '';
    const simDelta = cinematicActive ? delta * CONFIG.cinematic.slowmoScale : delta;

    this.missileCooldown = Math.max(0, this.missileCooldown - simDelta);
    super.updatePlaying(simDelta, elapsed);
    if (this.state !== 'playing') return;

    this.updateMissiles(simDelta);
    this.updateWingman(simDelta, elapsed);
    this.syncMinibossRegistry(simDelta);

    if (!this.minibossRollDone && !this.boss && this.sector >= CONFIG.miniboss.minSector && this.sectorTime >= CONFIG.miniboss.spawnAt) {
      this.minibossRollDone = true;
      const routeBoost = this.sectorContract?.id === 'bounty' ? 0.22 : this.sectorContract?.id === 'volatile' ? 0.12 : 0;
      if (Math.random() < Math.min(0.95, CONFIG.miniboss.baseChance + routeBoost)) this.spawnMiniboss();
    }

    this.triggerEncounter();

    if (this.camera) {
      const baseFov = 72;
      const targetFov = this.cinematicTimer > 0 ? baseFov - CONFIG.cinematic.fovKick : baseFov;
      const blend = 1 - Math.exp(-8 * realDelta);
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, blend);
      this.camera.updateProjectionMatrix();
    }
  }

  endGame() {
    this.saveProfile();
    super.endGame();
  }
}
