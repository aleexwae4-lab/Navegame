import * as THREE from 'three';
import './combat.css';

const PREMIUM_WEAPON_KEY = 'wae_neon_rider_v12_weapon_sku';
const MAX_FX = 72;
const state = {
  installed: false,
  game: null,
  root: null,
  raf: 0,
  last: performance.now(),
  effects: [],
  ringGeometry: null,
  debrisGeometry: null,
  flashGeometry: null,
  shieldMesh: null,
  shieldTimer: 0,
  lastMuzzle: 0,
  materialCache: new Map(),
};

const WEAPON_ACCENTS = Object.freeze({
  'WAE-WPN-TRIDENT-VXR': 0x67e8f9,
  'WAE-WPN-STORM-OMG': 0x60a5fa,
  'WAE-WPN-ECLIPSE-CNN': 0xc084fc,
  'WAE-WPN-HELIX-RG': 0xf472b6,
  'WAE-WPN-NOVA-DST': 0xfbbf24,
  'WAE-WPN-SINGULARITY': 0xf5d0fe,
});

function game() { return window.__waeNeonRiderGame; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function accent() {
  const sku = localStorage.getItem(PREMIUM_WEAPON_KEY) || '';
  return WEAPON_ACCENTS[sku] || 0x67e8f9;
}

function ensureDom() {
  let impact = document.querySelector('#v24-impact-layer');
  if (!impact) {
    impact = document.createElement('div');
    impact.id = 'v24-impact-layer';
    impact.className = 'v24-impact-layer';
    impact.innerHTML = '<i></i><b></b>';
    document.body.append(impact);
  }
  let reticle = document.querySelector('#v24-combat-reticle');
  if (!reticle) {
    reticle = document.createElement('div');
    reticle.id = 'v24-combat-reticle';
    reticle.className = 'v24-combat-reticle';
    reticle.innerHTML = '<i></i><span></span>';
    document.body.append(reticle);
  }
}

function ensureResources(g) {
  if (!g?.scene) return false;
  if (state.root?.parent) return true;
  state.root = new THREE.Group();
  state.root.name = 'WAE_V24_COMBAT_FX';
  g.scene.add(state.root);
  state.ringGeometry ||= new THREE.RingGeometry(.74, 1, 32);
  state.debrisGeometry ||= new THREE.TetrahedronGeometry(.12, 0);
  state.flashGeometry ||= new THREE.SphereGeometry(.18, 8, 8);
  return true;
}

function material(color, kind = 'basic') {
  const key = `${color}-${kind}`;
  if (state.materialCache.has(key)) return state.materialCache.get(key);
  let value;
  if (kind === 'debris') {
    value = new THREE.MeshStandardMaterial({ color: 0x07111f, emissive: color, emissiveIntensity: .72, metalness: .72, roughness: .32 });
  } else {
    value = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  }
  state.materialCache.set(key, value);
  return value;
}

function addEffect(effect) {
  state.effects.push(effect);
  while (state.effects.length > MAX_FX) disposeEffect(state.effects.shift());
  startLoop();
}

function disposeEffect(effect) {
  if (!effect) return;
  effect.mesh?.parent?.remove(effect.mesh);
  effect.group?.parent?.remove(effect.group);
  effect.light?.parent?.remove(effect.light);
  if (effect.ownsMaterial) effect.mesh?.material?.dispose?.();
}

function spawnShock(position, color = accent(), strength = 1) {
  const g = state.game || game();
  if (!position || !ensureResources(g)) return;
  const mat = material(color).clone();
  mat.opacity = .72;
  const mesh = new THREE.Mesh(state.ringGeometry, mat);
  mesh.position.copy(position);
  mesh.scale.setScalar(.55 * strength);
  state.root.add(mesh);
  addEffect({ type: 'ring', mesh, age: 0, life: .34 + strength * .08, strength, ownsMaterial: true });
}

function spawnDebris(position, color = accent(), amount = 7, force = 1) {
  const g = state.game || game();
  if (!position || !ensureResources(g)) return;
  const count = Math.min(12, Math.max(3, amount));
  const mat = material(color, 'debris');
  for (let i = 0; i < count; i += 1) {
    const mesh = new THREE.Mesh(state.debrisGeometry, mat);
    mesh.position.copy(position);
    mesh.scale.setScalar(.65 + Math.random() * .9);
    const velocity = new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(8),
      THREE.MathUtils.randFloatSpread(7),
      THREE.MathUtils.randFloatSpread(7),
    ).multiplyScalar(force * (.65 + Math.random() * .75));
    state.root.add(mesh);
    addEffect({ type: 'debris', mesh, velocity, age: 0, life: .4 + Math.random() * .34, spin: THREE.MathUtils.randFloat(.08, .22) });
  }
}

function spawnMuzzle(g) {
  if (!g?.ship || !ensureResources(g)) return;
  const now = performance.now();
  if (now - state.lastMuzzle < 42) return;
  state.lastMuzzle = now;
  const color = accent();
  const flash = new THREE.Mesh(state.flashGeometry, material(color).clone());
  flash.position.set(0, 0, -2.15);
  flash.scale.set(1.45, .72, 2.7);
  g.ship.add(flash);
  const light = new THREE.PointLight(color, 3.2, 7, 2);
  light.position.copy(flash.position);
  g.ship.add(light);
  addEffect({ type: 'muzzle', mesh: flash, light, age: 0, life: .09, ownsMaterial: true });

  const sku = localStorage.getItem(PREMIUM_WEAPON_KEY) || '';
  if (sku === 'WAE-WPN-SINGULARITY' || sku === 'WAE-WPN-ECLIPSE-CNN') {
    const world = new THREE.Vector3();
    flash.getWorldPosition(world);
    spawnShock(world, color, .48);
  }
}

function ensureShield(g) {
  if (!g?.ship) return null;
  if (state.shieldMesh?.parent === g.ship) return state.shieldMesh;
  const geometry = new THREE.SphereGeometry(1.85, 18, 12);
  const mat = new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0, wireframe: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.scale.set(1.18, .72, 1.28);
  mesh.visible = false;
  g.ship.add(mesh);
  state.shieldMesh = mesh;
  return mesh;
}

function pulseShield(g, damage = 10) {
  const shield = ensureShield(g);
  if (!shield) return;
  shield.visible = true;
  shield.material.opacity = clamp(.2 + damage / 80, .24, .62);
  shield.scale.set(1.18, .72, 1.28);
  state.shieldTimer = .24;
}

function directionalImpact(g, source, damage) {
  ensureDom();
  const layer = document.querySelector('#v24-impact-layer');
  if (!layer) return;
  let dx = 0;
  let dy = 0;
  if (source && g?.ship?.position) {
    dx = clamp(Number(source.x - g.ship.position.x) || 0, -16, 16) / 16;
    dy = clamp(Number(source.y - g.ship.position.y) || 0, -10, 10) / 10;
  }
  layer.style.setProperty('--v24-hit-x', `${50 + dx * 33}%`);
  layer.style.setProperty('--v24-hit-y', `${50 - dy * 28}%`);
  layer.style.setProperty('--v24-hit-alpha', String(clamp(.22 + Number(damage || 0) / 95, .24, .62)));
  layer.classList.remove('hit');
  void layer.offsetWidth;
  layer.classList.add('hit');
  window.clearTimeout(directionalImpact.timer);
  directionalImpact.timer = window.setTimeout(() => layer.classList.remove('hit'), 150);
}

function screenPoint(position) {
  const g = state.game || game();
  if (!position || !g?.camera) return null;
  const p = position.clone().project(g.camera);
  if (p.z < -1 || p.z > 1) return null;
  return { x: (p.x * .5 + .5) * innerWidth, y: (-p.y * .5 + .5) * innerHeight };
}

function combatText(position, text, tone = 'cyan') {
  const point = screenPoint(position);
  if (!point) return;
  const el = document.createElement('div');
  el.className = `v24-combat-text ${tone}`;
  el.textContent = text;
  el.style.left = `${point.x}px`;
  el.style.top = `${point.y}px`;
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => el.remove(), 620);
}

function abilityPulse(kind) {
  const g = state.game || game();
  if (!g?.ship) return;
  const position = new THREE.Vector3();
  g.ship.getWorldPosition(position);
  const palette = kind === 'dash' ? 0x60a5fa : kind === 'missile' ? 0xfbbf24 : 0xc084fc;
  spawnShock(position, palette, kind === 'nova' ? 1.25 : .82);
  if (kind === 'nova') spawnDebris(position, palette, 5, .55);
}

function hookAfter(g, name, after) {
  const current = g?.[name];
  if (typeof current !== 'function' || current.__waeV24Wrapped) return;
  function wrapped(...args) {
    const result = current.apply(this, args);
    try { after.call(this, { args, result }); } catch (fxError) { console.warn(`[WAE V24] ${name} FX`, fxError); }
    return result;
  }
  wrapped.__waeV24Wrapped = true;
  wrapped.__waeV24Base = current;
  g[name] = wrapped;
}

function hookFire(g) {
  const current = g?.fire;
  if (typeof current !== 'function' || current.__waeV24Wrapped) return;
  function wrapped(...args) {
    const before = Array.isArray(this.lasers) ? this.lasers.length : 0;
    const result = current.apply(this, args);
    const after = Array.isArray(this.lasers) ? this.lasers.length : before;
    if (after > before) spawnMuzzle(this);
    return result;
  }
  wrapped.__waeV24Wrapped = true;
  wrapped.__waeV24Base = current;
  g.fire = wrapped;
}

function hookDamage(g) {
  const current = g?.damageShip;
  if (typeof current !== 'function' || current.__waeV24Wrapped) return;
  function wrapped(...args) {
    const before = Number(this.shield) || 0;
    const result = current.apply(this, args);
    const after = Number(this.shield) || 0;
    const taken = Math.max(0, before - after);
    if (taken > .01) {
      const source = args?.[1];
      pulseShield(this, taken);
      directionalImpact(this, source, taken);
      document.body.classList.add('v24-damage-punch');
      window.clearTimeout(hookDamage.timer);
      hookDamage.timer = window.setTimeout(() => document.body.classList.remove('v24-damage-punch'), 95);
    }
    return result;
  }
  wrapped.__waeV24Wrapped = true;
  wrapped.__waeV24Base = current;
  g.damageShip = wrapped;
}

function hookBoss(g) {
  const current = g?.defeatBoss;
  if (typeof current !== 'function' || current.__waeV24Wrapped) return;
  function wrapped(...args) {
    const position = this.boss?.position?.clone?.() || new THREE.Vector3(0, 0, -24);
    const result = current.apply(this, args);
    spawnShock(position, 0xfde68a, 2.4);
    spawnDebris(position, 0xfde68a, 12, 1.45);
    combatText(position, 'GUARDIAN DOWN', 'gold');
    document.body.classList.add('v24-boss-break');
    window.setTimeout(() => document.body.classList.remove('v24-boss-break'), 460);
    return result;
  }
  wrapped.__waeV24Wrapped = true;
  wrapped.__waeV24Base = current;
  g.defeatBoss = wrapped;
}

function installHooks(g) {
  hookFire(g);
  hookDamage(g);
  hookBoss(g);

  hookAfter(g, 'createExplosion', function ({ args }) {
    const position = args?.[0];
    const color = Number(args?.[1]) || accent();
    const count = Number(args?.[2]) || 5;
    if (position?.isVector3) {
      spawnShock(position, color, clamp(count / 10, .45, 1.35));
      if (count >= 8) spawnDebris(position, color, clamp(Math.round(count / 2), 4, 10), clamp(count / 12, .55, 1.2));
    }
  });

  hookAfter(g, 'registerDroneKill', function ({ args }) {
    const position = args?.[0];
    if (position?.isVector3) {
      spawnShock(position, accent(), .78);
      combatText(position, 'BREAK', 'cyan');
    }
  });

  hookAfter(g, 'activateSecondary', function ({ result }) { if (result) abilityPulse('nova'); });
  hookAfter(g, 'activateDash', function ({ result }) { if (result) abilityPulse('dash'); });
  hookAfter(g, 'activateMissile', function ({ result }) { if (result) abilityPulse('missile'); });
}

function updateReticle(g) {
  const reticle = document.querySelector('#v24-combat-reticle');
  if (!reticle) return;
  const playing = g?.state === 'playing';
  reticle.classList.toggle('show', playing);
  if (!playing) return;
  const heat = clamp(Number(g.heat) || 0, 0, 100);
  reticle.style.setProperty('--v24-heat', `${heat}%`);
  reticle.classList.toggle('overdrive', Boolean(g.overdrive));
}

function animate(now = performance.now()) {
  state.raf = 0;
  const g = state.game || game();
  if (!g) return;
  const dt = Math.min(.05, Math.max(.001, (now - state.last) / 1000));
  state.last = now;

  for (let i = state.effects.length - 1; i >= 0; i -= 1) {
    const fx = state.effects[i];
    fx.age += dt;
    const p = clamp(fx.age / fx.life, 0, 1);
    if (fx.type === 'ring') {
      const scale = (.55 + p * (5.2 + fx.strength * 1.4)) * fx.strength;
      fx.mesh.scale.setScalar(scale);
      fx.mesh.material.opacity = (1 - p) * .68;
    } else if (fx.type === 'debris') {
      fx.velocity.y -= dt * 1.8;
      fx.mesh.position.addScaledVector(fx.velocity, dt);
      fx.mesh.rotation.x += fx.spin;
      fx.mesh.rotation.y += fx.spin * .8;
      fx.mesh.scale.multiplyScalar(1 - dt * 1.5);
    } else if (fx.type === 'muzzle') {
      fx.mesh.scale.multiplyScalar(1 + dt * 8);
      fx.mesh.material.opacity = (1 - p) * .88;
      if (fx.light) fx.light.intensity = (1 - p) * 3.2;
    }
    if (p >= 1) {
      disposeEffect(fx);
      state.effects.splice(i, 1);
    }
  }

  if (state.shieldMesh?.visible) {
    state.shieldTimer = Math.max(0, state.shieldTimer - dt);
    state.shieldMesh.rotation.y += dt * 2.2;
    state.shieldMesh.rotation.z -= dt * 1.4;
    state.shieldMesh.material.opacity *= .87;
    state.shieldMesh.scale.multiplyScalar(1 + dt * .9);
    if (state.shieldTimer <= 0 || state.shieldMesh.material.opacity < .025) state.shieldMesh.visible = false;
  }

  updateReticle(g);
  if (state.effects.length || state.shieldMesh?.visible || g.state === 'playing') startLoop();
}

function startLoop() {
  if (!state.raf) state.raf = requestAnimationFrame(animate);
}

function attachWhenReady(attempt = 0) {
  const g = game();
  if (!g?.scene || !g?.ship) {
    if (attempt < 240) requestAnimationFrame(() => attachWhenReady(attempt + 1));
    return;
  }
  state.game = g;
  ensureDom();
  ensureResources(g);
  ensureShield(g);
  installHooks(g);
  document.body.classList.add('v24-combat-installed');
  startLoop();
}

export function installCombatFeel() {
  if (state.installed) return;
  state.installed = true;
  attachWhenReady();
}
