import * as THREE from 'three';

const ROLE_COLORS = Object.freeze({
  raider: [0x7f1d1d, 0xfb7185],
  sentinel: [0x172554, 0x60a5fa],
  sniper: [0x3b0764, 0xe879f9],
  swarm: [0x431407, 0xfbbf24],
  elite: [0x422006, 0xfbbf24],
});

const GUARDIAN_COLORS = Object.freeze({
  helix: 0x22d3ee,
  forge: 0xf97316,
  seer: 0xd946ef,
  bastion: 0x34d399,
});

const state = {
  installed: false,
  baseSpawnDrone: null,
  baseSpawnBoss: null,
  baseSpawnMiniboss: null,
  basePromoteElite: null,
  baseUpdatePlaying: null,
};

function game() { return window.__waeNeonRiderGame; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function hex(value, fallback = 0x22d3ee) { return Number.isFinite(value) ? Number(value) : fallback; }

function physical(color, emissive = 0x000000, intensity = 0) {
  return new THREE.MeshPhysicalMaterial({
    color,
    emissive,
    emissiveIntensity: intensity,
    metalness: 0.88,
    roughness: 0.22,
    clearcoat: 0.5,
    clearcoatRoughness: 0.18,
  });
}

function glow(color, opacity = 0.82) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

function mesh(geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
  const node = new THREE.Mesh(geometry, material);
  node.position.set(...position);
  node.rotation.set(...rotation);
  node.scale.set(...scale);
  return node;
}

function rolePalette(role, elite = false) {
  if (elite) return ROLE_COLORS.elite;
  return ROLE_COLORS[role] || ROLE_COLORS.raider;
}

function inferShadowRole(group) {
  const color = group?.children?.[0]?.material?.color?.getHex?.();
  if (color === 0x1e3a8a || color === 0x172554) return 'sentinel';
  if (color === 0x581c87 || color === 0x3b0764) return 'sniper';
  if (color === 0x9a3412 || color === 0x431407) return 'swarm';
  return 'raider';
}

function hideLegacyDrone(drone) {
  if (!drone?.children) return;
  for (let i = 0; i < Math.min(3, drone.children.length); i += 1) {
    const child = drone.children[i];
    if (child?.name?.startsWith('WAE_V26')) continue;
    child.visible = false;
  }
}

function addEngine(group, x, z, color, scale = 1) {
  const metal = physical(0x07111f, color, 0.12);
  const body = new THREE.CylinderGeometry(0.2 * scale, 0.28 * scale, 0.7 * scale, 12);
  body.rotateX(Math.PI / 2);
  group.add(mesh(body, metal, [x, -0.04, z]));
  const ring = mesh(new THREE.TorusGeometry(0.23 * scale, 0.04 * scale, 8, 24), glow(color, 0.86), [x, -0.04, z + 0.36 * scale], [Math.PI / 2, 0, 0]);
  ring.userData.v26Spin = 0.9;
  group.add(ring);
}

function buildDroneSkin(role = 'raider', accent = 0xfb7185, elite = false, mini = '') {
  const [baseColor, roleGlow] = rolePalette(role, elite);
  const color = mini ? accent : roleGlow;
  const hull = physical(baseColor, color, elite ? 0.24 : 0.14);
  const armor = physical(0x111827, color, elite ? 0.18 : 0.08);
  const light = glow(color, elite ? 0.96 : 0.78);
  const group = new THREE.Group();
  group.name = 'WAE_V26_ENEMY_SKIN';
  group.userData.v26Role = role;
  group.userData.v26Elite = elite;
  group.userData.v26Mini = mini;

  if (role === 'sentinel') {
    group.add(mesh(new THREE.DodecahedronGeometry(0.9, 1), hull, [0, 0, 0], [0, 0, 0], [1.18, 0.76, 1.5]));
    for (const side of [-1, 1]) {
      group.add(mesh(new THREE.BoxGeometry(0.78, 0.46, 1.85), armor.clone(), [side * 1.15, 0, 0.22], [0, 0, side * 0.06]));
      group.add(mesh(new THREE.BoxGeometry(0.08, 0.1, 1.55), light.clone(), [side * 1.52, 0.12, 0.06]));
    }
    const shield = mesh(new THREE.TorusGeometry(1.75, 0.055, 8, 38), glow(color, 0.3), [0, 0.02, 0.18], [Math.PI / 2, 0, 0]);
    shield.userData.v26Spin = 0.22;
    group.add(shield);
    addEngine(group, -0.55, 1.28, color, 1.08);
    addEngine(group, 0.55, 1.28, color, 1.08);
  } else if (role === 'sniper') {
    const spine = new THREE.CylinderGeometry(0.32, 0.5, 3.2, 14);
    spine.rotateX(Math.PI / 2);
    group.add(mesh(spine, hull, [0, 0, -0.1]));
    group.add(mesh(new THREE.ConeGeometry(0.48, 1.8, 12), hull.clone(), [0, 0, -2.38], [Math.PI / 2, 0, 0]));
    for (const side of [-1, 1]) {
      group.add(mesh(new THREE.BoxGeometry(1.35, 0.1, 0.62), armor.clone(), [side * 0.98, 0, 0.38], [0, side * 0.08, side * -0.18]));
    }
    const lens = mesh(new THREE.SphereGeometry(0.25, 12, 8), light, [0, 0.16, -1.48]);
    lens.userData.v26Pulse = true;
    group.add(lens);
    const rail = new THREE.CylinderGeometry(0.055, 0.07, 2.5, 10);
    rail.rotateX(Math.PI / 2);
    group.add(mesh(rail, glow(color, 0.82), [0, 0.08, -2.25]));
    addEngine(group, 0, 1.65, color, 0.9);
  } else if (role === 'swarm') {
    group.add(mesh(new THREE.IcosahedronGeometry(0.62, 1), hull, [0, 0, 0], [0, 0, 0], [1, 0.7, 1.36]));
    for (let i = 0; i < 4; i += 1) {
      const angle = i * Math.PI / 2;
      const fin = mesh(new THREE.ConeGeometry(0.16, 1.2, 5), armor.clone(), [Math.cos(angle) * 0.75, Math.sin(angle) * 0.45, 0.25], [Math.PI / 2, 0, angle]);
      group.add(fin);
    }
    const eye = mesh(new THREE.OctahedronGeometry(0.2, 1), light, [0, 0.05, -0.88]);
    eye.userData.v26Pulse = true;
    group.add(eye);
    addEngine(group, 0, 0.92, color, 0.72);
  } else {
    const body = new THREE.CylinderGeometry(0.42, 0.72, 2.6, 14);
    body.rotateX(Math.PI / 2);
    group.add(mesh(body, hull, [0, 0, 0.05], [0, 0, 0], [1, 0.82, 1]));
    group.add(mesh(new THREE.ConeGeometry(0.68, 1.7, 12), hull.clone(), [0, 0, -1.92], [Math.PI / 2, 0, 0]));
    for (const side of [-1, 1]) {
      group.add(mesh(new THREE.BoxGeometry(1.55, 0.12, 0.76), armor.clone(), [side * 1.08, -0.04, 0.34], [0, side * 0.06, side * -0.2]));
      group.add(mesh(new THREE.BoxGeometry(0.07, 0.07, 1.08), light.clone(), [side * 1.52, 0.08, 0.22], [0, side * 0.08, side * -0.2]));
      addEngine(group, side * 0.43, 1.25, color, 0.82);
    }
    const eye = mesh(new THREE.SphereGeometry(0.22, 12, 8), light, [0, 0.16, -1.05]);
    eye.userData.v26Pulse = true;
    group.add(eye);
  }

  if (elite) {
    const crown = mesh(new THREE.TorusGeometry(1.55, 0.055, 8, 36), glow(0xfbbf24, 0.65), [0, 0.02, 0.28], [Math.PI / 2, 0, 0]);
    crown.userData.v26Spin = 0.72;
    group.add(crown);
    for (const side of [-1, 1]) {
      group.add(mesh(new THREE.BoxGeometry(0.16, 0.3, 1.55), physical(0x1c1917, 0xfbbf24, 0.32), [side * 1.72, 0.18, 0.22], [0, side * 0.12, side * -0.12]));
    }
  }

  if (mini) {
    group.scale.multiplyScalar(mini === 'citadel' ? 1.35 : 1.2);
    const miniColor = mini === 'lancer' ? 0xf97316 : mini === 'phantom' ? 0xd946ef : mini === 'citadel' ? 0x34d399 : 0x22d3ee;
    const halo = mesh(new THREE.TorusGeometry(2.0, 0.085, 10, 42), glow(miniColor, 0.58), [0, 0.02, 0.12], [Math.PI / 2, 0, 0]);
    halo.userData.v26Spin = mini === 'phantom' ? -0.9 : 0.5;
    group.add(halo);
    if (mini === 'breaker') {
      for (const x of [-1.25, 1.25]) {
        const barrel = new THREE.CylinderGeometry(0.12, 0.16, 2.5, 12);
        barrel.rotateX(Math.PI / 2);
        group.add(mesh(barrel, physical(0x111827, miniColor, 0.28), [x, 0.12, -1.35]));
      }
    } else if (mini === 'lancer') {
      group.add(mesh(new THREE.ConeGeometry(0.24, 2.6, 8), glow(miniColor, 0.76), [0, 0.3, -1.55], [Math.PI / 2, 0, 0]));
    } else if (mini === 'phantom') {
      const ring = mesh(new THREE.TorusGeometry(1.1, 0.05, 8, 36), glow(miniColor, 0.52), [0, 0.18, -0.4], [0, Math.PI / 2, 0]);
      ring.userData.v26Spin = 1.1;
      group.add(ring);
    } else if (mini === 'citadel') {
      for (const side of [-1, 1]) group.add(mesh(new THREE.BoxGeometry(1.25, 0.62, 2.0), physical(0x0b1713, miniColor, 0.22), [side * 1.55, 0, 0.35]));
    }
  }

  const damageA = mesh(new THREE.SphereGeometry(0.22, 8, 6), glow(0xfb923c, 0), [0.46, 0.22, 0.34]);
  const damageB = mesh(new THREE.SphereGeometry(0.18, 8, 6), glow(0xef4444, 0), [-0.52, -0.16, -0.12]);
  damageA.userData.v26Damage = 1;
  damageB.userData.v26Damage = 2;
  group.add(damageA, damageB);
  return group;
}

function guardianIdFromGame(g) {
  const id = String(g?.currentGuardian?.id || '').toLowerCase();
  if (GUARDIAN_COLORS[id]) return id;
  const name = String(document.querySelector('[data-v17-boss-name]')?.textContent || '').toLowerCase();
  if (name.includes('forge')) return 'forge';
  if (name.includes('seer')) return 'seer';
  if (name.includes('bastion')) return 'bastion';
  return 'helix';
}

function addWeakpoint(group, position, color) {
  const node = mesh(new THREE.SphereGeometry(0.34, 14, 10), glow(color, 0.28), position);
  node.userData.v26Weakpoint = true;
  group.add(node);
  return node;
}

function buildGuardianSkin(id = 'helix', accent = 0x22d3ee) {
  const color = GUARDIAN_COLORS[id] || accent;
  const hull = physical(id === 'bastion' ? 0x082016 : id === 'forge' ? 0x231008 : id === 'seer' ? 0x160822 : 0x071522, color, 0.28);
  const armor = physical(0x111827, color, 0.16);
  const light = glow(color, 0.72);
  const group = new THREE.Group();
  group.name = 'WAE_V26_GUARDIAN_SKIN';
  group.userData.v26Guardian = id;
  group.userData.v26Entry = 0;

  if (id === 'forge') {
    group.add(mesh(new THREE.IcosahedronGeometry(2.55, 2), hull, [0, 0, 0], [0, 0, 0], [1.05, 0.88, 1.05]));
    const corona = mesh(new THREE.TorusGeometry(4.15, 0.22, 12, 56), light, [0, 0, 0], [Math.PI / 2, 0, 0]);
    corona.userData.v26Spin = 0.38;
    group.add(corona);
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      const spike = mesh(new THREE.ConeGeometry(0.28, 2.2, 7), armor.clone(), [Math.cos(angle) * 3.25, Math.sin(angle) * 3.25, 0], [0, 0, -angle + Math.PI / 2]);
      spike.userData.v26Armor = i;
      group.add(spike);
    }
    addWeakpoint(group, [0, 0.6, -2.5], color);
    addWeakpoint(group, [-2.5, 1.4, 0], color);
    addWeakpoint(group, [2.5, 1.4, 0], color);
  } else if (id === 'seer') {
    group.add(mesh(new THREE.IcosahedronGeometry(2.25, 2), hull, [0, 0, 0], [0, 0, 0], [1, 0.76, 1.18]));
    const eye = mesh(new THREE.TorusGeometry(3.65, 0.2, 12, 58), light, [0, 0, 0], [0, Math.PI / 2, 0]);
    eye.userData.v26Spin = -0.42;
    group.add(eye);
    const iris = mesh(new THREE.TorusGeometry(1.6, 0.11, 10, 44), glow(color, 0.9), [0, 0, -1.5], [Math.PI / 2, 0, 0]);
    iris.userData.v26Spin = 0.9;
    group.add(iris);
    for (const side of [-1, 1]) {
      const wing = mesh(new THREE.BoxGeometry(3.0, 0.22, 1.2), armor.clone(), [side * 3.15, 0, 0.2], [0, side * 0.18, side * -0.2]);
      wing.userData.v26Armor = side < 0 ? 0 : 1;
      group.add(wing);
    }
    addWeakpoint(group, [0, 0, -2.42], color);
    addWeakpoint(group, [-2.8, 0.55, 0.2], color);
    addWeakpoint(group, [2.8, 0.55, 0.2], color);
  } else if (id === 'bastion') {
    group.add(mesh(new THREE.DodecahedronGeometry(2.65, 1), hull, [0, 0, 0], [0, 0, 0], [1.08, 0.92, 1.08]));
    for (let i = 0; i < 4; i += 1) {
      const angle = (i / 4) * Math.PI * 2;
      const tower = mesh(new THREE.BoxGeometry(1.0, 1.2, 2.4), armor.clone(), [Math.cos(angle) * 3.45, Math.sin(angle) * 2.7, 0.3], [0, 0, angle * 0.2]);
      tower.userData.v26Armor = i;
      group.add(tower);
    }
    const shield = mesh(new THREE.TorusGeometry(4.65, 0.16, 12, 60), glow(color, 0.38), [0, 0, 0], [Math.PI / 2, 0, 0]);
    shield.userData.v26Spin = 0.18;
    group.add(shield);
    addWeakpoint(group, [0, 1.9, -1.85], color);
    addWeakpoint(group, [-2.55, -1.2, -0.5], color);
    addWeakpoint(group, [2.55, -1.2, -0.5], color);
  } else {
    group.add(mesh(new THREE.IcosahedronGeometry(2.35, 2), hull, [0, 0, 0], [0, 0, 0], [1, 0.84, 1.12]));
    for (const radius of [3.15, 4.15]) {
      const ring = mesh(new THREE.TorusGeometry(radius, radius === 3.15 ? 0.14 : 0.08, 10, 56), glow(color, radius === 3.15 ? 0.66 : 0.38), [0, 0, 0], [Math.PI / 2, radius * 0.08, 0]);
      ring.userData.v26Spin = radius === 3.15 ? 0.72 : -0.38;
      group.add(ring);
    }
    for (let i = 0; i < 4; i += 1) {
      const angle = (i / 4) * Math.PI * 2;
      const pylon = mesh(new THREE.ConeGeometry(0.32, 2.5, 8), armor.clone(), [Math.cos(angle) * 3.55, Math.sin(angle) * 2.7, 0.2], [0, 0, -angle + Math.PI / 2]);
      pylon.userData.v26Armor = i;
      group.add(pylon);
    }
    addWeakpoint(group, [0, 0, -2.35], color);
    addWeakpoint(group, [-2.6, 1.15, 0], color);
    addWeakpoint(group, [2.6, 1.15, 0], color);
  }

  const core = mesh(new THREE.OctahedronGeometry(0.68, 2), glow(color, 0.92), [0, 0, -0.55]);
  core.userData.v26Core = true;
  group.add(core);
  const lightNode = new THREE.PointLight(color, 12, 18, 2);
  lightNode.position.set(0, 0, 1.2);
  group.add(lightNode);
  return group;
}

function weakpointExposed() {
  const text = String(document.querySelector('[data-v19-core-label]')?.textContent || '').toUpperCase();
  return /EXPOSED|FIRE NOW|VULNERABLE/.test(text);
}

function updateSkinDamage(skin, hp, maxHp, delta, elapsed) {
  if (!skin) return;
  const ratio = clamp((Number(hp) || 0) / Math.max(1, Number(maxHp) || 1), 0, 1);
  skin.traverse((node) => {
    if (node.userData?.v26Spin) {
      node.rotation.z += delta * node.userData.v26Spin;
      node.rotation.y += delta * node.userData.v26Spin * 0.2;
    }
    if (node.userData?.v26Pulse && node.material) {
      node.scale.setScalar(0.92 + Math.sin(elapsed * 5) * 0.08);
    }
    if (node.userData?.v26Damage && node.material) {
      const threshold = node.userData.v26Damage === 1 ? 0.66 : 0.33;
      node.material.opacity = ratio < threshold ? 0.78 + Math.sin(elapsed * 11) * 0.16 : 0;
    }
    if (Number.isFinite(node.userData?.v26Armor)) {
      const index = Number(node.userData.v26Armor);
      if (ratio < 0.33 && index % 2 === 0) node.visible = false;
      else if (ratio < 0.66 && index === 0) node.visible = false;
      else node.visible = true;
    }
  });
}

function updateGuardianSkin(skin, hp, maxHp, delta, elapsed) {
  if (!skin) return;
  skin.userData.v26Entry = clamp((skin.userData.v26Entry || 0) + delta * 1.25, 0, 1);
  const entry = THREE.MathUtils.smoothstep(skin.userData.v26Entry, 0, 1);
  skin.scale.setScalar(0.28 + entry * 0.72);
  const exposed = weakpointExposed();
  skin.traverse((node) => {
    if (node.userData?.v26Spin) {
      node.rotation.z += delta * node.userData.v26Spin;
      node.rotation.y += delta * node.userData.v26Spin * 0.22;
    }
    if (node.userData?.v26Weakpoint && node.material) {
      node.material.opacity = exposed ? 0.95 : 0.22;
      const s = exposed ? 1.2 + Math.sin(elapsed * 8) * 0.1 : 0.9;
      node.scale.setScalar(s);
    }
    if (node.userData?.v26Core) node.rotation.y += delta * 1.5;
  });
  updateSkinDamage(skin, hp, maxHp, delta, elapsed);
}

function decorateDrone(drone, force = false) {
  if (!drone) return;
  const mini = String(drone.userData?.miniboss || '');
  const role = String(drone.userData?.role || inferShadowRole(drone) || 'raider');
  const elite = Boolean(drone.userData?.elite || drone.children?.length > 3);
  const signature = `${role}|${elite}|${mini}`;
  const existing = drone.getObjectByName?.('WAE_V26_ENEMY_SKIN');
  if (existing && !force && existing.userData.v26Signature === signature) return existing;
  if (existing) drone.remove(existing);
  hideLegacyDrone(drone);
  const accent = hex(game()?.currentBiome?.accent, rolePalette(role, elite)[1]);
  const skin = buildDroneSkin(role, accent, elite, mini);
  skin.userData.v26Signature = signature;
  drone.add(skin);
  return skin;
}

function decorateBoss(boss, force = false) {
  if (!boss) return;
  const g = game();
  const id = guardianIdFromGame(g);
  const existing = boss.getObjectByName?.('WAE_V26_GUARDIAN_SKIN');
  if (existing && !force && existing.userData.v26Guardian === id) return existing;
  if (existing) boss.remove(existing);
  for (const child of boss.children) {
    if (child?.name?.startsWith('WAE_V26')) continue;
    if (child?.name?.startsWith('V19')) continue;
    child.visible = false;
  }
  const skin = buildGuardianSkin(id, hex(g?.currentBiome?.accent, GUARDIAN_COLORS[id]));
  boss.add(skin);
  return skin;
}

function decorateSharedBattlefield(delta, elapsed) {
  const g = game();
  const root = g?.scene?.getObjectByName?.('WAE_V17_SHARED_BATTLEFIELD');
  if (!root) return;
  for (const entity of root.children) {
    if (entity.name?.startsWith('V17_drone_')) {
      const skin = decorateDrone(entity);
      const data = entity.userData?.v17 || {};
      updateSkinDamage(skin, data.hp, data.maxHp, delta, elapsed);
    } else if (entity.name?.startsWith('V17_boss_')) {
      const skin = decorateBoss(entity);
      const data = entity.userData?.v17 || {};
      updateGuardianSkin(skin, data.hp, data.maxHp, delta, elapsed);
    }
  }
}

function refreshExisting(delta = 0, elapsed = 0) {
  const g = game();
  if (!g) return;
  for (const drone of g.drones || []) {
    const skin = decorateDrone(drone);
    updateSkinDamage(skin, drone.userData?.hp, drone.userData?.miniMaxHp || drone.userData?.hp, delta, elapsed);
  }
  if (g.boss) {
    const skin = decorateBoss(g.boss);
    updateGuardianSkin(skin, g.boss.userData?.hp, g.boss.userData?.maxHp, delta, elapsed);
  }
  decorateSharedBattlefield(delta, elapsed);
}

export function installEnemyArtDirector() {
  const g = game();
  if (!g || state.installed || g.__waeV26EnemyArt) return false;
  state.installed = true;
  g.__waeV26EnemyArt = true;

  state.baseSpawnDrone = typeof g.spawnDrone === 'function' ? g.spawnDrone.bind(g) : null;
  state.baseSpawnBoss = typeof g.spawnBoss === 'function' ? g.spawnBoss.bind(g) : null;
  state.baseSpawnMiniboss = typeof g.spawnMiniboss === 'function' ? g.spawnMiniboss.bind(g) : null;
  state.basePromoteElite = typeof g.promoteElite === 'function' ? g.promoteElite.bind(g) : null;
  state.baseUpdatePlaying = typeof g.updatePlaying === 'function' ? g.updatePlaying.bind(g) : null;

  if (state.baseSpawnDrone) {
    g.spawnDrone = (...args) => {
      const before = new Set(g.drones || []);
      const result = state.baseSpawnDrone(...args);
      for (const drone of g.drones || []) if (!before.has(drone)) decorateDrone(drone, true);
      return result;
    };
  }

  if (state.basePromoteElite) {
    g.promoteElite = (drone, ...args) => {
      const result = state.basePromoteElite(drone, ...args);
      decorateDrone(result || drone, true);
      return result;
    };
  }

  if (state.baseSpawnMiniboss) {
    g.spawnMiniboss = (...args) => {
      const result = state.baseSpawnMiniboss(...args);
      for (const drone of g.drones || []) if (drone.userData?.minibossId) decorateDrone(drone, true);
      return result;
    };
  }

  if (state.baseSpawnBoss) {
    g.spawnBoss = (...args) => {
      const result = state.baseSpawnBoss(...args);
      if (g.boss) decorateBoss(g.boss, true);
      return result;
    };
  }

  if (state.baseUpdatePlaying) {
    g.updatePlaying = (delta, elapsed) => {
      state.baseUpdatePlaying(delta, elapsed);
      refreshExisting(delta, elapsed);
    };
  }

  refreshExisting(0, performance.now() / 1000);
  document.body.classList.add('v26-enemy-art-ready');
  window.dispatchEvent(new CustomEvent('wae:v26-enemy-art-ready'));
  return true;
}
