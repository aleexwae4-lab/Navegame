import * as THREE from 'three';
import { PREMIUM_PRODUCTS } from '../v11/catalog.js';

export const COMMERCE_RUNTIME_VERSION = '12.1.0';

const productBySku = new Map(PREMIUM_PRODUCTS.map((item) => [item.sku, item]));

const ship = (sku, runtime) => Object.freeze({
  ...runtime,
  sku,
  id: productBySku.get(sku)?.id ?? sku,
  name: productBySku.get(sku)?.name ?? sku,
  className: productBySku.get(sku)?.rarity ?? 'PREMIUM',
  description: productBySku.get(sku)?.description ?? '',
  cost: Number.POSITIVE_INFINITY,
  premium: true,
});

const weapon = (sku, runtime) => Object.freeze({
  ...runtime,
  sku,
  id: productBySku.get(sku)?.id ?? sku,
  name: productBySku.get(sku)?.name ?? sku,
  className: productBySku.get(sku)?.rarity ?? 'PREMIUM',
  description: productBySku.get(sku)?.description ?? '',
  cost: Number.POSITIVE_INFINITY,
  premium: true,
});

export const PREMIUM_SHIP_RUNTIME = Object.freeze({
  'WAE-SHIP-VIPER-BLK': ship('WAE-SHIP-VIPER-BLK', { speed: 1.28, shield: 1.08, fireRate: 0.80, heatGain: 1.10, accent: 0x22d3ee, scale: [0.92, 0.88, 1.12], visualTier: 1 }),
  'WAE-SHIP-AEGIS-SOV': ship('WAE-SHIP-AEGIS-SOV', { speed: 1.05, shield: 1.55, fireRate: 0.86, heatGain: 1.05, accent: 0xfbbf24, scale: [1.16, 1.08, 1.06], visualTier: 2 }),
  'WAE-SHIP-NOVA-IMP': ship('WAE-SHIP-NOVA-IMP', { speed: 1.22, shield: 1.38, fireRate: 0.72, heatGain: 1.35, accent: 0xf472b6, scale: [1.04, 0.96, 1.14], visualTier: 3 }),
  'WAE-SHIP-ECLIPSE-X': ship('WAE-SHIP-ECLIPSE-X', { speed: 1.35, shield: 1.56, fireRate: 0.64, heatGain: 1.45, accent: 0xa78bfa, scale: [1.08, 0.94, 1.18], visualTier: 4 }),
  'WAE-SHIP-OBSIDIAN-1': ship('WAE-SHIP-OBSIDIAN-1', { speed: 1.46, shield: 1.72, fireRate: 0.58, heatGain: 1.55, accent: 0x94a3b8, scale: [1.10, 0.96, 1.22], visualTier: 5 }),
  'WAE-SHIP-CELESTIAL': ship('WAE-SHIP-CELESTIAL', { speed: 1.58, shield: 1.88, fireRate: 0.52, heatGain: 1.65, accent: 0xfde68a, scale: [1.12, 0.98, 1.25], visualTier: 6 }),
  'WAE-SHIP-SPECTER-VLK': ship('WAE-SHIP-SPECTER-VLK', { speed: 1.72, shield: 1.98, fireRate: 0.48, heatGain: 1.72, accent: 0x38bdf8, scale: [1.06, 0.92, 1.28], visualTier: 7 }),
  'WAE-SHIP-TITAN-DOM': ship('WAE-SHIP-TITAN-DOM', { speed: 1.62, shield: 2.42, fireRate: 0.50, heatGain: 1.78, accent: 0xf97316, scale: [1.24, 1.12, 1.22], visualTier: 8 }),
  'WAE-SHIP-SERAPH-QNT': ship('WAE-SHIP-SERAPH-QNT', { speed: 1.88, shield: 2.26, fireRate: 0.43, heatGain: 1.88, accent: 0xe879f9, scale: [1.12, 0.96, 1.32], visualTier: 9 }),
  'WAE-SHIP-AURELION-OMG': ship('WAE-SHIP-AURELION-OMG', { speed: 2.14, shield: 2.86, fireRate: 0.36, heatGain: 2.00, accent: 0xfff1a8, scale: [1.20, 1.02, 1.40], visualTier: 12, omega: true }),
});

export const PREMIUM_WEAPON_RUNTIME = Object.freeze({
  'WAE-WPN-TRIDENT-VXR': weapon('WAE-WPN-TRIDENT-VXR', { lanes: [-3.2, -1.05, 1.05, 3.2], cooldown: 0.90, damageTier: 1, accent: 0x22d3ee }),
  'WAE-WPN-STORM-OMG': weapon('WAE-WPN-STORM-OMG', { lanes: [-3.2, -1.6, 0, 1.6, 3.2], cooldown: 0.84, damageTier: 1, accent: 0x60a5fa }),
  'WAE-WPN-ECLIPSE-CNN': weapon('WAE-WPN-ECLIPSE-CNN', { lanes: [-3.2, -1.25, 0, 1.25, 3.2], cooldown: 0.88, damageTier: 2, accent: 0xc084fc }),
  'WAE-WPN-HELIX-RG': weapon('WAE-WPN-HELIX-RG', { lanes: [-3.2, -0.7, 0.7, 3.2], cooldown: 0.68, damageTier: 2, accent: 0x67e8f9 }),
  'WAE-WPN-NOVA-DST': weapon('WAE-WPN-NOVA-DST', { lanes: [-3.2, -2.1, -1.05, 0, 1.05, 2.1, 3.2], cooldown: 0.72, damageTier: 2, accent: 0xfb7185 }),
  'WAE-WPN-SINGULARITY': weapon('WAE-WPN-SINGULARITY', { lanes: [-3.2, -2.4, -1.6, -0.8, 0, 0.8, 1.6, 2.4, 3.2], cooldown: 0.62, damageTier: 3, accent: 0xfde68a }),
  'WAE-WPN-ORION-LNC': weapon('WAE-WPN-ORION-LNC', { lanes: [-3.2, -1.15, 0, 1.15, 3.2], cooldown: 0.54, damageTier: 4, accent: 0x38bdf8 }),
  'WAE-WPN-CHRONOS-ARR': weapon('WAE-WPN-CHRONOS-ARR', { lanes: [-3.2, -2.4, -1.6, -0.8, 0, 0.8, 1.6, 2.4, 3.2], cooldown: 0.50, damageTier: 4, accent: 0xfb923c }),
  'WAE-WPN-ABYSS-RPR': weapon('WAE-WPN-ABYSS-RPR', { lanes: [-3.2, -2.55, -1.9, -1.25, -0.62, 0, 0.62, 1.25, 1.9, 2.55, 3.2], cooldown: 0.46, damageTier: 5, accent: 0xd946ef }),
  'WAE-WPN-OMEGA-CROWN': weapon('WAE-WPN-OMEGA-CROWN', { lanes: [-3.2, -2.7, -2.15, -1.6, -1.05, -0.52, 0, 0.52, 1.05, 1.6, 2.15, 2.7, 3.2], cooldown: 0.38, damageTier: 6, accent: 0xfff1a8 }),
});

export function installPremiumRuntime(game, commerceState) {
  if (!game || game.__waePremiumRuntimeInstalled) return;
  game.__waePremiumRuntimeInstalled = true;

  const baseGetShip = game.getShip.bind(game);
  const baseGetWeapon = game.getWeapon.bind(game);
  const baseApplyLoadoutVisual = game.applyLoadoutVisual.bind(game);
  const baseFire = game.fire.bind(game);

  const selected = {
    shipSku: localStorage.getItem('wae_neon_rider_v12_ship_sku') || '',
    weaponSku: localStorage.getItem('wae_neon_rider_v12_weapon_sku') || '',
  };

  const owned = (sku) => Boolean(sku && commerceState.ownedSkus.has(sku));

  game.getShip = () => (owned(selected.shipSku) ? PREMIUM_SHIP_RUNTIME[selected.shipSku] : null) ?? baseGetShip();
  game.getWeapon = () => (owned(selected.weaponSku) ? PREMIUM_WEAPON_RUNTIME[selected.weaponSku] : null) ?? baseGetWeapon();

  game.applyLoadoutVisual = () => {
    baseApplyLoadoutVisual();
    const current = game.getShip();
    if (!current?.premium || !game.loadoutVisualGroup) return;

    const material = new THREE.MeshBasicMaterial({ color: current.accent, transparent: true, opacity: current.omega ? 0.96 : 0.84 });
    const glow = new THREE.MeshBasicMaterial({ color: current.accent, transparent: true, opacity: current.omega ? 0.72 : 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    const tier = Math.max(1, current.visualTier ?? 1);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.35 + tier * 0.08, 0.07 + tier * 0.01, 8, 32), glow.clone());
    ring.rotation.x = Math.PI / 2;
    ring.position.z = 1.25;
    game.loadoutVisualGroup.add(ring);

    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.26 + tier * 0.035, tier >= 4 ? 1 : 0), material.clone());
    core.position.set(0, 0.82, 0.05);
    game.loadoutVisualGroup.add(core);

    for (const side of [-1, 1]) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12 + tier * 0.02, 0.16, 2.6 + tier * 0.16), material.clone());
      fin.position.set(side * (2.35 + tier * 0.07), 0.06, 0.72);
      fin.rotation.z = side * -0.10;
      game.loadoutVisualGroup.add(fin);
    }

    if (tier >= 4) {
      const crown = new THREE.Mesh(new THREE.TorusGeometry(2.0 + tier * 0.05, 0.045, 6, 34), glow.clone());
      crown.rotation.x = Math.PI / 2;
      crown.rotation.z = Math.PI / 4;
      crown.position.z = 0.15;
      game.loadoutVisualGroup.add(crown);
    }

    if (current.omega) {
      const halo = new THREE.Mesh(new THREE.TorusGeometry(2.75, 0.065, 8, 48), glow.clone());
      halo.rotation.x = Math.PI / 2;
      halo.position.z = -0.2;
      game.loadoutVisualGroup.add(halo);
      for (const side of [-1, 1]) {
        const spear = new THREE.Mesh(new THREE.ConeGeometry(0.12, 2.6, 8), material.clone());
        spear.rotation.x = Math.PI / 2;
        spear.position.set(side * 3.25, 0.08, 0.15);
        game.loadoutVisualGroup.add(spear);
      }
      const omegaLight = new THREE.PointLight(current.accent, 5.6, 18, 2);
      omegaLight.position.set(0, 0.5, 1.3);
      game.loadoutVisualGroup.add(omegaLight);
    }
  };

  game.fire = () => {
    const before = game.lasers.length;
    baseFire();
    const current = game.getWeapon();
    if (!current?.premium || game.lasers.length <= before) return;

    game.resources.laserMaterial?.color?.setHex?.(current.accent);
    const created = game.lasers.slice(before);
    const extraHits = Math.max(0, Math.floor((current.damageTier ?? 1) - 1));
    for (let tier = 0; tier < extraHits; tier += 1) {
      for (const laser of created) {
        const echo = new THREE.Mesh(game.resources.laserGeometry, game.resources.laserMaterial);
        echo.position.copy(laser.position);
        echo.position.z -= 0.08 * (tier + 1);
        echo.userData.radius = laser.userData.radius;
        game.scene.add(echo);
        game.lasers.push(echo);
      }
    }
  };

  game.equipPremium = (sku) => {
    if (!owned(sku)) return { ok: false, reason: 'entitlement_required' };
    const product = productBySku.get(sku);
    if (!product) return { ok: false, reason: 'invalid_sku' };
    if (product.kind === 'ship') {
      selected.shipSku = sku;
      localStorage.setItem('wae_neon_rider_v12_ship_sku', sku);
      game.maxShield = game.getMaxShield();
      game.applyLoadoutVisual();
    } else if (product.kind === 'weapon') {
      selected.weaponSku = sku;
      localStorage.setItem('wae_neon_rider_v12_weapon_sku', sku);
      game.resources.laserMaterial?.color?.setHex?.(PREMIUM_WEAPON_RUNTIME[sku]?.accent ?? 0x22d3ee);
    }
    game.callbacks.onHud?.(game.snapshot());
    game.callbacks.onMeta?.(game.metaSnapshot());
    return { ok: true, sku, kind: product.kind };
  };

  game.clearPremiumSelection = (kind) => {
    if (kind === 'ship') {
      selected.shipSku = '';
      localStorage.removeItem('wae_neon_rider_v12_ship_sku');
      game.maxShield = game.getMaxShield();
      game.applyLoadoutVisual();
    }
    if (kind === 'weapon') {
      selected.weaponSku = '';
      localStorage.removeItem('wae_neon_rider_v12_weapon_sku');
      game.resources.laserMaterial?.color?.setHex?.(0x22d3ee);
    }
    game.callbacks.onHud?.(game.snapshot());
  };

  commerceState.onEntitlementsChanged = () => {
    if (selected.shipSku && !owned(selected.shipSku)) selected.shipSku = '';
    if (selected.weaponSku && !owned(selected.weaponSku)) selected.weaponSku = '';
    game.maxShield = game.getMaxShield();
    game.applyLoadoutVisual();
    game.callbacks.onHud?.(game.snapshot());
  };
}
