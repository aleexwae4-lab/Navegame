import * as THREE from 'three';
import { NeonRiderGame as CombatGame } from '../v4/game.js';
import { CONFIG, SHIPS, WEAPONS } from './config.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '{}');
  } catch {
    return {};
  }
}

function loadProfile() {
  const current = readJson(CONFIG.profileKey);
  const legacy = readJson(CONFIG.legacyProfileKey);
  const source = Object.keys(current).length ? current : legacy;
  const bestSector = Math.max(1, Math.floor(finite(source.bestSector, 1)));
  const unlockedShips = Array.isArray(source.unlockedShips) ? source.unlockedShips.filter((id) => SHIPS[id]) : [];
  const unlockedWeapons = Array.isArray(source.unlockedWeapons) ? source.unlockedWeapons.filter((id) => WEAPONS[id]) : [];
  if (!unlockedShips.includes(CONFIG.meta.starterShip)) unlockedShips.unshift(CONFIG.meta.starterShip);
  if (!unlockedWeapons.includes(CONFIG.meta.starterWeapon)) unlockedWeapons.unshift(CONFIG.meta.starterWeapon);

  const equippedShip = unlockedShips.includes(source.equippedShip) ? source.equippedShip : CONFIG.meta.starterShip;
  const equippedWeapon = unlockedWeapons.includes(source.equippedWeapon) ? source.equippedWeapon : CONFIG.meta.starterWeapon;

  return {
    cores: Math.max(0, Math.floor(finite(source.cores, 0))),
    bestSector,
    totalKills: Math.max(0, Math.floor(finite(source.totalKills, 0))),
    unlockedShips,
    unlockedWeapons,
    equippedShip,
    equippedWeapon,
    selectedSector: clamp(Math.floor(finite(source.selectedSector, 1)), 1, bestSector),
  };
}

function disposeGroup(group) {
  group?.traverse?.((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((material) => material?.dispose?.());
    else child.material?.dispose?.();
  });
}

export class NeonRiderGame extends CombatGame {
  constructor(container, callbacks = {}) {
    super(container, callbacks);
    this.profile = loadProfile();
    this.loadoutVisualGroup = null;
    this.maxShield = this.getMaxShield();
    this.resetEngagementState();
  }

  saveProfile() {
    localStorage.setItem(CONFIG.profileKey, JSON.stringify(this.profile));
  }

  getShip() {
    return SHIPS[this.profile?.equippedShip] ?? SHIPS[CONFIG.meta.starterShip];
  }

  getWeapon() {
    return WEAPONS[this.profile?.equippedWeapon] ?? WEAPONS[CONFIG.meta.starterWeapon];
  }

  getMaxShield() {
    return Math.round(CONFIG.ship.shield * (this.getShip()?.shield ?? 1));
  }

  metaSnapshot() {
    return {
      cores: this.profile.cores,
      bestSector: this.profile.bestSector,
      totalKills: this.profile.totalKills,
      selectedSector: this.profile.selectedSector,
      equippedShip: this.profile.equippedShip,
      equippedWeapon: this.profile.equippedWeapon,
      unlockedShips: [...this.profile.unlockedShips],
      unlockedWeapons: [...this.profile.unlockedWeapons],
    };
  }

  snapshot() {
    const state = super.snapshot();
    const maxShield = this.getMaxShield();
    const ship = this.getShip();
    const weapon = this.getWeapon();
    return {
      ...state,
      shield: Math.max(0, Math.round((this.shield / Math.max(1, maxShield)) * 100)),
      shieldValue: Math.max(0, Math.round(this.shield)),
      shieldMax: maxShield,
      loadout: {
        shipId: ship.id,
        shipName: ship.name,
        shipClass: ship.className,
        weaponId: weapon.id,
        weaponName: weapon.name,
        weaponClass: weapon.className,
      },
      meta: this.metaSnapshot(),
    };
  }

  resetEngagementState() {
    super.resetEngagementState();
    const bestSector = Math.max(1, this.profile?.bestSector ?? 1);
    const selectedSector = clamp(this.profile?.selectedSector ?? 1, 1, bestSector);
    this.sector = selectedSector;
    this.sectorTime = 0;
    this.bossSpawned = false;
    this.mission = this.createMission(this.sector);
  }

  createShip() {
    super.createShip();
    this.applyLoadoutVisual();
  }

  applyLoadoutVisual() {
    if (!this.ship) return;
    if (this.loadoutVisualGroup) {
      this.ship.remove(this.loadoutVisualGroup);
      disposeGroup(this.loadoutVisualGroup);
    }

    const shipConfig = this.getShip();
    const group = new THREE.Group();
    group.name = 'v5-loadout-visual';
    const material = new THREE.MeshBasicMaterial({ color: shipConfig.accent, transparent: true, opacity: 0.88 });

    if (shipConfig.id === 'falcon') {
      const railGeometry = new THREE.BoxGeometry(0.14, 0.12, 3.6);
      for (const x of [-2.15, 2.15]) {
        const rail = new THREE.Mesh(railGeometry, material.clone());
        rail.position.set(x, 0.18, 0.35);
        group.add(rail);
      }
    }

    if (shipConfig.id === 'viper') {
      const finGeometry = new THREE.ConeGeometry(0.3, 2.2, 4);
      finGeometry.rotateX(Math.PI / 2);
      for (const x of [-2.65, 2.65]) {
        const fin = new THREE.Mesh(finGeometry, material.clone());
        fin.position.set(x, 0.42, 1.1);
        fin.rotation.z = x < 0 ? 0.32 : -0.32;
        group.add(fin);
      }
    }

    if (shipConfig.id === 'aegis') {
      const armorGeometry = new THREE.BoxGeometry(1.05, 0.72, 2.45);
      for (const x of [-2.25, 2.25]) {
        const armor = new THREE.Mesh(armorGeometry, material.clone());
        armor.position.set(x, -0.02, 1.05);
        group.add(armor);
      }
    }

    if (shipConfig.id === 'nova') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.12, 10, 34), material.clone());
      ring.rotation.x = Math.PI / 2;
      ring.position.z = 1.55;
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), material.clone());
      core.position.set(0, 0.8, 0.25);
      group.add(ring, core);
    }

    this.ship.scale.set(...shipConfig.scale);
    this.ship.add(group);
    this.loadoutVisualGroup = group;
  }

  purchase(kind, id) {
    const catalog = kind === 'ship' ? SHIPS : kind === 'weapon' ? WEAPONS : null;
    const unlockedKey = kind === 'ship' ? 'unlockedShips' : 'unlockedWeapons';
    if (!catalog?.[id]) return { ok: false, reason: 'invalid' };
    if (this.profile[unlockedKey].includes(id)) return { ok: true, reason: 'owned' };
    const cost = catalog[id].cost;
    if (this.profile.cores < cost) return { ok: false, reason: 'cores' };
    this.profile.cores -= cost;
    this.profile[unlockedKey].push(id);
    this.saveProfile();
    this.callbacks.onMeta?.(this.metaSnapshot());
    return { ok: true, reason: 'purchased' };
  }

  equip(kind, id) {
    const unlockedKey = kind === 'ship' ? 'unlockedShips' : 'unlockedWeapons';
    const equippedKey = kind === 'ship' ? 'equippedShip' : 'equippedWeapon';
    const catalog = kind === 'ship' ? SHIPS : kind === 'weapon' ? WEAPONS : null;
    if (!catalog?.[id] || !this.profile[unlockedKey].includes(id)) return false;
    this.profile[equippedKey] = id;
    this.maxShield = this.getMaxShield();
    this.saveProfile();
    if (kind === 'ship') this.applyLoadoutVisual();
    this.callbacks.onMeta?.(this.metaSnapshot());
    this.callbacks.onHud?.(this.snapshot());
    return true;
  }

  selectSector(sector) {
    const target = Math.floor(Number(sector));
    if (!Number.isFinite(target) || target < 1 || target > this.profile.bestSector) return false;
    this.profile.selectedSector = target;
    this.saveProfile();
    this.callbacks.onMeta?.(this.metaSnapshot());
    return true;
  }

  async start() {
    this.maxShield = this.getMaxShield();
    await super.start();
    this.maxShield = this.getMaxShield();
    this.shield = this.maxShield;
    this.applyLoadoutVisual();
    const ship = this.getShip();
    const weapon = this.getWeapon();
    this.callbacks.onAnnounce?.(`${ship.name} · ${weapon.name} · SECTOR ${this.sector}`);
    this.callbacks.onHud?.(this.snapshot());
  }

  collectPowerup(powerup) {
    if (powerup.userData.type !== 'shield') {
      super.collectPowerup(powerup);
      return;
    }
    const restore = this.getMaxShield() * (CONFIG.powerups.shieldRestore / 100);
    this.shield = Math.min(this.getMaxShield(), this.shield + restore);
    this.callbacks.onAnnounce?.('+ ESCUDO');
    this.audio.play('powerup');
    navigator.vibrate?.(35);
    this.callbacks.onHud?.(this.snapshot());
  }

  fire() {
    const before = this.lasers.length;
    super.fire();
    if (this.lasers.length <= before) return;

    const weapon = this.getWeapon();
    const existing = new Set([-3.2, 3.2]);
    for (const offsetX of weapon.lanes) {
      if (existing.has(offsetX)) continue;
      const laser = new THREE.Mesh(this.resources.laserGeometry, this.resources.laserMaterial);
      laser.position.set(this.ship.position.x + offsetX, this.ship.position.y - 0.06, this.ship.position.z - 1.05);
      laser.userData.radius = CONFIG.laser.radius;
      this.scene.add(laser);
      this.lasers.push(laser);
    }

    this.fireCooldown *= this.getShip().fireRate * weapon.cooldown;
  }

  addHeat(amount) {
    super.addHeat(amount * this.getShip().heatGain);
  }

  updatePlaying(delta, elapsed) {
    const beforeX = this.ship.position.x;
    const beforeY = this.ship.position.y;
    super.updatePlaying(delta, elapsed);
    if (this.state !== 'playing') return;

    const speedMod = this.getShip().speed;
    if (speedMod !== 1) {
      let x = Number(this.input.right) - Number(this.input.left);
      let y = Number(this.input.up) - Number(this.input.down);
      if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
      const extra = CONFIG.ship.speed * (speedMod - 1) * delta;
      this.ship.position.x = clamp(this.ship.position.x + x * extra, CONFIG.world.xMin, CONFIG.world.xMax);
      this.ship.position.y = clamp(this.ship.position.y + y * extra, CONFIG.world.yMin, CONFIG.world.yMax);
    }

    if (!Number.isFinite(this.ship.position.x)) this.ship.position.x = beforeX;
    if (!Number.isFinite(this.ship.position.y)) this.ship.position.y = beforeY;
  }

  updateMission(event, value) {
    const coresBefore = this.profile?.cores ?? 0;
    super.updateMission(event, value);
    if ((this.profile?.cores ?? 0) !== coresBefore) this.callbacks.onMeta?.(this.metaSnapshot());
  }

  defeatBoss() {
    const coresBefore = this.profile.cores;
    super.defeatBoss();
    if (this.profile.cores !== coresBefore) this.callbacks.onMeta?.(this.metaSnapshot());
  }

  endGame() {
    this.saveProfile();
    super.endGame();
    this.callbacks.onMeta?.(this.metaSnapshot());
  }
}
