import * as THREE from 'three';

const game = window.__waeNeonRiderGame;

function mesh(geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
  const node = new THREE.Mesh(geometry, material);
  node.position.set(...position);
  node.rotation.set(...rotation);
  node.scale.set(...scale);
  return node;
}

function addBarrel(group, material, x, y = 0.04, z = -1.65, length = 2.8, radius = 0.09) {
  const geometry = new THREE.CylinderGeometry(radius, radius * 1.08, length, 10);
  geometry.rotateX(Math.PI / 2);
  group.add(mesh(geometry, material.clone(), [x, y, z]));
}

function installPremiumVisuals() {
  if (!game || game.__waeV15PremiumVisuals) return;
  game.__waeV15PremiumVisuals = true;

  const baseApplyLoadoutVisual = game.applyLoadoutVisual.bind(game);
  const baseEquipPremium = game.equipPremium?.bind(game);
  const baseClearPremiumSelection = game.clearPremiumSelection?.bind(game);
  const baseUpdatePlaying = game.updatePlaying.bind(game);

  game.applyLoadoutVisual = function waeV15ApplyLoadoutVisual() {
    baseApplyLoadoutVisual();
    const group = game.loadoutVisualGroup;
    if (!group) return;

    const ship = game.getShip?.();
    const weapon = game.getWeapon?.();
    const shipPremium = Boolean(ship?.premium);
    const weaponPremium = Boolean(weapon?.premium);
    if (!shipPremium && !weaponPremium) return;

    const shipAccent = shipPremium ? ship.accent : 0x22d3ee;
    const weaponAccent = weaponPremium ? weapon.accent : shipAccent;
    const metal = new THREE.MeshStandardMaterial({
      color: ship?.id === 'obsidian-one' ? 0x05070d : 0x101827,
      metalness: 0.94,
      roughness: 0.16,
      emissive: shipAccent,
      emissiveIntensity: 0.12,
    });
    const accent = new THREE.MeshStandardMaterial({
      color: shipAccent,
      emissive: shipAccent,
      emissiveIntensity: 1.35,
      metalness: 0.62,
      roughness: 0.18,
      transparent: true,
      opacity: 0.92,
    });
    const weaponMat = new THREE.MeshStandardMaterial({
      color: weaponAccent,
      emissive: weaponAccent,
      emissiveIntensity: 1.6,
      metalness: 0.7,
      roughness: 0.14,
    });
    const glow = new THREE.MeshBasicMaterial({
      color: shipAccent,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    if (shipPremium) {
      const spine = mesh(new THREE.BoxGeometry(0.24, 0.24, 4.8), accent.clone(), [0, 0.48, 0.18]);
      group.add(spine);

      if (ship.id === 'viper-black') {
        for (const side of [-1, 1]) {
          const blade = new THREE.ConeGeometry(0.42, 3.8, 4);
          blade.rotateX(Math.PI / 2);
          const fin = mesh(blade, metal.clone(), [side * 2.95, 0.14, 0.65], [0, 0, side * -0.28], [0.78, 0.72, 1]);
          group.add(fin);
        }
      } else if (ship.id === 'aegis-sovereign') {
        for (const side of [-1, 1]) {
          group.add(mesh(new THREE.BoxGeometry(1.35, 0.62, 3.1), metal.clone(), [side * 2.45, -0.02, 0.92], [0, 0, side * 0.04]));
          group.add(mesh(new THREE.BoxGeometry(0.72, 0.34, 2.15), accent.clone(), [side * 3.0, 0.16, 0.66]));
        }
        const shieldRing = mesh(new THREE.TorusGeometry(2.02, 0.065, 8, 40), glow.clone(), [0, 0.05, 1.05], [Math.PI / 2, 0, 0]);
        shieldRing.userData.v15Spin = 0.32;
        group.add(shieldRing);
      } else if (ship.id === 'nova-imperium') {
        const reactor = mesh(new THREE.TorusGeometry(1.08, 0.12, 10, 42), accent.clone(), [0, 0.12, 1.35], [Math.PI / 2, 0, 0]);
        reactor.userData.v15Spin = 0.7;
        group.add(reactor);
        for (const side of [-1, 1]) group.add(mesh(new THREE.BoxGeometry(2.25, 0.12, 1.4), metal.clone(), [side * 2.45, 0.05, 0.55], [0, side * 0.12, side * -0.08]));
      } else if (ship.id === 'eclipse-x') {
        for (const side of [-1, 1]) {
          const blade = new THREE.ConeGeometry(0.5, 4.8, 3);
          blade.rotateX(Math.PI / 2);
          group.add(mesh(blade, metal.clone(), [side * 3.15, 0.12, 0.44], [0, 0, side * -0.5], [0.88, 0.46, 1.15]));
          group.add(mesh(new THREE.BoxGeometry(0.12, 0.12, 3.5), accent.clone(), [side * 3.35, 0.23, 0.28], [0, side * 0.13, side * -0.42]));
        }
      } else if (ship.id === 'obsidian-one') {
        for (const side of [-1, 1]) {
          group.add(mesh(new THREE.BoxGeometry(2.8, 0.16, 2.25), metal.clone(), [side * 2.45, -0.02, 0.55], [0, side * 0.08, side * -0.2]));
          group.add(mesh(new THREE.BoxGeometry(0.08, 0.1, 2.9), accent.clone(), [side * 3.24, 0.18, 0.35], [0, side * 0.12, side * -0.2]));
        }
        const halo = mesh(new THREE.TorusGeometry(1.75, 0.045, 8, 46), glow.clone(), [0, 0.04, 0.75], [Math.PI / 2, 0, 0]);
        halo.userData.v15Spin = -0.42;
        group.add(halo);
      } else if (ship.id === 'celestial-crown') {
        for (const side of [-1, 1]) {
          group.add(mesh(new THREE.BoxGeometry(2.7, 0.14, 1.7), metal.clone(), [side * 2.55, 0.03, 0.54], [0, side * 0.12, side * -0.16]));
          group.add(mesh(new THREE.ConeGeometry(0.22, 1.7, 5), accent.clone(), [side * 1.2, 0.92, -0.1], [0, 0, side * -0.28]));
        }
        for (const radius of [1.55, 2.0, 2.42]) {
          const crown = mesh(new THREE.TorusGeometry(radius, 0.045, 8, 48), glow.clone(), [0, 0.08, 0.7], [Math.PI / 2, 0, 0]);
          crown.userData.v15Spin = 0.28 + radius * 0.16;
          group.add(crown);
        }
      }
    }

    if (weaponPremium) {
      if (weapon.id === 'trident-vxr') {
        for (const x of [-2.65, 0, 2.65]) addBarrel(group, weaponMat, x, 0.12, -1.45, 3.0, 0.085);
      } else if (weapon.id === 'storm-omega') {
        for (const x of [-3.0, -1.05, 1.05, 3.0]) addBarrel(group, weaponMat, x, 0.08, -1.35, 2.55, 0.075);
      } else if (weapon.id === 'eclipse-cannon') {
        addBarrel(group, weaponMat, 0, 0.2, -1.7, 4.15, 0.18);
        const brace = mesh(new THREE.TorusGeometry(0.45, 0.08, 8, 28), weaponMat.clone(), [0, 0.2, -1.2], [Math.PI / 2, 0, 0]);
        group.add(brace);
      } else if (weapon.id === 'helix-railgun') {
        for (const x of [-0.28, 0.28]) addBarrel(group, weaponMat, x, 0.24, -1.8, 4.65, 0.055);
        const railCore = mesh(new THREE.BoxGeometry(0.08, 0.08, 4.1), weaponMat.clone(), [0, 0.24, -1.75]);
        group.add(railCore);
      } else if (weapon.id === 'nova-destroyer') {
        const core = mesh(new THREE.IcosahedronGeometry(0.42, 1), weaponMat.clone(), [0, 0.28, -1.0]);
        core.userData.v15Spin = 1.15;
        group.add(core);
        for (const x of [-2.7, 2.7]) addBarrel(group, weaponMat, x, 0.08, -1.25, 2.8, 0.12);
      } else if (weapon.id === 'wae-singularity') {
        const core = mesh(new THREE.IcosahedronGeometry(0.5, 2), weaponMat.clone(), [0, 0.3, -1.02]);
        core.userData.v15Spin = 1.45;
        group.add(core);
        for (const radius of [0.72, 1.02]) {
          const ring = mesh(new THREE.TorusGeometry(radius, 0.055, 8, 36), weaponMat.clone(), [0, 0.3, -1.02], [Math.PI / 2, radius, 0]);
          ring.userData.v15Spin = radius === 0.72 ? -1.2 : 0.9;
          group.add(ring);
        }
      }
    }

    const light = new THREE.PointLight(shipAccent, ship?.visualTier >= 5 ? 4.8 : 3.2, 11, 2);
    light.position.set(0, 0.32, 1.6);
    group.add(light);
  };

  if (baseEquipPremium) {
    game.equipPremium = (sku) => {
      const result = baseEquipPremium(sku);
      if (result?.ok) game.applyLoadoutVisual();
      return result;
    };
  }

  if (baseClearPremiumSelection) {
    game.clearPremiumSelection = (kind) => {
      baseClearPremiumSelection(kind);
      game.applyLoadoutVisual();
    };
  }

  game.updatePlaying = function waeV15UpdatePlaying(delta, elapsed) {
    baseUpdatePlaying(delta, elapsed);
    const group = game.loadoutVisualGroup;
    if (!group) return;
    group.traverse((node) => {
      const spin = Number(node.userData?.v15Spin);
      if (!Number.isFinite(spin) || spin === 0) return;
      node.rotation.z += delta * spin;
      node.rotation.y += delta * spin * 0.35;
    });
  };

  game.applyLoadoutVisual();
}

installPremiumVisuals();
