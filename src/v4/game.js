import * as THREE from 'three';
import { NeonRiderGame as BaseGame } from '../game.js';
import { CONFIG } from './config.js';
import { AudioEngine } from './audio.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function loadProfile() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CONFIG.profileKey) ?? '{}');
    return {
      cores: Number.isFinite(parsed.cores) ? parsed.cores : 0,
      bestSector: Number.isFinite(parsed.bestSector) ? parsed.bestSector : 1,
      totalKills: Number.isFinite(parsed.totalKills) ? parsed.totalKills : 0,
    };
  } catch {
    return { cores: 0, bestSector: 1, totalKills: 0 };
  }
}

export class NeonRiderGame extends BaseGame {
  constructor(container, callbacks = {}) {
    super(container, callbacks);
    this.audio = new AudioEngine();
    this.profile = loadProfile();
    this.drones = [];
    this.enemyBullets = [];
    this.boss = null;
    this.resetEngagementState();
  }

  resetEngagementState() {
    this.sector = 1;
    this.sectorTime = 0;
    this.heat = 0;
    this.overdriveTimer = 0;
    this.invulnerabilityTimer = 0;
    this.droneTimer = 1.8;
    this.bossSpawned = false;
    this.mission = this.createMission(1);
  }

  createMission(sector) {
    const mode = (sector - 1) % 3;
    if (mode === 0) return { type: 'destroy', title: 'ELIMINA AMENAZAS', target: 12 + sector * 2, progress: 0, reward: 160 + sector * 40, complete: false };
    if (mode === 1) return { type: 'combo', title: 'CADENA DE COMBATE', target: Math.min(14, 6 + sector), progress: 0, reward: 190 + sector * 45, complete: false };
    return { type: 'survive', title: 'ESCUDO INTACTO', target: 18 + sector * 2, progress: 0, reward: 220 + sector * 50, complete: false };
  }

  saveProfile() {
    localStorage.setItem(CONFIG.profileKey, JSON.stringify(this.profile));
  }

  createReusableResources() {
    super.createReusableResources();
    this.resources.droneGeometry = new THREE.OctahedronGeometry(1.08, 0);
    this.resources.droneWingGeometry = new THREE.BoxGeometry(3.5, 0.12, 1.1);
    this.resources.droneMaterial = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, metalness: 0.72, roughness: 0.28 });
    this.resources.droneGlowMaterial = new THREE.MeshBasicMaterial({ color: 0xfb7185 });
    this.resources.enemyBulletGeometry = new THREE.SphereGeometry(0.23, 8, 8);
    this.resources.enemyBulletMaterial = new THREE.MeshBasicMaterial({ color: 0xfb7185 });
    this.resources.bossCoreGeometry = new THREE.IcosahedronGeometry(3.2, 1);
    this.resources.bossCoreMaterial = new THREE.MeshStandardMaterial({ color: 0x581c87, emissive: 0x4c1d95, emissiveIntensity: 0.8, metalness: 0.65, roughness: 0.25 });
    this.resources.bossRingGeometry = new THREE.TorusGeometry(4.3, 0.22, 12, 44);
    this.resources.bossRingMaterial = new THREE.MeshBasicMaterial({ color: 0xe879f9, transparent: true, opacity: 0.82 });
  }

  snapshot() {
    const base = super.snapshot();
    const multiplier = Math.min(CONFIG.progression.maxComboMultiplier, 1 + Math.floor(this.combo / 3)) * (this.overdriveTimer > 0 ? 2 : 1);
    return {
      ...base,
      sector: this.sector,
      heat: Math.round(this.heat),
      overdrive: this.overdriveTimer > 0,
      overdriveSeconds: Math.max(0, Math.ceil(this.overdriveTimer)),
      comboMultiplier: multiplier,
      mission: { ...this.mission, progress: Math.min(this.mission.target, Math.floor(this.mission.progress)) },
      boss: this.boss ? { hp: Math.max(0, this.boss.userData.hp), maxHp: this.boss.userData.maxHp } : null,
      cores: this.profile.cores,
      bestSector: this.profile.bestSector,
    };
  }

  async start() {
    this.resetEngagementState();
    await super.start();
    this.callbacks.onAnnounce?.(`SECTOR ${this.sector} · ${this.mission.title}`);
  }

  clearEntities() {
    for (const drone of this.drones ?? []) this.scene?.remove(drone);
    for (const bullet of this.enemyBullets ?? []) this.scene?.remove(bullet);
    if (this.boss) this.scene?.remove(this.boss);
    if (this.drones) this.drones.length = 0;
    if (this.enemyBullets) this.enemyBullets.length = 0;
    this.boss = null;
    super.clearEntities();
  }

  fire() {
    super.fire();
    if (this.overdriveTimer > 0 && this.state === 'playing') this.fireCooldown = CONFIG.laser.overdriveCooldown;
  }

  addHeat(amount) {
    if (this.overdriveTimer > 0) return;
    this.heat = clamp(this.heat + amount, 0, CONFIG.heat.max);
    if (this.heat >= CONFIG.heat.max) {
      this.heat = 0;
      this.overdriveTimer = CONFIG.heat.overdriveDuration;
      this.audio.play('overdrive');
      this.callbacks.onAnnounce?.('OVERDRIVE · PUNTOS x2');
      navigator.vibrate?.([35, 25, 35]);
    }
  }

  registerKill(position) {
    super.registerKill(position);
    this.profile.totalKills += 1;
    this.addHeat(CONFIG.heat.kill);
    this.updateMission('kill', 1);
    this.updateMission('combo', this.combo);
  }

  registerDroneKill(position) {
    super.registerKill(position);
    this.score += 35 * (this.overdriveTimer > 0 ? 2 : 1);
    this.profile.totalKills += 1;
    this.addHeat(CONFIG.heat.droneKill);
    this.updateMission('kill', 1);
    this.updateMission('combo', this.combo);
    this.callbacks.onHud?.(this.snapshot());
  }

  updateMission(event, value) {
    if (this.mission.complete) return;
    if (this.mission.type === 'destroy' && event === 'kill') this.mission.progress += value;
    if (this.mission.type === 'combo' && event === 'combo') this.mission.progress = Math.max(this.mission.progress, value);
    if (this.mission.type === 'survive' && event === 'survive') this.mission.progress += value;
    if (this.mission.type === 'survive' && event === 'hit') this.mission.progress = 0;
    if (this.mission.progress < this.mission.target) return;

    this.mission.progress = this.mission.target;
    this.mission.complete = true;
    this.score += this.mission.reward;
    this.profile.cores += 1;
    this.saveProfile();
    this.addHeat(28);
    this.audio.play('mission');
    this.callbacks.onAnnounce?.(`MISIÓN COMPLETA · +${this.mission.reward} · +1 CORE`);
    this.callbacks.onHud?.(this.snapshot());
  }

  hitShip(asteroid) {
    const position = asteroid?.position?.clone?.() ?? this.ship.position.clone();
    this.damageShip(CONFIG.ship.hitDamage, position);
  }

  damageShip(damage, position) {
    if (this.invulnerabilityTimer > 0 || this.state !== 'playing') return;
    this.createExplosion(position, 0xef4444, 18);
    this.audio.play('hit');
    navigator.vibrate?.([40, 30, 60]);
    this.shield -= damage;
    this.invulnerabilityTimer = CONFIG.ship.invulnerability;
    this.cameraKick = 1;
    this.combo = 0;
    this.comboTimer = 0;
    this.heat = Math.max(0, this.heat - 30);
    this.updateMission('hit', 1);
    if (this.shield <= 0) {
      this.shield = 0;
      this.endGame();
    } else {
      this.callbacks.onAnnounce?.('IMPACTO · MANTÉN LA LÍNEA');
      this.callbacks.onHud?.(this.snapshot());
    }
  }

  spawnDrone() {
    const drone = new THREE.Mesh(this.resources.droneGeometry, this.resources.droneMaterial);
    drone.scale.set(1.05, 0.7, 1.55);
    const wing = new THREE.Mesh(this.resources.droneWingGeometry, this.resources.droneMaterial);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.23, 8, 8), this.resources.droneGlowMaterial);
    eye.position.z = 1.28;
    drone.add(wing, eye);
    const baseX = THREE.MathUtils.randFloat(CONFIG.world.xMin + 2, CONFIG.world.xMax - 2);
    drone.position.set(baseX, THREE.MathUtils.randFloat(CONFIG.world.yMin + 1.5, CONFIG.world.yMax - 1.5), CONFIG.world.spawnZ + 12);
    drone.userData = {
      hp: 2 + Math.floor((this.sector - 1) / 3), radius: 1.45, baseX,
      phase: Math.random() * Math.PI * 2, amplitude: THREE.MathUtils.randFloat(1.5, 4.2), age: 0,
      fireTimer: THREE.MathUtils.randFloat(0.5, 1.2),
    };
    this.scene.add(drone);
    this.drones.push(drone);
  }

  fireEnemy(origin, speed = CONFIG.drone.bulletSpeed, spread = 0) {
    const bullet = new THREE.Mesh(this.resources.enemyBulletGeometry, this.resources.enemyBulletMaterial);
    bullet.position.copy(origin);
    const target = this.ship.position.clone();
    target.x += THREE.MathUtils.randFloatSpread(spread);
    target.y += THREE.MathUtils.randFloatSpread(spread);
    bullet.userData = { velocity: target.sub(origin).normalize().multiplyScalar(speed), radius: 0.36, life: 5 };
    this.scene.add(bullet);
    this.enemyBullets.push(bullet);
    this.audio.play('enemyLaser');
  }

  spawnBoss() {
    if (this.boss) return;
    const boss = new THREE.Group();
    const core = new THREE.Mesh(this.resources.bossCoreGeometry, this.resources.bossCoreMaterial);
    const ringA = new THREE.Mesh(this.resources.bossRingGeometry, this.resources.bossRingMaterial);
    const ringB = new THREE.Mesh(this.resources.bossRingGeometry, this.resources.bossRingMaterial);
    ringA.rotation.x = Math.PI / 2;
    ringB.rotation.y = Math.PI / 2;
    boss.add(core, ringA, ringB);
    boss.position.set(0, 0, -78);
    const hp = CONFIG.boss.baseHp + (this.sector - 1) * CONFIG.boss.hpPerSector;
    boss.userData = { hp, maxHp: hp, radius: 4.4, fireTimer: 1.2, age: 0, entering: true };
    this.scene.add(boss);
    this.boss = boss;
    this.audio.play('boss');
    this.callbacks.onAnnounce?.(`GUARDIÁN DEL SECTOR ${this.sector}`);
    this.callbacks.onHud?.(this.snapshot());
  }

  defeatBoss() {
    if (!this.boss) return;
    const position = this.boss.position.clone();
    this.createExplosion(position, 0xe879f9, 30);
    this.audio.play('explosion');
    this.scene.remove(this.boss);
    this.boss = null;
    this.score += CONFIG.boss.reward * this.sector;
    this.profile.cores += 2 + Math.floor(this.sector / 2);
    this.sector += 1;
    this.profile.bestSector = Math.max(this.profile.bestSector, this.sector);
    this.sectorTime = 0;
    this.bossSpawned = false;
    this.mission = this.createMission(this.sector);
    this.saveProfile();
    for (const bullet of this.enemyBullets) this.scene.remove(bullet);
    this.enemyBullets.length = 0;
    this.callbacks.onAnnounce?.(`SECTOR LIMPIO · ENTRANDO A ${this.sector}`);
    this.callbacks.onHud?.(this.snapshot());
  }

  updateLasers(delta) {
    for (let i = this.lasers.length - 1; i >= 0; i -= 1) {
      const laser = this.lasers[i];
      if (this.boss) {
        const radius = this.boss.userData.radius + laser.userData.radius;
        if (laser.position.distanceToSquared(this.boss.position) <= radius * radius) {
          this.boss.userData.hp -= 1;
          this.createExplosion(laser.position, 0xf0abfc, 4);
          this.scene.remove(laser);
          this.lasers.splice(i, 1);
          if (this.boss.userData.hp <= 0) this.defeatBoss();
          else this.callbacks.onHud?.(this.snapshot());
          continue;
        }
      }
      let consumed = false;
      for (let j = this.drones.length - 1; j >= 0; j -= 1) {
        const drone = this.drones[j];
        const radius = drone.userData.radius + laser.userData.radius;
        if (laser.position.distanceToSquared(drone.position) > radius * radius) continue;
        drone.userData.hp -= 1;
        this.scene.remove(laser);
        this.lasers.splice(i, 1);
        consumed = true;
        this.createExplosion(laser.position, 0xfb7185, 6);
        if (drone.userData.hp <= 0) {
          const position = drone.position.clone();
          this.scene.remove(drone);
          this.drones.splice(j, 1);
          this.audio.play('explosion');
          this.createExplosion(position, 0xfb7185, 16);
          this.registerDroneKill(position);
        }
        break;
      }
      if (consumed) continue;
    }
    super.updateLasers(delta);
  }

  updateDrones(delta) {
    const speed = CONFIG.drone.baseSpeed * Math.min(2.6, 1 + (this.sector - 1) * 0.08 + this.level * 0.035);
    for (let i = this.drones.length - 1; i >= 0; i -= 1) {
      const drone = this.drones[i];
      drone.userData.age += delta;
      drone.position.z += speed * delta;
      drone.position.x = clamp(drone.userData.baseX + Math.sin(drone.userData.age * 1.8 + drone.userData.phase) * drone.userData.amplitude, CONFIG.world.xMin + 1, CONFIG.world.xMax - 1);
      drone.rotation.z = Math.sin(drone.userData.age * 2.4) * 0.22;
      drone.userData.fireTimer -= delta;
      if (drone.userData.fireTimer <= 0 && drone.position.z > -65 && drone.position.z < 2) {
        this.fireEnemy(drone.position.clone(), CONFIG.drone.bulletSpeed + this.sector, 1.1);
        drone.userData.fireTimer = Math.max(0.65, CONFIG.drone.fireInterval - this.sector * 0.05);
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

  updateEnemyBullets(delta) {
    for (let i = this.enemyBullets.length - 1; i >= 0; i -= 1) {
      const bullet = this.enemyBullets[i];
      bullet.userData.life -= delta;
      bullet.position.addScaledVector(bullet.userData.velocity, delta);
      const radius = bullet.userData.radius + CONFIG.ship.radius;
      if (bullet.position.distanceToSquared(this.ship.position) <= radius * radius) {
        const position = bullet.position.clone();
        this.scene.remove(bullet);
        this.enemyBullets.splice(i, 1);
        this.damageShip(CONFIG.drone.bulletDamage, position);
        continue;
      }
      if (bullet.userData.life <= 0 || bullet.position.z > CONFIG.world.cullZ + 18) {
        this.scene.remove(bullet);
        this.enemyBullets.splice(i, 1);
      }
    }
  }

  updateBoss(delta) {
    if (!this.boss) return;
    const boss = this.boss;
    boss.userData.age += delta;
    if (boss.userData.entering) {
      boss.position.z += 14 * delta;
      if (boss.position.z >= -28) { boss.position.z = -28; boss.userData.entering = false; }
    } else {
      boss.position.x = Math.sin(boss.userData.age * 0.72) * 10;
      boss.position.y = Math.cos(boss.userData.age * 0.93) * 4.5;
      boss.userData.fireTimer -= delta;
      if (boss.userData.fireTimer <= 0) {
        this.fireEnemy(boss.position.clone(), CONFIG.boss.bulletSpeed + this.sector * 1.2, 4);
        if (this.sector >= 3) this.fireEnemy(boss.position.clone(), CONFIG.boss.bulletSpeed + this.sector, 8);
        boss.userData.fireTimer = Math.max(0.32, CONFIG.boss.fireInterval - this.sector * 0.025);
      }
    }
    boss.rotation.x += 0.35 * delta;
    boss.rotation.y += 0.55 * delta;
    if (boss.children[1]) boss.children[1].rotation.z += 1.4 * delta;
    if (boss.children[2]) boss.children[2].rotation.x += 1.15 * delta;
  }

  updatePlaying(delta, elapsed) {
    super.updatePlaying(delta, elapsed);
    if (this.state !== 'playing') return;

    this.sectorTime += delta;
    this.overdriveTimer = Math.max(0, this.overdriveTimer - delta);
    this.invulnerabilityTimer = Math.max(0, this.invulnerabilityTimer - delta);
    if (this.overdriveTimer <= 0) this.heat = Math.max(0, this.heat - CONFIG.heat.decayPerSecond * delta);
    if (this.mission.type === 'survive' && !this.mission.complete) this.updateMission('survive', delta);
    this.ship.visible = this.invulnerabilityTimer <= 0 || Math.floor(elapsed * 18) % 2 === 0;

    this.droneTimer -= delta;
    if (this.droneTimer <= 0 && this.drones.length < CONFIG.drone.maxActive) {
      if (Math.random() < CONFIG.drone.spawnChance + Math.min(0.22, this.sector * 0.025)) this.spawnDrone();
      this.droneTimer = Math.max(0.72, 2.15 - this.sector * 0.08);
    }

    if (!this.bossSpawned && this.sectorTime >= CONFIG.boss.sectorSeconds) {
      this.bossSpawned = true;
      this.spawnBoss();
    }

    this.updateDrones(delta);
    this.updateEnemyBullets(delta);
    this.updateBoss(delta);
  }

  updateStarfield(delta, elapsed) {
    const boostedDelta = this.overdriveTimer > 0 ? delta * 1.35 : delta;
    super.updateStarfield(boostedDelta, elapsed);
  }

  updateIdle(elapsed) {
    if (this.state === 'gameover') {
      this.ship.visible = false;
      this.camera.position.x = Math.sin(elapsed * 0.18) * 1.2;
      this.camera.position.y = 4 + Math.cos(elapsed * 0.2) * 0.35;
      this.camera.position.z = 24;
      this.camera.lookAt(0, 0, -3);
      return;
    }
    super.updateIdle(elapsed);
  }

  endGame() {
    this.profile.bestSector = Math.max(this.profile.bestSector, this.sector);
    this.saveProfile();
    super.endGame();
    this.ship.visible = false;
  }
}
