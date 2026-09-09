import * as THREE from 'three';
import { PREMIUM_PRODUCTS } from '../v11/catalog.js';

const $ = (selector, root = document) => root.querySelector(selector);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const money = (value) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value);
const PRODUCTS = PREMIUM_PRODUCTS;
const PRODUCT_MAP = new Map(PRODUCTS.map((item) => [item.sku, item]));
const OMEGA_SKU = 'WAE-SHIP-AURELION-OMG';
const REDUCED_MOTION = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

const SHIP_PROFILES = Object.freeze({
  'viper-black': [4.3, 5.2, 0.72, 0.9],
  'aegis-sovereign': [5.4, 4.8, 0.92, 1.18],
  'nova-imperium': [5.0, 5.8, 0.82, 1.03],
  'eclipse-x': [6.1, 5.5, 0.70, 0.95],
  'obsidian-one': [5.7, 6.0, 0.78, 1.05],
  'celestial-crown': [6.4, 6.2, 0.86, 1.12],
  'specter-valkyrie': [6.0, 6.6, 0.68, 0.92],
  'titan-dominion': [6.6, 6.4, 1.03, 1.25],
  'seraph-quantum': [6.8, 7.0, 0.78, 1.08],
  'aurelion-sovereign-omega': [7.7, 7.5, 0.95, 1.2],
});

const state = {
  open: false,
  sku: OMEGA_SKU,
  renderer: null,
  scene: null,
  camera: null,
  root: null,
  model: null,
  stage: null,
  clock: new THREE.Clock(),
  raf: 0,
  drag: null,
  autoRotate: !REDUCED_MOTION,
  resizeObserver: null,
};

function game() { return window.__waeNeonRiderGame; }
function itemFor(sku = state.sku) { return PRODUCT_MAP.get(sku) || PRODUCTS[0]; }
function colorOf(item) { return new THREE.Color(item.accent || '#67e8f9'); }
function currentSku(kind) {
  return localStorage.getItem(kind === 'ship' ? 'wae_neon_rider_v12_ship_sku' : 'wae_neon_rider_v12_weapon_sku') || '';
}

function ensureShowroom() {
  let overlay = $('#v2117-luxury-showroom');
  if (overlay) return overlay;
  overlay = document.createElement('section');
  overlay.id = 'v2117-luxury-showroom';
  overlay.className = 'v2117-showroom hidden';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Luxury 3D Showroom');
  overlay.innerHTML = `
    <div class="v2117-backdrop" data-v2117-close></div>
    <div class="v2117-shell">
      <header class="v2117-head">
        <div class="v2117-seal"><span>WAE</span><b>3D</b></div>
        <div><span>WAE PRIVATE SHOWROOM · V21.17</span><h2>LUXURY 3D SHOWROOM</h2><p>Inspección cinematográfica de naves y armamento premium.</p></div>
        <button type="button" data-v2117-close aria-label="Cerrar">×</button>
      </header>
      <div class="v2117-main">
        <section class="v2117-stage-wrap">
          <div class="v2117-stage" data-v2117-stage>
            <div class="v2117-omega-reveal" data-v2117-omega-reveal aria-hidden="true"><i>✦</i><strong>Ω</strong><i>✦</i><span>OMEGA REVEAL</span></div>
            <div class="v2117-stage-badge"><span data-v2117-kind>NAVE</span><strong data-v2117-rarity>OMEGA</strong></div>
            <div class="v2117-drag-hint">ARRASTRA PARA INSPECCIONAR · 360°</div>
          </div>
          <div class="v2117-stage-controls">
            <button type="button" data-v2117-prev>‹</button>
            <button type="button" data-v2117-autorotate class="active">ROTACIÓN AUTO</button>
            <button type="button" data-v2117-next>›</button>
          </div>
        </section>
        <aside class="v2117-info">
          <div class="v2117-kicker" data-v2117-series>WAE OMEGA SERIES</div>
          <h3 data-v2117-name>WAE AURELION SOVEREIGN Ω</h3>
          <p class="v2117-tagline" data-v2117-tagline></p>
          <p class="v2117-description" data-v2117-description></p>
          <div class="v2117-price"><span>VALOR</span><strong data-v2117-price>$0</strong><small data-v2117-prize></small></div>
          <div class="v2117-stats" data-v2117-stats></div>
          <div class="v2117-actions">
            <button type="button" class="v2117-primary" data-v2117-commerce>COMPRAR</button>
            <button type="button" data-v2117-store>VER CATÁLOGO</button>
          </div>
          <small class="v2117-secure">Compra y propiedad verificadas por el sistema de comercio seguro WAE. El showroom no concede entitlements.</small>
        </aside>
      </div>
      <footer><span>REAL-TIME 3D · PHYSICALLY BASED MATERIALS · SECURE COMMERCE</span><b data-v2117-position>1 / 20</b></footer>
    </div>`;
  document.body.append(overlay);
  state.stage = $('[data-v2117-stage]', overlay);
  return overlay;
}

function makeMaterial(item, options = {}) {
  const accent = colorOf(item);
  const color = options.color ? new THREE.Color(options.color) : new THREE.Color(0x111827).lerp(accent, options.mix ?? 0.12);
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: options.metalness ?? 0.9,
    roughness: options.roughness ?? 0.18,
    clearcoat: options.clearcoat ?? 0.72,
    clearcoatRoughness: 0.12,
    emissive: options.emissive ? accent : new THREE.Color(0x000000),
    emissiveIntensity: options.emissive ? (options.emissiveIntensity ?? 0.35) : 0,
  });
}

function glowMaterial(item, opacity = 0.9) {
  return new THREE.MeshBasicMaterial({ color: colorOf(item), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
}

function addEngine(group, item, x, z, scale = 1) {
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * scale, 0.34 * scale, 0.9 * scale, 18), glowMaterial(item, 0.88));
  core.rotation.x = Math.PI / 2;
  core.position.set(x, 0, z);
  group.add(core);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36 * scale, 0.045 * scale, 8, 28), glowMaterial(item, 0.72));
  ring.position.set(x, 0, z + 0.38 * scale);
  group.add(ring);
}

function createShip(item) {
  const profile = SHIP_PROFILES[item.id] || [5.4, 5.8, 0.8, 1];
  const [span, length, height, heft] = profile;
  const omega = item.sku === OMEGA_SKU;
  const group = new THREE.Group();
  group.name = `SHOWROOM_${item.id}`;

  const hullMat = makeMaterial(item, { mix: omega ? 0.22 : 0.1, roughness: omega ? 0.1 : 0.17, clearcoat: 0.92 });
  const accentMat = makeMaterial(item, { mix: 0.54, roughness: 0.12, metalness: 0.96 });
  const darkMat = makeMaterial(item, { color: 0x020617, mix: 0.04, roughness: 0.23 });

  const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(0.68 * heft, length * 0.42, 8, 18), hullMat);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.scale.set(1, 0.78, 1);
  group.add(fuselage);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.68 * heft, length * 0.42, omega ? 8 : 6), hullMat.clone());
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -length * 0.42;
  group.add(nose);

  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, -0.45);
  wingShape.lineTo(span * 0.5, 0.15);
  wingShape.lineTo(span * 0.42, 0.62);
  wingShape.lineTo(0.65, 0.32);
  wingShape.closePath();
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.10 * height, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 1 });
  wingGeo.rotateX(Math.PI / 2);
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(wingGeo, hullMat.clone());
    wing.scale.x = side;
    wing.position.set(0, -0.12, 0.2);
    group.add(wing);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(span * 0.36, 0.05, 0.08), glowMaterial(item, 0.74));
    rail.position.set(side * span * 0.28, 0.12, 0.3);
    rail.rotation.y = side * -0.05;
    group.add(rail);
  }

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.56 * heft, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), new THREE.MeshPhysicalMaterial({ color: colorOf(item).clone().lerp(new THREE.Color(0xe0f2fe), 0.5), metalness: 0.2, roughness: 0.05, transmission: 0.25, transparent: true, opacity: 0.82, clearcoat: 1 }));
  canopy.scale.set(0.75, 0.5, 1.35);
  canopy.position.set(0, height * 0.42, -length * 0.16);
  group.add(canopy);

  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, length * 0.7), glowMaterial(item, 0.72));
  spine.position.set(0, height * 0.34, 0.18);
  group.add(spine);

  addEngine(group, item, -0.46 * heft, length * 0.37, 1.0);
  addEngine(group, item, 0.46 * heft, length * 0.37, 1.0);
  if (heft > 1.1 || omega) addEngine(group, item, 0, length * 0.43, 1.18);

  const reactor = new THREE.Mesh(new THREE.OctahedronGeometry(0.36 * heft, omega ? 2 : 1), glowMaterial(item, 0.92));
  reactor.position.set(0, height * 0.45, length * 0.12);
  group.add(reactor);

  if (['celestial-crown', 'seraph-quantum', 'aurelion-sovereign-omega'].includes(item.id)) {
    const crown = new THREE.Mesh(new THREE.TorusGeometry(span * 0.24, 0.035, 8, 48), glowMaterial(item, 0.64));
    crown.rotation.x = Math.PI / 2;
    crown.position.z = -0.25;
    group.add(crown);
  }

  if (omega) {
    const halo = new THREE.Mesh(new THREE.TorusGeometry(span * 0.37, 0.055, 10, 64), glowMaterial(item, 0.58));
    halo.rotation.x = Math.PI / 2;
    halo.rotation.z = Math.PI / 4;
    halo.position.set(0, 0.05, 0.45);
    halo.userData.omegaHalo = true;
    group.add(halo);
    for (const side of [-1, 1]) {
      const spear = new THREE.Mesh(new THREE.ConeGeometry(0.12, 2.2, 6), accentMat.clone());
      spear.rotation.x = -Math.PI / 2;
      spear.position.set(side * span * 0.46, 0.1, -0.15);
      group.add(spear);
    }
    const crownTop = new THREE.Mesh(new THREE.TorusKnotGeometry(0.72, 0.055, 96, 8, 2, 3), glowMaterial(item, 0.42));
    crownTop.position.set(0, 1.05, -0.2);
    crownTop.scale.y = 0.45;
    crownTop.userData.omegaCrown = true;
    group.add(crownTop);
  }

  const under = new THREE.Mesh(new THREE.BoxGeometry(1.2 * heft, 0.16, length * 0.48), darkMat);
  under.position.set(0, -0.42 * height, 0.15);
  group.add(under);
  group.rotation.x = -0.18;
  return group;
}

function createWeapon(item) {
  const group = new THREE.Group();
  const accent = glowMaterial(item, 0.84);
  const bodyMat = makeMaterial(item, { mix: 0.14, roughness: 0.16 });
  const scale = 1 + Math.max(0, (Number(item.stats?.damage) || 100) - 100) / 400;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.65 * scale, 0.82 * scale, 5.2 * scale, 10), bodyMat);
  body.rotation.z = Math.PI / 2;
  group.add(body);
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.72 * scale, 1), accent);
  group.add(core);
  const lanes = clamp(Math.round((Number(item.stats?.coverage) || 100) / 38), 3, 7);
  for (let i = 0; i < lanes; i += 1) {
    const y = (i - (lanes - 1) / 2) * 0.34;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 4.4 * scale, 8), bodyMat.clone());
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(1.45 * scale, y, 0);
    group.add(barrel);
    const emitter = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), accent.clone());
    emitter.position.set(3.65 * scale, y, 0);
    group.add(emitter);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05 * scale, 0.055, 8, 40), accent.clone());
  ring.rotation.y = Math.PI / 2;
  ring.userData.weaponRing = true;
  group.add(ring);
  return group;
}

function disposeObject(object) {
  if (!object) return;
  object.traverse?.((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((material) => material?.dispose?.());
    else child.material?.dispose?.();
  });
  object.parent?.remove(object);
}

function initRenderer() {
  if (state.renderer) return;
  const stage = state.stage || $('[data-v2117-stage]', ensureShowroom());
  state.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  state.renderer.outputColorSpace = THREE.SRGBColorSpace;
  state.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  state.renderer.toneMappingExposure = 1.18;
  state.renderer.shadowMap.enabled = false;
  state.renderer.domElement.className = 'v2117-canvas';
  stage.prepend(state.renderer.domElement);

  state.scene = new THREE.Scene();
  state.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  state.camera.position.set(0, 4.2, 13.8);
  state.camera.lookAt(0, 0, 0);
  state.root = new THREE.Group();
  state.scene.add(state.root);

  state.scene.add(new THREE.HemisphereLight(0xdbeafe, 0x050816, 2.0));
  const key = new THREE.DirectionalLight(0xffffff, 4.2);
  key.position.set(5, 7, 6);
  state.scene.add(key);
  const rim = new THREE.DirectionalLight(0x60a5fa, 3.0);
  rim.position.set(-6, 2, -5);
  state.scene.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(7.8, 64), new THREE.MeshPhysicalMaterial({ color: 0x050816, metalness: 0.72, roughness: 0.22, transparent: true, opacity: 0.72 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.15;
  state.scene.add(floor);
  const floorRing = new THREE.Mesh(new THREE.RingGeometry(3.9, 4.0, 96), new THREE.MeshBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
  floorRing.rotation.x = -Math.PI / 2;
  floorRing.position.y = -2.13;
  state.scene.add(floorRing);

  const resize = () => {
    const rect = stage.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    state.renderer.setSize(width, height, false);
    state.camera.aspect = width / height;
    state.camera.updateProjectionMatrix();
  };
  state.resizeObserver = new ResizeObserver(resize);
  state.resizeObserver.observe(stage);
  resize();
  installStagePointerEvents(stage);
}

function installStagePointerEvents(stage) {
  stage.addEventListener('pointerdown', (event) => {
    state.drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    stage.setPointerCapture?.(event.pointerId);
    state.autoRotate = false;
    updateAutorotateButton();
  });
  stage.addEventListener('pointermove', (event) => {
    if (!state.drag || state.drag.id !== event.pointerId || !state.model) return;
    const dx = event.clientX - state.drag.x;
    const dy = event.clientY - state.drag.y;
    state.drag.x = event.clientX;
    state.drag.y = event.clientY;
    state.model.rotation.y += dx * 0.012;
    state.model.rotation.x = clamp(state.model.rotation.x + dy * 0.007, -0.5, 0.35);
  });
  const end = (event) => { if (state.drag?.id === event.pointerId) state.drag = null; };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
}

function compareBase(item) {
  const sku = currentSku(item.kind);
  const comparison = PRODUCT_MAP.get(sku);
  return comparison?.kind === item.kind && comparison.sku !== item.sku ? comparison : null;
}

function statMarkup(item) {
  const base = compareBase(item);
  return Object.entries(item.stats || {}).map(([key, value]) => {
    const labels = { speed: 'VELOCIDAD', shield: 'ESCUDO', fireRate: 'CADENCIA', power: 'POTENCIA', damage: 'DAÑO', cadence: 'CADENCIA', coverage: 'COBERTURA', special: 'ESPECIAL' };
    const max = item.kind === 'ship' ? 450 : 360;
    const pct = clamp(Math.round(Number(value) / max * 100), 8, 100);
    const delta = base ? Number(value) - Number(base.stats?.[key] || 0) : 0;
    const deltaText = base ? `<small class="${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}">${delta > 0 ? '+' : ''}${delta}</small>` : '<small>—</small>';
    return `<article><div><span>${labels[key] || key.toUpperCase()}</span><strong>${value}</strong>${deltaText}</div><i><b style="width:${pct}%"></b></i></article>`;
  }).join('');
}

function renderInfo(item) {
  const overlay = ensureShowroom();
  overlay.classList.toggle('is-omega', item.sku === OMEGA_SKU);
  $('[data-v2117-kind]', overlay).textContent = item.kind === 'ship' ? 'NAVE' : 'ARMA';
  $('[data-v2117-rarity]', overlay).textContent = item.rarity;
  $('[data-v2117-series]', overlay).textContent = item.series;
  $('[data-v2117-name]', overlay).textContent = item.name;
  $('[data-v2117-tagline]', overlay).textContent = item.tagline;
  $('[data-v2117-description]', overlay).textContent = item.description;
  $('[data-v2117-price]', overlay).textContent = money(item.priceMxn);
  $('[data-v2117-prize]', overlay).textContent = item.sku === OMEGA_SKU ? 'PREMIO MAYOR · FOUNDERS CIRCUIT' : 'COMPRA DIGITAL · ENTITLEMENT SEGURO';
  $('[data-v2117-stats]', overlay).innerHTML = statMarkup(item);
  const button = $(`[data-buy-sku="${item.sku}"]`);
  $('[data-v2117-commerce]', overlay).textContent = button?.textContent?.trim() || 'COMPRAR';
  $('[data-v2117-position]', overlay).textContent = `${PRODUCTS.findIndex((entry) => entry.sku === item.sku) + 1} / ${PRODUCTS.length}`;
  const reveal = $('[data-v2117-omega-reveal]', overlay);
  reveal?.classList.toggle('show', item.sku === OMEGA_SKU && !REDUCED_MOTION);
  if (reveal?.classList.contains('show')) window.setTimeout(() => reveal.classList.remove('show'), 1900);
}

function loadProduct(sku) {
  const item = itemFor(sku);
  state.sku = item.sku;
  initRenderer();
  disposeObject(state.model);
  state.model = item.kind === 'ship' ? createShip(item) : createWeapon(item);
  state.model.scale.setScalar(item.kind === 'ship' ? 0.82 : 0.76);
  state.model.rotation.set(-0.12, item.sku === OMEGA_SKU ? -0.55 : -0.3, 0);
  state.root.add(state.model);
  const accent = colorOf(item);
  state.scene.traverse((object) => {
    if (object.isDirectionalLight && object !== state.scene.children.find((entry) => entry.isDirectionalLight)) object.color.lerp(accent, 0.35);
  });
  renderInfo(item);
}

function updateAutorotateButton() {
  const button = $('[data-v2117-autorotate]', ensureShowroom());
  if (!button) return;
  button.classList.toggle('active', state.autoRotate);
  button.textContent = state.autoRotate ? 'ROTACIÓN AUTO' : 'ROTACIÓN MANUAL';
}

function cycle(delta) {
  const index = PRODUCTS.findIndex((item) => item.sku === state.sku);
  const next = (index + delta + PRODUCTS.length) % PRODUCTS.length;
  loadProduct(PRODUCTS[next].sku);
}

function openShowroom(sku = OMEGA_SKU) {
  const g = game();
  if (g?.state === 'playing') g.pause?.();
  const overlay = ensureShowroom();
  overlay.classList.remove('hidden');
  document.body.classList.add('v2117-showroom-open');
  state.open = true;
  state.clock.start();
  loadProduct(PRODUCT_MAP.has(sku) ? sku : OMEGA_SKU);
  startLoop();
}

function closeShowroom() {
  ensureShowroom().classList.add('hidden');
  document.body.classList.remove('v2117-showroom-open');
  state.open = false;
  cancelAnimationFrame(state.raf);
  state.raf = 0;
}

function startLoop() {
  if (state.raf) return;
  const frame = () => {
    if (!state.open || !state.renderer || !state.scene || !state.camera) { state.raf = 0; return; }
    const dt = Math.min(state.clock.getDelta(), 0.05);
    if (state.model) {
      if (state.autoRotate && !REDUCED_MOTION) state.model.rotation.y += dt * (state.sku === OMEGA_SKU ? 0.34 : 0.25);
      state.model.position.y = REDUCED_MOTION ? 0 : Math.sin(performance.now() * 0.0014) * 0.11;
      const halo = state.model.children.find((child) => child.userData?.omegaHalo);
      if (halo && !REDUCED_MOTION) halo.rotation.z += dt * 0.42;
      const crown = state.model.children.find((child) => child.userData?.omegaCrown);
      if (crown && !REDUCED_MOTION) crown.rotation.y -= dt * 0.5;
      const ring = state.model.children.find((child) => child.userData?.weaponRing);
      if (ring && !REDUCED_MOTION) ring.rotation.x += dt * 0.7;
    }
    state.renderer.render(state.scene, state.camera);
    state.raf = requestAnimationFrame(frame);
  };
  state.raf = requestAnimationFrame(frame);
}

function openStoreAt(item) {
  closeShowroom();
  $('[data-open-v11-store]')?.click();
  window.setTimeout(() => {
    $(`[data-store-filter="${item.kind}"]`)?.click();
    const card = $(`[data-buy-sku="${item.sku}"]`)?.closest('.v11-product');
    card?.scrollIntoView?.({ behavior: REDUCED_MOTION ? 'auto' : 'smooth', block: 'center' });
  }, 80);
}

function commerceAction(item) {
  const button = $(`[data-buy-sku="${item.sku}"]`);
  if (!button) { openStoreAt(item); return; }
  closeShowroom();
  button.click();
}

function decorateCards() {
  for (const buyButton of document.querySelectorAll('[data-buy-sku]')) {
    const card = buyButton.closest('.v11-product');
    if (!card || card.querySelector('[data-v2117-view3d]')) continue;
    const sku = buyButton.dataset.buySku;
    if (!PRODUCT_MAP.has(sku)) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'v2117-view3d';
    button.dataset.v2117View3d = sku;
    button.innerHTML = '<span>◉</span> VER EN 3D';
    const buy = card.querySelector('.v11-product__buy');
    buy?.insertAdjacentElement('beforebegin', button);
  }
}

function installEvents() {
  document.addEventListener('click', (event) => {
    const view = event.target.closest('[data-v2117-view3d]');
    if (view) { event.preventDefault(); openShowroom(view.dataset.v2117View3d); return; }
    if (event.target.closest('[data-v2117-close]')) { event.preventDefault(); closeShowroom(); return; }
    if (event.target.closest('[data-v2117-prev]')) { event.preventDefault(); cycle(-1); return; }
    if (event.target.closest('[data-v2117-next]')) { event.preventDefault(); cycle(1); return; }
    if (event.target.closest('[data-v2117-autorotate]')) { event.preventDefault(); state.autoRotate = !state.autoRotate; updateAutorotateButton(); return; }
    if (event.target.closest('[data-v2117-commerce]')) { event.preventDefault(); commerceAction(itemFor()); return; }
    if (event.target.closest('[data-v2117-store]')) { event.preventDefault(); openStoreAt(itemFor()); }
  }, true);
  document.addEventListener('keydown', (event) => {
    if (!state.open) return;
    if (event.key === 'Escape') { event.stopImmediatePropagation(); closeShowroom(); }
    if (event.key === 'ArrowLeft') cycle(-1);
    if (event.key === 'ArrowRight') cycle(1);
  }, true);
}

ensureShowroom();
decorateCards();
installEvents();
window.setInterval(decorateCards, 1200);
window.addEventListener('pageshow', decorateCards);

window.__waeLuxuryShowroom = Object.freeze({
  open: openShowroom,
  close: closeShowroom,
  getCurrent: () => itemFor(),
  openOmega: () => openShowroom(OMEGA_SKU),
});
