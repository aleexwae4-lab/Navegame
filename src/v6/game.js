import * as THREE from 'three';
import { NeonRiderGame as GalacticGame } from '../v5/game.js';
import { CONFIG as V5_CONFIG } from '../v5/config.js';
import { BIOMES, CONFIG, ENEMY_ROLES, PERKS } from './config.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function readJson(key) {
  try { return JSON.parse(localStorage.getItem(key) ?? '{}'); }
  catch { return {}; }
}

function mergeV6Profile(base) {
  const saved = readJson(CONFIG.profileKey);
  if (!Object.keys(saved).length) return { ...base, runsCompleted: base.runsCompleted ?? 0 };
  return {
    ...base,
    ...saved,
    unlockedShips: Array.isArray(saved.unlockedShips) ? saved.unlockedShips : base.unlockedShips,
    unlockedWeapons: Array.isArray(saved.unlockedWeapons) ? saved.unlockedWeapons : base.unlockedWeapons,
    runsCompleted: Number.isFinite(saved.runsCompleted) ? Math.max(0, Math.floor(saved.runsCompleted)) : 0,
  };
}

function baseRunMods() {
  return {
    fireCooldown: 1,
    heatGain: 1,
    shield: 1,
    secondaryCooldown: 1,
    scoreGain: 1,
    secondaryPower: 1,
    sectorHeal: 0,
    enemySpeed: 1,
  };
}

export class NeonRiderGame extends GalacticGame {
  constructor(container, callbacks = {}) {
    super(container, callbacks);
    this.profile = mergeV6Profile(this.profile);
    this.runPerks = [];
    this.pendingPerks = [];
    this.runMods = baseRunMods();
    this.secondaryCooldown = 0;
    this.currentBiome = BIOMES[0];
    this.resetEngagementState();
  }

  saveProfile() {
    const payload = JSON.stringify(this.profile);
    localStorage.setItem(CONFIG.profileKey, payload);
    localStorage.setItem(V5_CONFIG.profileKey, payload);
  }

  metaSnapshot() {
    return {
      ...super.metaSnapshot(),
      runsCompleted: this.profile.runsCompleted ?? 0,
    };
  }

  getMaxShield() {
    return Math.round(super.getMaxShield() * (this.runMods?.shield ?? 1));
  }

  resetEngagementState() {
    super.resetEngagementState();
    this.runPerks = [];
    this.pendingPerks = [];
    this.runMods = baseRunMods();
    this.secondaryCooldown = 0;
    this.currentBiome = this.biomeForSector(this.sector);
  }

  biomeForSector(sector) {
    return BIOMES[(Math.max(1, sector) - 1) % BIOMES.length];
  }

  applyBiome(sector = this.sector) {
    const biome = this.biomeForSector(sector);
    this.currentBiome = biome;
    if (this.scene) {
      this.scene.background?.setHex?.(biome.background);
      this.scene.fog?.color?.setHex?.(biome.fog);
    }
    this.starfield?.material?.color?.setHex?.(biome.star);
    this.callbacks.onBiome?.(biome);
  }

  snapshot() {
    const state = super.snapshot();
    const maxCooldown = CONFIG.secondary.cooldown * (this.runMods?.secondaryCooldown ?? 1);
    const boss = this.boss ? {
      ...state.boss,
      phase: this.boss.userData.phase ?? 1,
    } : state.boss;
    return {
      ...state,
      boss,
      biome: this.currentBiome,
      secondary: {
        ready: this.secondaryCooldown <= 0,
        cooldown: Math.max(0, this.secondaryCooldown),
        percent: maxCooldown <= 0 ? 100 : clamp((1 - this.secondaryCooldown / maxCooldown) * 100, 0, 100),
      },
      run: {
        perks: [...(this.runPerks ?? [])],
        pendingPerks: [...(this.pendingPerks ?? [])],
      },
    };
  }

  createReusableResources() {
    super.createReusableResources();
    this.resources.droneEyeGeometry = new THREE.SphereGeometry(0.23, 8, 8);
    this.resources.bossNodeGeometry = new THREE.OctahedronGeometry(0.52, 0);
    this.resources.roleMaterials = {
      raider: new THREE.MeshStandardMaterial({ color: 0x7f1d1d, emissive: 0x3f0b16, emissiveIntensity: 0.55, metalness: 0.74, roughness: 0.26 }),
      sentinel: new THREE.MeshStandardMaterial({ color: 0x1e3a8a, emissive: 0x172554, emissiveIntensity: 0.62, metalness: 0.78, roughness: 0.24 }),
      sniper: new THREE.MeshStandardMaterial({ color: 0x581c87, emissive: 0x3b0764, emissiveIntensity: 0.7, metalness: 0.72, roughness: 0.22 }),
      swarm: new THREE.MeshStandardMaterial({ color: 0x9a3412, emissive: 0x431407, emissiveIntensity: 0.58, metalness: 0.62, roughness: 0.3 }),
    };
    this.resources.roleGlowMaterials = {
      raider: new THREE.MeshBasicMaterial({ color: 0xfb7185 }),
      sentinel: new THREE.MeshBasicMaterial({ color: 0x60a5fa }),
      sniper: new THREE.MeshBasicMaterial({ color: 0xe879f9 }),
      swarm: new THREE.MeshBasicMaterial({ color: 0xfbbf24 }),
    };
  }

  roleForSector() {
    const pool = ['raider', 'raider', 'raider'];
    if (this.sector >= 2) pool.push('sentinel');
    if (this.sector >= 3) pool.push('sniper');
    if (this.sector >= 4) pool.push('swarm', 'swarm');
    if (this.sector >= 7) pool.push('sentinel', 'sniper', 'swarm');
    return pool[Math.floor(Math.random() * pool.length)];
  }

  spawnDrone() {
    const roleId = this.roleForSector();
    const role = ENEMY_ROLES[roleId];
    const drone = new THREE.Group();
    const core = new THREE.Mesh(this.resources.droneGeometry, this.resources.roleMaterials[roleId]);
    const wing = new THREE.Mesh(this.resources.droneWingGeometry, this.resources.roleMaterials[roleId]);
    const eye = new THREE.Mesh(this.resources.droneEyeGeometry, this.resources.roleGlowMaterials[roleId]);
    core.scale.set(...role.scale);
    eye.position.z = 1.3 * role.scale[2];
    drone.add(core, wing, eye);

    const baseX = THREE.MathUtils.randFloat(CONFIG.world.xMin + 2, CONFIG.world.xMax - 2);
    const baseY = THREE.MathUtils.randFloat(CONFIG.world.yMin + 1.5, CONFIG.world.yMax - 1.5);
    drone.position.set(baseX, baseY, CONFIG.world.spawnZ + 12);
    drone.userData = {
      role: roleId,
      hp: role.hp + Math.floor((this.sector - 1) / 5),
      radius: role.radius,
      baseX,
      baseY,
      phase: Math.random() * Math.PI * 2,
      amplitude: role.amplitude,
      age: 0,
      fireTimer: THREE.MathUtils.randFloat(0.5, 1.15),
    };
    this.scene.add(drone);
    this.drones.push(drone);
    this.callbacks.onEnemy?.({ role: roleId, name: role.name });
  }

  updateDrones(delta) {
    const sectorScale = Math.min(2.65, 1 + (this.sector - 1) * 0.08 + this.level * 0.035);
    for (let i = this.drones.length - 1; i >= 0; i -= 1) {
      const drone = this.drones[i];
      const role = ENEMY_ROLES[drone.userData.role] ?? ENEMY_ROLES.raider;
      const speed = CONFIG.drone.baseSpeed * sectorScale * role.speed * (this.runMods?.enemySpeed ?? 1);
      drone.userData.age += delta;
      drone.position.z += speed * delta;

      const age = drone.userData.age;
      if (role.id === 'sentinel') {
        drone.position.x = clamp(drone.userData.baseX + Math.sin(age * 1.05 + drone.userData.phase) * drone.userData.amplitude, CONFIG.world.xMin + 1, CONFIG.world.xMax - 1);
      } else if (role.id === 'sniper') {
        drone.position.x = clamp(drone.userData.baseX + Math.sin(age * 0.72 + drone.userData.phase) * drone.userData.amplitude, CONFIG.world.xMin + 1, CONFIG.world.xMax - 1);
        drone.position.y = clamp(drone.userData.baseY + Math.cos(age * 0.82) * 1.4, CONFIG.world.yMin + 1, CONFIG.world.yMax - 1);
      } else if (role.id === 'swarm') {
        drone.position.x = clamp(drone.userData.baseX + Math.sin(age * 3.1 + drone.userData.phase) * drone.userData.amplitude, CONFIG.world.xMin + 1, CONFIG.world.xMax - 1);
        drone.position.y = clamp(drone.userData.baseY + Math.cos(age * 2.6 + drone.userData.phase) * 2.2, CONFIG.world.yMin + 1, CONFIG.world.yMax - 1);
      } else {
        drone.position.x = clamp(drone.userData.baseX + Math.sin(age * 2.0 + drone.userData.phase) * drone.userData.amplitude, CONFIG.world.xMin + 1, CONFIG.world.xMax - 1);
      }

      drone.rotation.z = Math.sin(age * 2.4) * 0.24;
      drone.userData.fireTimer -= delta;
      if (drone.userData.fireTimer <= 0 && drone.position.z > -68 && drone.position.z < 3) {
        const bulletSpeed = (CONFIG.drone.bulletSpeed + this.sector) * role.bulletSpeed;
        if (role.id === 'sentinel') {
          this.fireEnemy(drone.position.clone(), bulletSpeed, 2.2);
          this.fireEnemy(drone.position.clone(), bulletSpeed, 4.2);
        } else if (role.id === 'sniper') {
          this.fireEnemy(drone.position.clone(), bulletSpeed, 0.35);
        } else {
          this.fireEnemy(drone.position.clone(), bulletSpeed, role.id === 'swarm' ? 1.8 : 1.1);
        }
        drone.userData.fireTimer = Math.max(0.52, CONFIG.drone.fireInterval / role.fire - this.sector * 0.045);
      }

      const radius = drone.userData.radius + CONFIG.ship.radius;
      if (drone.position.distanceToSquared(this.ship.position) <= radius * radius) {
        const position = drone.position.clone();
        this.scene.remove(drone);
        this.drones.splice(i, 1);
        this.damageShip(CONFIG.ship.hitDamage, position);
        continue;
      }
      if (drone.position.z > CONFIG.world.cullZ) {
        this.scene.remove(drone);
        this.drones.splice(i, 1);
      }
    }
  }

  spawnBoss() {
    super.spawnBoss();
    if (!this.boss) return;
    this.boss.userData.phase = 1;
    this.boss.userData.lastPhase = 1;
    const material = new THREE.MeshBasicMaterial({ color: this.currentBiome?.accent ?? 0xe879f9 });
    for (let i = 0; i < 3; i += 1) {
      const node = new THREE.Mesh(this.resources.bossNodeGeometry, material.clone());
      const angle = (Math.PI * 2 * i) / 3;
      node.position.set(Math.cos(angle) * 5.2, Math.sin(angle) * 5.2, 0);
      node.userData.phaseOffset = angle;
      this.boss.add(node);
    }
  }

  updateBoss(delta) {
    if (!this.boss) return;
    const boss = this.boss;
    boss.userData.age += delta;
    const ratio = boss.userData.hp / Math.max(1, boss.userData.maxHp);
    const phase = ratio <= CONFIG.bossPhases.phase3 ? 3 : ratio <= CONFIG.bossPhases.phase2 ? 2 : 1;
    boss.userData.phase = phase;
    if (phase !== boss.userData.lastPhase) {
      boss.userData.lastPhase = phase;
      boss.userData.fireTimer = 0.18;
      this.audio.play('boss');
      this.callbacks.onAnnounce?.(`GUARDIÁN · FASE ${phase}`);
      navigator.vibrate?.([45, 35, 45]);
      this.callbacks.onHud?.(this.snapshot());
    }

    if (boss.userData.entering) {
      boss.position.z += 14 * delta;
      if (boss.position.z >= -28) { boss.position.z = -28; boss.userData.entering = false; }
    } else {
      const age = boss.userData.age;
      const xAmp = phase === 1 ? 9 : phase === 2 ? 11 : 13;
      const yAmp = phase === 1 ? 4 : phase === 2 ? 5 : 6;
      boss.position.x = Math.sin(age * (0.72 + phase * 0.08)) * xAmp;
      boss.position.y = Math.cos(age * (0.9 + phase * 0.09)) * yAmp;
      boss.userData.fireTimer -= delta;
      if (boss.userData.fireTimer <= 0) {
        const speed = CONFIG.boss.bulletSpeed + this.sector * 1.2 + phase * 2;
        this.fireEnemy(boss.position.clone(), speed, phase === 1 ? 2.6 : 4.5);
        if (phase >= 2) {
          this.fireEnemy(boss.position.clone(), speed * 0.96, 7);
          this.fireEnemy(boss.position.clone(), speed * 1.04, 7);
        }
        if (phase === 3) this.fireEnemy(boss.position.clone(), speed * 1.12, 10);
        boss.userData.fireTimer = Math.max(0.26, CONFIG.boss.fireInterval - this.sector * 0.022 - phase * 0.08);
      }
    }

    boss.rotation.x += (0.24 + phase * 0.08) * delta;
    boss.rotation.y += (0.4 + phase * 0.12) * delta;
    for (let i = 3; i < boss.children.length; i += 1) {
      const node = boss.children[i];
      const angle = boss.userData.age * (0.8 + phase * 0.25) + (node.userData.phaseOffset ?? 0);
      node.position.x = Math.cos(angle) * (5.1 + phase * 0.35);
      node.position.y = Math.sin(angle) * (5.1 + phase * 0.35);
      node.rotation.x += delta * 2;
      node.rotation.y += delta * 1.5;
    }
  }

  activateSecondary() {
    if (this.state !== 'playing' || this.secondaryCooldown > 0) return false;
    const power = this.runMods?.secondaryPower ?? 1;
    this.secondaryCooldown = CONFIG.secondary.cooldown * (this.runMods?.secondaryCooldown ?? 1);

    for (const bullet of this.enemyBullets) this.scene.remove(bullet);
    this.enemyBullets.length = 0;

    for (let i = this.drones.length - 1; i >= 0; i -= 1) {
      const drone = this.drones[i];
      drone.userData.hp -= CONFIG.secondary.droneDamage * power;
      this.createExplosion(drone.position, this.currentBiome?.accent ?? 0x67e8f9, 8);
      if (drone.userData.hp <= 0) {
        const position = drone.position.clone();
        this.scene.remove(drone);
        this.drones.splice(i, 1);
        this.audio.play('explosion');
        this.registerDroneKill(position);
      }
    }

    if (this.boss) {
      this.boss.userData.hp -= CONFIG.secondary.bossDamage * power;
      this.createExplosion(this.boss.position, this.currentBiome?.accent ?? 0x67e8f9, 18);
      if (this.boss.userData.hp <= 0) this.defeatBoss();
    }

    this.createExplosion(this.ship.position, 0x67e8f9, 30);
    this.cameraKick = Math.max(this.cameraKick, 0.8);
    this.audio.play('overdrive');
    navigator.vibrate?.([25, 20, 65]);
    this.callbacks.onAnnounce?.('PULSO NOVA · CAMPO LIMPIO');
    this.callbacks.onHud?.(this.snapshot());
    return true;
  }

  rollPerkChoices() {
    let pool = Object.values(PERKS).filter((perk) => !this.runPerks.includes(perk.id));
    if (pool.length < 3) pool = Object.values(PERKS);
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 3).map((perk) => perk.id);
  }

  beginPerkSelection() {
    this.pendingPerks = this.rollPerkChoices();
    this.clearInput();
    this.state = 'perk';
    const snapshot = this.snapshot();
    this.callbacks.onPerk?.({ choices: [...this.pendingPerks], active: [...this.runPerks] });
    this.callbacks.onState?.('perk', snapshot);
    this.callbacks.onHud?.(snapshot);
  }

  choosePerk(id) {
    if (this.state !== 'perk' || !this.pendingPerks.includes(id) || !PERKS[id]) return false;
    const perk = PERKS[id];
    const oldMaxShield = this.getMaxShield();
    if (perk.multiplier) this.runMods[perk.stat] *= perk.multiplier;
    if (perk.add) this.runMods[perk.stat] += perk.add;
    this.runPerks.push(id);
    this.pendingPerks = [];

    if (perk.stat === 'shield') {
      const newMaxShield = this.getMaxShield();
      this.shield = Math.min(newMaxShield, this.shield + Math.max(0, newMaxShield - oldMaxShield));
    }

    this.state = 'playing';
    const snapshot = this.snapshot();
    this.callbacks.onPerk?.({ choices: [], active: [...this.runPerks] });
    this.callbacks.onState?.('playing', snapshot);
    this.callbacks.onAnnounce?.(`${perk.name} · BUILD ACTUALIZADA`);
    this.callbacks.onHud?.(snapshot);
    return true;
  }

  fire() {
    const before = this.lasers.length;
    super.fire();
    if (this.lasers.length > before) this.fireCooldown *= this.runMods?.fireCooldown ?? 1;
  }

  addHeat(amount) {
    super.addHeat(amount * (this.runMods?.heatGain ?? 1));
  }

  registerKill(position) {
    const before = this.score;
    super.registerKill(position);
    const gained = this.score - before;
    if (gained > 0 && (this.runMods?.scoreGain ?? 1) !== 1) this.score = Math.round(before + gained * this.runMods.scoreGain);
    this.callbacks.onHud?.(this.snapshot());
  }

  registerDroneKill(position) {
    const before = this.score;
    super.registerDroneKill(position);
    const gained = this.score - before;
    if (gained > 0 && (this.runMods?.scoreGain ?? 1) !== 1) this.score = Math.round(before + gained * this.runMods.scoreGain);
    this.callbacks.onHud?.(this.snapshot());
  }

  async start() {
    await super.start();
    this.applyBiome(this.sector);
    this.callbacks.onPerk?.({ choices: [], active: [] });
    this.callbacks.onHud?.(this.snapshot());
  }

  updatePlaying(delta, elapsed) {
    this.secondaryCooldown = Math.max(0, this.secondaryCooldown - delta);
    super.updatePlaying(delta, elapsed);
    if (this.state !== 'playing') return;
    if (this.currentBiome?.id !== this.biomeForSector(this.sector).id) this.applyBiome(this.sector);
  }

  defeatBoss() {
    const clearedSector = this.sector;
    super.defeatBoss();
    if (this.runMods?.sectorHeal > 0) {
      const maxShield = this.getMaxShield();
      this.shield = Math.min(maxShield, this.shield + maxShield * this.runMods.sectorHeal);
    }
    this.applyBiome(this.sector);
    this.callbacks.onAnnounce?.(`SECTOR ${clearedSector} DOMINADO · ELIGE UNA MEJORA`);
    this.beginPerkSelection();
  }

  endGame() {
    if (this.state !== 'gameover') this.profile.runsCompleted = (this.profile.runsCompleted ?? 0) + 1;
    this.saveProfile();
    super.endGame();
  }
}
