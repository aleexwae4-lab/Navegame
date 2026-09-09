import * as THREE from 'three';
import { PREMIUM_PRODUCTS } from '../v11/catalog.js';
import { commerceSnapshot, refreshEntitlements, subscribeCommerce } from '../v12/backend.js';

const $ = (selector, root = document) => root.querySelector(selector);
const money = (value) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value);
const OMEGA_SKU = 'WAE-SHIP-AURELION-OMG';
const PRESET_KEY = 'wae_neon_rider_v21_hangar_loadouts_v1';
const SHIP_KEY = 'wae_neon_rider_v12_ship_sku';
const WEAPON_KEY = 'wae_neon_rider_v12_weapon_sku';
const PRODUCTS = PREMIUM_PRODUCTS;
const SHIPS = PRODUCTS.filter((item) => item.kind === 'ship');
const WEAPONS = PRODUCTS.filter((item) => item.kind === 'weapon');
const PRODUCT_MAP = new Map(PRODUCTS.map((item) => [item.sku, item]));
const REDUCED_MOTION = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

const state = {
  open: false,
  snapshot: commerceSnapshot(),
  renderer: null,
  scene: null,
  camera: null,
  world: null,
  shipsRoot: null,
  models: [],
  raf: 0,
  clock: new THREE.Clock(),
  stage: null,
  resizeObserver: null,
  drag: null,
  yaw: -0.08,
  selectedShip: localStorage.getItem(SHIP_KEY) || '',
  selectedWeapon: localStorage.getItem(WEAPON_KEY) || '',
};

function game() { return window.__waeNeonRiderGame; }
function ownedSet() { return new Set(state.snapshot?.ownedSkus || []); }
function ownedItems(kind) {
  const owned = ownedSet();
  return PRODUCTS.filter((item) => item.kind === kind && owned.has(item.sku));
}

function loadPresets() {
  try {
    const raw = JSON.parse(localStorage.getItem(PRESET_KEY) || 'null');
    if (Array.isArray(raw)) return [0, 1, 2].map((index) => ({ shipSku: raw[index]?.shipSku || '', weaponSku: raw[index]?.weaponSku || '' }));
  } catch {}
  return [{ shipSku: '', weaponSku: '' }, { shipSku: '', weaponSku: '' }, { shipSku: '', weaponSku: '' }];
}

function savePresets(presets) {
  try { localStorage.setItem(PRESET_KEY, JSON.stringify(presets.slice(0, 3))); } catch {}
}

function ensureHangar() {
  let overlay = $('#v2118-collection-hangar');
  if (overlay) return overlay;
  overlay = document.createElement('section');
  overlay.id = 'v2118-collection-hangar';
  overlay.className = 'v2118-hangar hidden';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Pilot Collection Hangar');
  overlay.innerHTML = `
    <div class="v2118-backdrop" data-v2118-close></div>
    <div class="v2118-shell">
      <header class="v2118-head">
        <div class="v2118-seal"><span>WAE</span><b>HGR</b></div>
        <div><span>WAE PILOT COLLECTION · V21.18</span><h2>PILOT COLLECTION HANGAR</h2><p>Tu colección verificada, estacionada y lista para combate.</p></div>
        <button type="button" data-v2118-close aria-label="Cerrar">×</button>
      </header>
      <section class="v2118-summary" data-v2118-summary></section>
      <div class="v2118-main">
        <section class="v2118-stage-wrap">
          <div class="v2118-stage" data-v2118-stage>
            <div class="v2118-stage-chip"><span>PRIVATE BAY</span><strong data-v2118-stage-count>0 NAVES</strong></div>
            <div class="v2118-drag">ARRASTRA PARA RECORRER EL HANGAR</div>
          </div>
          <div class="v2118-stage-actions">
            <button type="button" data-v2118-sync>↻ SYNC COLECCIÓN</button>
            <button type="button" data-v2118-showroom>◉ INSPECCIONAR 3D</button>
          </div>
        </section>
        <aside class="v2118-loadout">
          <div class="v2118-loadout-head"><span>ACTIVE FLIGHT DECK</span><h3>LOADOUT</h3><p>Selecciona nave y arma. Cada cambio se valida contra tu propiedad actual.</p></div>
          <section class="v2118-selector"><div class="v2118-selector-title"><span>NAVE</span><strong data-v2118-selected-ship>ESTÁNDAR</strong></div><div class="v2118-choice-row" data-v2118-ships></div></section>
          <section class="v2118-selector"><div class="v2118-selector-title"><span>ARMA</span><strong data-v2118-selected-weapon>ESTÁNDAR</strong></div><div class="v2118-choice-row" data-v2118-weapons></div></section>
          <section class="v2118-presets"><div><span>LOADOUT PRESETS</span><small>Guarda hasta 3 configuraciones.</small></div><div data-v2118-presets></div></section>
          <button type="button" class="v2118-launch" data-v2118-launch>LANZAR OPERACIÓN</button>
          <small class="v2118-secure">Los presets no conceden propiedad. Al cargar, cada SKU vuelve a verificarse contra los entitlements del servidor.</small>
        </aside>
      </div>
      <footer><span>SERVER-VERIFIED COLLECTION · 3D PRIVATE BAY · LOADOUT PRESETS</span><b>WAE NEON RIDER</b></footer>
    </div>`;
  document.body.append(overlay);
  state.stage = $('[data-v2118-stage]', overlay);
  return overlay;
}

function ensureLaunchers() {
  const start = $('#start-screen .start-meta');
  if (start && !start.querySelector('[data-v2118-open]')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.v2118Open = 'true';
    button.className = 'v2118-open';
    button.innerHTML = '<span>⌂</span><b>MI HANGAR</b><small data-v2118-launcher-count>0 NAVES</small>';
    start.append(button);
  }
  const pause = $('#pause-screen .panel');
  if (pause && !pause.querySelector('[data-v2118-open]')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.v2118Open = 'true';
    button.className = 'v2118-pause-open';
    button.textContent = '⌂  PILOT HANGAR';
    pause.append(button);
  }
  const count = ownedItems('ship').length;
  for (const node of document.querySelectorAll('[data-v2118-launcher-count]')) node.textContent = `${count} ${count === 1 ? 'NAVE' : 'NAVES'}`;
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

function hullMaterial(item, ghost = false) {
  const accent = new THREE.Color(item?.accent || '#67e8f9');
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x111827).lerp(accent, item?.sku === OMEGA_SKU ? 0.24 : 0.1),
    metalness: 0.92,
    roughness: item?.sku === OMEGA_SKU ? 0.09 : 0.18,
    clearcoat: 0.88,
    clearcoatRoughness: 0.1,
    transparent: ghost,
    opacity: ghost ? 0.22 : 1,
  });
}

function glowMaterial(item, opacity = 0.8) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(item?.accent || '#67e8f9'), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
}

function buildParkedShip(item, { ghost = false } = {}) {
  const group = new THREE.Group();
  const speed = Number(item?.stats?.speed || 120);
  const shield = Number(item?.stats?.shield || 120);
  const power = Number(item?.stats?.power || 120);
  const span = 3.6 + Math.min(2.4, power / 190);
  const length = 4.3 + Math.min(2.6, speed / 160);
  const heft = 0.72 + Math.min(0.48, shield / 600);
  const mat = hullMaterial(item, ghost);
  const glow = glowMaterial(item, ghost ? 0.3 : 0.75);

  const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.5 * heft, length * 0.32, 6, 12), mat);
  hull.rotation.x = Math.PI / 2;
  hull.scale.y = 0.72;
  group.add(hull);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.52 * heft, length * 0.34, item?.sku === OMEGA_SKU ? 8 : 6), mat.clone());
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -length * 0.34;
  group.add(nose);

  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(span * 0.42, 0.08, length * 0.42), mat.clone());
    wing.position.set(side * span * 0.27, -0.04, 0.05);
    wing.rotation.y = side * 0.11;
    group.add(wing);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(span * 0.35, 0.035, 0.07), glow.clone());
    rail.position.set(side * span * 0.28, 0.13, 0.05);
    group.add(rail);
  }

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.38 * heft, 16, 8), new THREE.MeshPhysicalMaterial({ color: new THREE.Color(item?.accent || '#67e8f9'), metalness: 0.15, roughness: 0.04, transparent: true, opacity: ghost ? 0.18 : 0.7, clearcoat: 1 }));
  canopy.scale.set(0.75, 0.5, 1.35);
  canopy.position.set(0, 0.42, -length * 0.12);
  group.add(canopy);

  for (const x of [-0.34, 0.34]) {
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.21, 0.65, 12), glow.clone());
    engine.rotation.x = Math.PI / 2;
    engine.position.set(x, -0.04, length * 0.3);
    group.add(engine);
  }

  if (item?.sku === OMEGA_SKU) {
    const halo = new THREE.Mesh(new THREE.TorusGeometry(span * 0.4, 0.045, 8, 48), glow.clone());
    halo.rotation.x = Math.PI / 2;
    halo.rotation.z = Math.PI / 4;
    halo.position.y = 0.04;
    halo.userData.v2118Omega = true;
    group.add(halo);
    const crown = new THREE.Mesh(new THREE.TorusKnotGeometry(0.56, 0.045, 64, 8, 2, 3), glow.clone());
    crown.position.set(0, 0.9, -0.2);
    crown.scale.y = 0.42;
    crown.userData.v2118Omega = true;
    group.add(crown);
  }

  group.rotation.x = -0.08;
  return group;
}

function buildBay() {
  if (!state.scene || !state.shipsRoot) return;
  for (const model of state.models) disposeObject(model);
  state.models = [];
  while (state.shipsRoot.children.length) disposeObject(state.shipsRoot.children[0]);

  const ownedShips = ownedItems('ship');
  const selected = state.selectedShip;
  const visibleShips = ownedShips.slice(0, 10);
  const columns = Math.min(5, Math.max(1, visibleShips.length));
  const rows = Math.ceil(visibleShips.length / columns);

  visibleShips.forEach((item, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const x = (col - (columns - 1) / 2) * 4.2;
    const z = (row - (rows - 1) / 2) * 5.1;
    const pad = new THREE.Group();
    pad.position.set(x, 0, z);
    pad.userData.sku = item.sku;

    const ring = new THREE.Mesh(new THREE.RingGeometry(1.65, 1.75, 56), new THREE.MeshBasicMaterial({ color: new THREE.Color(item.accent), transparent: true, opacity: selected === item.sku ? 0.95 : 0.34, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -1.08;
    pad.add(ring);
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.95, 0.24, 48), new THREE.MeshPhysicalMaterial({ color: 0x050816, metalness: 0.88, roughness: 0.24 }));
    platform.position.y = -1.22;
    pad.add(platform);
    const model = buildParkedShip(item);
    model.scale.setScalar(item.sku === OMEGA_SKU ? 0.5 : 0.46);
    model.position.y = 0.02;
    pad.add(model);
    state.models.push(pad);
    state.shipsRoot.add(pad);
  });

  const omegaOwned = ownedSet().has(OMEGA_SKU);
  if (!omegaOwned) {
    const omega = PRODUCT_MAP.get(OMEGA_SKU);
    const pedestal = new THREE.Group();
    pedestal.position.set(0, 0.2, visibleShips.length > 5 ? -6.7 : -4.8);
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.0, 2.12, 64), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.34, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -1.2;
    pedestal.add(ring);
    const ghost = buildParkedShip(omega, { ghost: true });
    ghost.scale.setScalar(0.55);
    pedestal.add(ghost);
    pedestal.userData.v2118LockedOmega = true;
    state.shipsRoot.add(pedestal);
    state.models.push(pedestal);
  }

  $('[data-v2118-stage-count]', ensureHangar()).textContent = `${ownedShips.length} ${ownedShips.length === 1 ? 'NAVE' : 'NAVES'}`;
}

function initRenderer() {
  if (state.renderer || !state.stage) return;
  state.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  state.renderer.outputColorSpace = THREE.SRGBColorSpace;
  state.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  state.renderer.toneMappingExposure = 1.08;
  state.renderer.domElement.className = 'v2118-canvas';
  state.stage.prepend(state.renderer.domElement);

  state.scene = new THREE.Scene();
  state.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  state.camera.position.set(0, 8.8, 19.5);
  state.camera.lookAt(0, -0.4, 0);
  state.world = new THREE.Group();
  state.shipsRoot = new THREE.Group();
  state.world.add(state.shipsRoot);
  state.scene.add(state.world);

  state.scene.add(new THREE.HemisphereLight(0xdbeafe, 0x020617, 1.8));
  const key = new THREE.DirectionalLight(0xffffff, 3.8);
  key.position.set(6, 10, 7);
  state.scene.add(key);
  const rim = new THREE.DirectionalLight(0x38bdf8, 2.2);
  rim.position.set(-8, 4, -6);
  state.scene.add(rim);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 22), new THREE.MeshPhysicalMaterial({ color: 0x030712, metalness: 0.84, roughness: 0.32 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.35;
  state.scene.add(floor);
  const grid = new THREE.GridHelper(30, 30, 0x334155, 0x111827);
  grid.position.y = -1.33;
  state.scene.add(grid);

  const resize = () => {
    const rect = state.stage.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    state.renderer.setSize(width, height, false);
    state.camera.aspect = width / height;
    state.camera.updateProjectionMatrix();
  };
  state.resizeObserver = new ResizeObserver(resize);
  state.resizeObserver.observe(state.stage);
  resize();

  state.stage.addEventListener('pointerdown', (event) => {
    state.drag = { id: event.pointerId, x: event.clientX };
    state.stage.setPointerCapture?.(event.pointerId);
  });
  state.stage.addEventListener('pointermove', (event) => {
    if (!state.drag || state.drag.id !== event.pointerId) return;
    const dx = event.clientX - state.drag.x;
    state.drag.x = event.clientX;
    state.yaw = Math.max(-0.55, Math.min(0.55, state.yaw + dx * 0.004));
  });
  const end = (event) => { if (state.drag?.id === event.pointerId) state.drag = null; };
  state.stage.addEventListener('pointerup', end);
  state.stage.addEventListener('pointercancel', end);
}

function renderSummary() {
  const overlay = ensureHangar();
  const ownedShips = ownedItems('ship');
  const ownedWeapons = ownedItems('weapon');
  const ownedAll = [...ownedShips, ...ownedWeapons];
  const value = ownedAll.reduce((sum, item) => sum + Number(item.priceMxn || 0), 0);
  const signed = Boolean(state.snapshot?.signedIn);
  $('[data-v2118-summary]', overlay).innerHTML = `
    <article><span>COLECCIÓN</span><strong>${ownedAll.length}/${PRODUCTS.length}</strong><small>${signed ? 'SERVIDOR VERIFICADO' : 'INICIA SESIÓN PARA SYNC'}</small></article>
    <article><span>NAVES</span><strong>${ownedShips.length}</strong><small>EN PRIVATE BAY</small></article>
    <article><span>ARMAS</span><strong>${ownedWeapons.length}</strong><small>DISPONIBLES</small></article>
    <article><span>VALOR COLECCIÓN</span><strong>${money(value)}</strong><small>VALOR DE CATÁLOGO</small></article>`;
}

function itemName(sku, fallback = 'ESTÁNDAR') { return PRODUCT_MAP.get(sku)?.name || fallback; }

function renderChoices(kind) {
  const overlay = ensureHangar();
  const items = ownedItems(kind);
  const selected = kind === 'ship' ? state.selectedShip : state.selectedWeapon;
  const container = kind === 'ship' ? $('[data-v2118-ships]', overlay) : $('[data-v2118-weapons]', overlay);
  const standardActive = !selected || !ownedSet().has(selected);
  container.innerHTML = `<button type="button" class="v2118-choice ${standardActive ? 'active' : ''}" data-v2118-equip-kind="${kind}" data-v2118-equip-sku=""><span>CORE</span><strong>ESTÁNDAR</strong><small>LOADOUT BASE</small></button>${items.map((item) => `<button type="button" class="v2118-choice ${selected === item.sku ? 'active' : ''} ${item.sku === OMEGA_SKU ? 'omega' : ''}" data-v2118-equip-kind="${kind}" data-v2118-equip-sku="${item.sku}"><span>${item.rarity}</span><strong>${item.name}</strong><small>${money(item.priceMxn)}</small></button>`).join('')}`;
  if (kind === 'ship') $('[data-v2118-selected-ship]', overlay).textContent = itemName(standardActive ? '' : selected);
  else $('[data-v2118-selected-weapon]', overlay).textContent = itemName(standardActive ? '' : selected);
}

function renderPresets() {
  const container = $('[data-v2118-presets]', ensureHangar());
  const presets = loadPresets();
  container.innerHTML = presets.map((preset, index) => {
    const ship = itemName(preset.shipSku);
    const weapon = itemName(preset.weaponSku);
    return `<article><div><span>PRESET ${String(index + 1).padStart(2, '0')}</span><strong>${ship}</strong><small>${weapon}</small></div><div><button type="button" data-v2118-load-preset="${index}">CARGAR</button><button type="button" data-v2118-save-preset="${index}">GUARDAR</button></div></article>`;
  }).join('');
}

function render() {
  ensureLaunchers();
  renderSummary();
  renderChoices('ship');
  renderChoices('weapon');
  renderPresets();
  buildBay();
}

function equip(kind, sku) {
  const g = game();
  if (!g) return false;
  if (!sku) {
    g.clearPremiumSelection?.(kind);
    if (kind === 'ship') state.selectedShip = '';
    else state.selectedWeapon = '';
    render();
    return true;
  }
  if (!ownedSet().has(sku)) return false;
  const item = PRODUCT_MAP.get(sku);
  if (!item || item.kind !== kind) return false;
  const result = g.equipPremium?.(sku);
  if (!result?.ok) return false;
  if (kind === 'ship') state.selectedShip = sku;
  else state.selectedWeapon = sku;
  render();
  showToast(`${item.name} · EQUIPADO`);
  return true;
}

function savePreset(index) {
  const presets = loadPresets();
  presets[index] = { shipSku: state.selectedShip, weaponSku: state.selectedWeapon };
  savePresets(presets);
  renderPresets();
  showToast(`PRESET ${index + 1} GUARDADO`);
}

function loadPreset(index) {
  const preset = loadPresets()[index];
  if (!preset) return;
  const owned = ownedSet();
  const shipOk = !preset.shipSku || owned.has(preset.shipSku);
  const weaponOk = !preset.weaponSku || owned.has(preset.weaponSku);
  if (!shipOk || !weaponOk) {
    showToast('PRESET BLOQUEADO · REQUIERE PROPIEDAD ACTUAL');
    return;
  }
  equip('ship', preset.shipSku);
  equip('weapon', preset.weaponSku);
  showToast(`PRESET ${index + 1} CARGADO`);
}

function showToast(message) {
  let toast = $('#v2118-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'v2118-toast';
    toast.className = 'v2118-toast';
    document.body.append(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 1700);
}

function startLoop() {
  if (state.raf) return;
  const frame = () => {
    if (!state.open || !state.renderer || !state.scene || !state.camera) { state.raf = 0; return; }
    const dt = Math.min(state.clock.getDelta(), 0.05);
    if (state.world) state.world.rotation.y += (state.yaw - state.world.rotation.y) * Math.min(1, dt * 6);
    if (!REDUCED_MOTION) {
      for (const pad of state.models) {
        const model = pad.children.find((child) => child.type === 'Group');
        if (model) model.position.y = Math.sin(performance.now() * 0.0012 + pad.position.x) * 0.035;
        for (const child of model?.children || []) if (child.userData?.v2118Omega) child.rotation.z += dt * 0.28;
      }
    }
    state.renderer.render(state.scene, state.camera);
    state.raf = requestAnimationFrame(frame);
  };
  state.raf = requestAnimationFrame(frame);
}

function openHangar() {
  const g = game();
  if (g?.state === 'playing') g.pause?.();
  state.snapshot = commerceSnapshot();
  state.selectedShip = localStorage.getItem(SHIP_KEY) || '';
  state.selectedWeapon = localStorage.getItem(WEAPON_KEY) || '';
  const overlay = ensureHangar();
  overlay.classList.remove('hidden');
  document.body.classList.add('v2118-hangar-open');
  state.open = true;
  initRenderer();
  render();
  state.clock.start();
  startLoop();
}

function closeHangar() {
  ensureHangar().classList.add('hidden');
  document.body.classList.remove('v2118-hangar-open');
  state.open = false;
  cancelAnimationFrame(state.raf);
  state.raf = 0;
}

function openCurrentShowroom() {
  const sku = state.selectedShip || ownedItems('ship')[0]?.sku || OMEGA_SKU;
  closeHangar();
  window.__waeLuxuryShowroom?.open?.(sku);
}

function launch() {
  closeHangar();
  const g = game();
  if (g?.state === 'paused') g.resume?.();
  else if (g?.state === 'idle' || g?.state === 'gameover') $('#start-btn')?.click();
}

function installEvents() {
  document.addEventListener('click', async (event) => {
    if (event.target.closest('[data-v2118-open]')) { event.preventDefault(); openHangar(); return; }
    if (event.target.closest('[data-v2118-close]')) { event.preventDefault(); closeHangar(); return; }
    if (event.target.closest('[data-v2118-showroom]')) { event.preventDefault(); openCurrentShowroom(); return; }
    if (event.target.closest('[data-v2118-launch]')) { event.preventDefault(); launch(); return; }
    const equipButton = event.target.closest('[data-v2118-equip-kind]');
    if (equipButton) { event.preventDefault(); equip(equipButton.dataset.v2118EquipKind, equipButton.dataset.v2118EquipSku || ''); return; }
    const saveButton = event.target.closest('[data-v2118-save-preset]');
    if (saveButton) { event.preventDefault(); savePreset(Number(saveButton.dataset.v2118SavePreset)); return; }
    const loadButton = event.target.closest('[data-v2118-load-preset]');
    if (loadButton) { event.preventDefault(); loadPreset(Number(loadButton.dataset.v2118LoadPreset)); return; }
    const sync = event.target.closest('[data-v2118-sync]');
    if (sync) {
      event.preventDefault();
      const original = sync.textContent;
      sync.disabled = true;
      sync.textContent = 'SYNC…';
      try { await refreshEntitlements(); showToast('COLECCIÓN SINCRONIZADA'); }
      catch { showToast('NO SE PUDO SINCRONIZAR'); }
      sync.disabled = false;
      sync.textContent = original;
    }
  }, true);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.open) { event.stopImmediatePropagation(); closeHangar(); }
  }, true);
}

ensureHangar();
ensureLaunchers();
installEvents();
subscribeCommerce((snapshot) => {
  state.snapshot = snapshot;
  if (state.selectedShip && !ownedSet().has(state.selectedShip)) state.selectedShip = '';
  if (state.selectedWeapon && !ownedSet().has(state.selectedWeapon)) state.selectedWeapon = '';
  ensureLaunchers();
  if (state.open) render();
});
window.addEventListener('pageshow', ensureLaunchers);

document.addEventListener('wae:ship-signature-changed', () => { if (state.open) buildBay(); });

window.__waeCollectionHangar = Object.freeze({
  open: openHangar,
  close: closeHangar,
  get: () => ({ owned: [...(state.snapshot?.ownedSkus || [])], shipSku: state.selectedShip, weaponSku: state.selectedWeapon, presets: loadPresets() }),
});
