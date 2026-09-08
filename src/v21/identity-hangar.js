import * as THREE from 'three';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const LIVEOPS_KEY = 'wae_neon_rider_v20_liveops_profile';
const RAID_KEY = 'wae_neon_rider_v19_raid_profile';
const CALLSIGN_KEY = 'wae_neon_rider_callsign';
const ROLE_KEY = 'wae_neon_rider_v18_role';
const PREMIUM_SHIP_KEY = 'wae_neon_rider_v12_ship_sku';
const PREMIUM_WEAPON_KEY = 'wae_neon_rider_v12_weapon_sku';
const MAX_CALLSIGN = 18;

const FRAME_ACCENTS = Object.freeze({
  STANDARD: '#67e8f9', CYAN: '#22d3ee', VIOLET: '#c084fc', OBSIDIAN: '#94a3b8', GOLD: '#fbbf24',
  CELESTIAL: '#fde68a', PRISM: '#e879f9', FOUNDER: '#fef3c7',
});

const PREMIUM_NAMES = Object.freeze({
  'WAE-SHIP-VIPER-BLK': 'VIPER R BLACK EDITION',
  'WAE-SHIP-AEGIS-SOV': 'AEGIS SOVEREIGN',
  'WAE-SHIP-NOVA-IMP': 'NOVA IMPERIUM',
  'WAE-SHIP-ECLIPSE-X': 'WAE ECLIPSE X',
  'WAE-SHIP-OBSIDIAN-1': 'WAE OBSIDIAN ONE',
  'WAE-SHIP-CELESTIAL': 'WAE CELESTIAL CROWN',
  'WAE-WPN-TRIDENT-VXR': 'TRIDENT VX-R',
  'WAE-WPN-STORM-OMG': 'STORM OMEGA',
  'WAE-WPN-ECLIPSE-CNN': 'ECLIPSE CANNON',
  'WAE-WPN-HELIX-RG': 'HELIX RAILGUN',
  'WAE-WPN-NOVA-DST': 'NOVA DESTROYER',
  'WAE-WPN-SINGULARITY': 'WAE SINGULARITY',
});

const RELICS = Object.freeze({
  helix: { name: 'HELIX PRISM', geometry: 'octa', accent: 0x22d3ee },
  forge: { name: 'SOLAR HEART', geometry: 'ico', accent: 0xf97316 },
  seer: { name: 'RIFT EYE', geometry: 'torus', accent: 0xd946ef },
  bastion: { name: 'BASTION SEED', geometry: 'dodeca', accent: 0x34d399 },
});

const state = {
  open: false,
  renderer: null,
  scene: null,
  camera: null,
  root: null,
  shipGroup: null,
  relicGroup: null,
  animation: 0,
  resizeObserver: null,
  dragging: false,
  dragX: 0,
  rotationY: 0.35,
  targetRotationY: 0.35,
  lastTime: performance.now(),
  tickTimer: 0,
};

function game() { return window.__waeNeonRiderGame; }
function safeJson(key, fallback = {}) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch { return fallback; }
}
function saveJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }

function liveProfile() {
  const raw = safeJson(LIVEOPS_KEY, {});
  const cosmetic = raw.cosmetic && typeof raw.cosmetic === 'object' ? raw.cosmetic : { frame: 'STANDARD', title: 'PILOT' };
  const unlocked = Array.isArray(raw.unlocked) ? raw.unlocked : [];
  return { ...raw, cosmetic, unlocked };
}

function raidProfile() {
  const raw = safeJson(RAID_KEY, {});
  return {
    raids: Math.max(0, Number(raw.raids) || 0),
    shards: Math.max(0, Number(raw.shards) || 0),
    bestStreak: Math.max(0, Number(raw.bestStreak) || 0),
    inventory: raw.inventory && typeof raw.inventory === 'object' ? raw.inventory : {},
  };
}

function identity() {
  const live = liveProfile();
  const g = game();
  const premiumShipSku = localStorage.getItem(PREMIUM_SHIP_KEY) || '';
  const premiumWeaponSku = localStorage.getItem(PREMIUM_WEAPON_KEY) || '';
  const ship = g?.getShip?.() || {};
  const weapon = g?.getWeapon?.() || {};
  const seasonLevel = Math.max(1, Math.min(30, Math.floor((Number(live.seasonXp) || 0) / 500) + 1));
  return {
    callsign: String(localStorage.getItem(CALLSIGN_KEY) || 'PILOTO').slice(0, MAX_CALLSIGN),
    title: String(live.cosmetic?.title || 'PILOT').slice(0, 24),
    frame: String(live.cosmetic?.frame || 'STANDARD').slice(0, 24).toUpperCase(),
    level: seasonLevel,
    marks: Math.max(0, Number(live.marks) || 0),
    role: String(localStorage.getItem(ROLE_KEY) || 'assault').toUpperCase(),
    shipName: PREMIUM_NAMES[premiumShipSku] || ship.name || 'WAE FALCON',
    shipClass: ship.className || (premiumShipSku ? 'PREMIUM' : 'STANDARD'),
    weaponName: PREMIUM_NAMES[premiumWeaponSku] || weapon.name || 'PULSE ARRAY',
    weaponClass: weapon.className || (premiumWeaponSku ? 'PREMIUM' : 'STANDARD'),
    shipId: ship.id || premiumShipSku || 'falcon',
    speed: Number(ship.speed) || 1,
    shield: Number(ship.shield) || 1,
    fireRate: Number(ship.fireRate) || 1,
    accent: Number(ship.accent) || 0x22d3ee,
    bestSector: Math.max(1, Number(g?.profile?.bestSector ?? g?.sector) || 1),
    kills: Math.max(0, Number(g?.profile?.totalKills) || 0),
  };
}

function unlockedCosmetics() {
  const profile = liveProfile();
  const frames = new Set(['STANDARD']);
  const titles = new Set(['PILOT']);
  for (const reward of profile.unlocked) {
    const text = String(reward || '').trim().toUpperCase();
    if (text.endsWith(' FRAME')) frames.add(text.replace(/ FRAME$/, ''));
    if (text.endsWith(' TITLE')) titles.add(text.replace(/ TITLE$/, ''));
  }
  if (profile.cosmetic?.frame) frames.add(String(profile.cosmetic.frame).toUpperCase());
  if (profile.cosmetic?.title) titles.add(String(profile.cosmetic.title).toUpperCase());
  return { frames: [...frames], titles: [...titles] };
}

function applyFrame(frame) {
  const key = String(frame || 'STANDARD').toUpperCase();
  const accent = FRAME_ACCENTS[key] || FRAME_ACCENTS.STANDARD;
  document.body.dataset.v21Frame = key.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  document.documentElement.style.setProperty('--v21-identity-accent', accent);
}

function saveCosmetic(kind, value) {
  const allowed = unlockedCosmetics();
  const key = String(value || '').toUpperCase();
  if (kind === 'frame' && !allowed.frames.includes(key)) return false;
  if (kind === 'title' && !allowed.titles.includes(key)) return false;
  const profile = liveProfile();
  profile.cosmetic = { ...profile.cosmetic, [kind]: key };
  saveJson(LIVEOPS_KEY, profile);
  if (kind === 'frame') applyFrame(key);
  window.dispatchEvent(new Event('wae:v21-identity-changed'));
  renderIdentity();
  return true;
}

function saveCallsign(value) {
  const safe = String(value || '').toUpperCase().replace(/[^A-Z0-9 _-]/g, '').trim().slice(0, MAX_CALLSIGN) || 'PILOTO';
  localStorage.setItem(CALLSIGN_KEY, safe);
  const input = $('[data-v21-callsign]');
  if (input) input.value = safe;
  window.dispatchEvent(new Event('wae:v21-identity-changed'));
  renderIdentity();
}

function ensureHangar() {
  let panel = $('#v21-identity-hangar');
  if (panel) return panel;
  panel = document.createElement('section');
  panel.id = 'v21-identity-hangar';
  panel.className = 'v21-identity-hangar hidden';
  panel.setAttribute('aria-hidden', 'true');
  panel.innerHTML = `
    <div class="v21-backdrop" data-v21-close></div>
    <div class="v21-shell" role="dialog" aria-modal="true" aria-label="Identity Hangar">
      <header class="v21-head">
        <div class="v21-emblem"><i></i><b>21</b></div>
        <div><span>WAE PLAYER IDENTITY SYSTEM</span><strong>IDENTITY HANGAR</strong><small>LOADOUT · RELICS · TITLES · FRAMES</small></div>
        <button type="button" data-v21-close aria-label="Cerrar">×</button>
      </header>
      <div class="v21-layout">
        <section class="v21-visual-stage">
          <div class="v21-stage-grid"></div>
          <canvas data-v21-canvas aria-label="Vista 3D de la nave"></canvas>
          <div class="v21-stage-copy"><span data-v21-stage-class>CLASS</span><strong data-v21-stage-ship>SHIP</strong><small>ARRASTRA PARA INSPECCIONAR</small></div>
          <div class="v21-stage-badge"><span data-v21-frame-badge>STANDARD FRAME</span></div>
        </section>
        <aside class="v21-profile-card">
          <div class="v21-profile-kicker">PILOT IDENTITY</div>
          <div class="v21-avatar"><span>WA</span><i></i></div>
          <label class="v21-callsign"><span>CALLSIGN</span><div><input data-v21-callsign maxlength="18" autocomplete="off"><button type="button" data-v21-save-callsign>GUARDAR</button></div></label>
          <strong data-v21-title-display>PILOT</strong>
          <small data-v21-role>ASSAULT · LV 1</small>
          <div class="v21-statline"><span>SECTOR <b data-v21-sector>1</b></span><span>KILLS <b data-v21-kills>0</b></span><span>MARKS <b data-v21-marks>0</b></span></div>
        </aside>
        <section class="v21-card v21-loadout-card">
          <div class="v21-card-head"><div><span>ACTIVE LOADOUT</span><strong>COMBAT CONFIGURATION</strong></div><small>LIVE</small></div>
          <div class="v21-loadout-grid">
            <article><span>SHIP</span><strong data-v21-ship-name>—</strong><small data-v21-ship-class>—</small><div class="v21-mini-bars"><i><b data-v21-speed></b></i><i><b data-v21-shield></b></i><i><b data-v21-fire></b></i></div></article>
            <article><span>WEAPON</span><strong data-v21-weapon-name>—</strong><small data-v21-weapon-class>—</small><div class="v21-weapon-sigil">⌁</div></article>
          </div>
        </section>
        <section class="v21-card v21-cosmetics-card">
          <div class="v21-card-head"><div><span>IDENTITY COSMETICS</span><strong>EQUIPPED / UNLOCKED</strong></div><small>GAMEPLAY</small></div>
          <div class="v21-cosmetic-block"><span>TITLES</span><div data-v21-titles></div></div>
          <div class="v21-cosmetic-block"><span>FRAMES</span><div data-v21-frames></div></div>
        </section>
        <section class="v21-card v21-relic-card">
          <div class="v21-card-head"><div><span>RELIC VAULT</span><strong>RAID ARTIFACTS</strong></div><small data-v21-relic-total>0 RELICS</small></div>
          <div class="v21-relic-grid" data-v21-relics></div>
        </section>
        <section class="v21-card v21-prestige-card">
          <div class="v21-card-head"><div><span>PILOT PRESTIGE</span><strong>IDENTITY SIGNAL</strong></div><small>V21</small></div>
          <div class="v21-prestige"><div><span>SEASON LEVEL</span><strong data-v21-level>1</strong></div><div><span>RAIDS</span><strong data-v21-raids>0</strong></div><div><span>RAID SHARDS</span><strong data-v21-shards>0</strong></div><div><span>BEST STREAK</span><strong data-v21-streak>0</strong></div></div>
        </section>
      </div>
      <footer class="v21-foot"><span>PLAYER IDENTITY · LOCAL GAMEPLAY PROFILE</span><button type="button" data-v21-close>CERRAR HANGAR</button></footer>
    </div>`;
  document.body.append(panel);

  panel.addEventListener('click', (event) => {
    if (event.target.closest('[data-v21-close]')) closeIdentityHangar();
    const title = event.target.closest('[data-v21-equip-title]');
    if (title) saveCosmetic('title', title.dataset.v21EquipTitle);
    const frame = event.target.closest('[data-v21-equip-frame]');
    if (frame) saveCosmetic('frame', frame.dataset.v21EquipFrame);
    if (event.target.closest('[data-v21-save-callsign]')) saveCallsign($('[data-v21-callsign]', panel)?.value);
  });
  $('[data-v21-callsign]', panel)?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') saveCallsign(event.currentTarget.value);
  });
  initStage(panel);
  return panel;
}

function relicInventory() {
  const inventory = raidProfile().inventory;
  return Object.entries(RELICS).map(([id, def]) => {
    const item = inventory[id] || {};
    return { id, ...def, count: Math.max(0, Number(item.count) || 0), rarity: String(item.bestRarity || 'LOCKED').toUpperCase() };
  });
}

function renderIdentity() {
  const panel = ensureHangar();
  const id = identity();
  const raids = raidProfile();
  const cosmetics = unlockedCosmetics();
  applyFrame(id.frame);
  $('[data-v21-callsign]', panel).value = id.callsign;
  $('[data-v21-title-display]', panel).textContent = id.title;
  $('[data-v21-role]', panel).textContent = `${id.role} · LV ${id.level}`;
  $('[data-v21-sector]', panel).textContent = id.bestSector;
  $('[data-v21-kills]', panel).textContent = Math.floor(id.kills).toLocaleString('es-MX');
  $('[data-v21-marks]', panel).textContent = Math.floor(id.marks).toLocaleString('es-MX');
  $('[data-v21-stage-ship]', panel).textContent = id.shipName;
  $('[data-v21-stage-class]', panel).textContent = id.shipClass;
  $('[data-v21-frame-badge]', panel).textContent = `${id.frame} FRAME`;
  $('[data-v21-ship-name]', panel).textContent = id.shipName;
  $('[data-v21-ship-class]', panel).textContent = id.shipClass;
  $('[data-v21-weapon-name]', panel).textContent = id.weaponName;
  $('[data-v21-weapon-class]', panel).textContent = id.weaponClass;
  $('[data-v21-speed]', panel).style.width = `${Math.min(100, 42 + id.speed * 34)}%`;
  $('[data-v21-shield]', panel).style.width = `${Math.min(100, 42 + id.shield * 31)}%`;
  $('[data-v21-fire]', panel).style.width = `${Math.min(100, 105 - id.fireRate * 44)}%`;
  $('[data-v21-level]', panel).textContent = id.level;
  $('[data-v21-raids]', panel).textContent = Math.floor(raids.raids);
  $('[data-v21-shards]', panel).textContent = Math.floor(raids.shards);
  $('[data-v21-streak]', panel).textContent = Math.floor(raids.bestStreak);

  const titles = $('[data-v21-titles]', panel);
  titles.replaceChildren(...cosmetics.titles.map((title) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.v21EquipTitle = title;
    button.className = title === id.title.toUpperCase() ? 'active' : '';
    button.textContent = title;
    return button;
  }));
  const frames = $('[data-v21-frames]', panel);
  frames.replaceChildren(...cosmetics.frames.map((frame) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.v21EquipFrame = frame;
    button.className = frame === id.frame ? 'active' : '';
    button.innerHTML = `<i style="--frame:${FRAME_ACCENTS[frame] || FRAME_ACCENTS.STANDARD}"></i><span>${frame}</span>`;
    return button;
  }));

  const relics = relicInventory();
  $('[data-v21-relic-total]', panel).textContent = `${relics.reduce((sum, item) => sum + item.count, 0)} RELICS`;
  const relicGrid = $('[data-v21-relics]', panel);
  relicGrid.replaceChildren(...relics.map((item) => {
    const article = document.createElement('article');
    article.className = item.count > 0 ? 'owned' : 'locked';
    article.innerHTML = `<i style="--relic:#${item.accent.toString(16).padStart(6, '0')}">◇</i><div><strong>${item.name}</strong><span>${item.rarity}</span></div><b>${item.count > 0 ? `×${item.count}` : '—'}</b>`;
    return article;
  }));
  rebuildStageObjects();
  updateGameplayIdentity();
}

function createShipModel(id) {
  const group = new THREE.Group();
  const accent = new THREE.Color(id.accent || 0x22d3ee);
  const metal = new THREE.MeshStandardMaterial({ color: 0x07111f, emissive: accent, emissiveIntensity: 0.24, metalness: 0.9, roughness: 0.18 });
  const glow = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false });
  const body = new THREE.Mesh(new THREE.ConeGeometry(1.25, 4.8, 5), metal);
  body.rotation.x = Math.PI / 2;
  body.rotation.z = Math.PI;
  body.scale.set(1, .45, 1.15);
  group.add(body);
  const wingGeometry = new THREE.BoxGeometry(3.8, .12, 1.45);
  const wings = new THREE.Mesh(wingGeometry, metal.clone());
  wings.position.z = .35;
  group.add(wings);
  for (const side of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.ConeGeometry(.3, 2.7, 4), metal.clone());
    fin.rotation.x = Math.PI / 2;
    fin.position.set(side * 2.05, .12, .55);
    fin.rotation.z = side * -.18;
    group.add(fin);
    const engine = new THREE.Mesh(new THREE.SphereGeometry(.24, 10, 10), glow.clone());
    engine.position.set(side * .62, -.08, 2.18);
    group.add(engine);
  }
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(.34, 1), glow.clone());
  core.position.set(0, .4, -.1);
  group.add(core);
  if (/aegis|obsidian|celestial/i.test(id.shipName)) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.8, .055, 8, 42), glow.clone());
    ring.rotation.x = Math.PI / 2;
    ring.position.z = .2;
    group.add(ring);
  }
  if (/nova|eclipse|celestial/i.test(id.shipName)) {
    const crown = new THREE.Mesh(new THREE.TorusGeometry(1.2, .04, 8, 36), glow.clone());
    crown.rotation.x = Math.PI / 2;
    crown.rotation.z = Math.PI / 4;
    crown.position.set(0, .5, -.85);
    group.add(crown);
  }
  group.scale.setScalar(.92);
  return group;
}

function createRelicModel(item) {
  let geometry;
  if (item.geometry === 'ico') geometry = new THREE.IcosahedronGeometry(.34, 1);
  else if (item.geometry === 'torus') geometry = new THREE.TorusKnotGeometry(.25, .07, 48, 8);
  else if (item.geometry === 'dodeca') geometry = new THREE.DodecahedronGeometry(.34, 0);
  else geometry = new THREE.OctahedronGeometry(.36, 1);
  const material = new THREE.MeshStandardMaterial({ color: 0x07111f, emissive: item.accent, emissiveIntensity: .9, metalness: .72, roughness: .18 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.relic = item.id;
  return mesh;
}

function rebuildStageObjects() {
  if (!state.scene || !state.root) return;
  if (state.shipGroup) state.root.remove(state.shipGroup);
  if (state.relicGroup) state.root.remove(state.relicGroup);
  const id = identity();
  state.shipGroup = createShipModel(id);
  state.root.add(state.shipGroup);
  state.relicGroup = new THREE.Group();
  const owned = relicInventory().filter((item) => item.count > 0);
  owned.forEach((item, index) => {
    const relic = createRelicModel(item);
    const angle = index / Math.max(1, owned.length) * Math.PI * 2;
    relic.position.set(Math.cos(angle) * 3.3, .8 + Math.sin(angle * 2) * .35, Math.sin(angle) * 2.2);
    relic.userData.baseAngle = angle;
    state.relicGroup.add(relic);
  });
  state.root.add(state.relicGroup);
}

function initStage(panel) {
  const canvas = $('[data-v21-canvas]', panel);
  if (!canvas || state.renderer) return;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: window.devicePixelRatio <= 1.5, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 100);
  camera.position.set(0, 2.1, 10.5);
  camera.lookAt(0, .25, 0);
  const root = new THREE.Group();
  scene.add(root);
  scene.add(new THREE.HemisphereLight(0xa5f3fc, 0x020617, 2.0));
  const key = new THREE.PointLight(0x67e8f9, 26, 18, 2); key.position.set(4, 5, 5); scene.add(key);
  const rim = new THREE.PointLight(0xc084fc, 22, 18, 2); rim.position.set(-5, 2, -3); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.5, .22, 64), new THREE.MeshStandardMaterial({ color: 0x020617, emissive: 0x164e63, emissiveIntensity: .22, metalness: .88, roughness: .28 }));
  floor.position.y = -1.55;
  root.add(floor);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(2.75, .035, 8, 64), new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: .42 }));
  halo.rotation.x = Math.PI / 2; halo.position.y = -1.42; root.add(halo);
  state.renderer = renderer; state.scene = scene; state.camera = camera; state.root = root;
  rebuildStageObjects();
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  };
  state.resizeObserver = new ResizeObserver(resize); state.resizeObserver.observe(canvas); resize();
  canvas.addEventListener('pointerdown', (event) => { state.dragging = true; state.dragX = event.clientX; canvas.setPointerCapture?.(event.pointerId); });
  canvas.addEventListener('pointermove', (event) => {
    if (!state.dragging) return;
    const delta = event.clientX - state.dragX; state.dragX = event.clientX; state.targetRotationY += delta * .012;
  });
  const stop = () => { state.dragging = false; };
  canvas.addEventListener('pointerup', stop); canvas.addEventListener('pointercancel', stop);
}

function animate(now = performance.now()) {
  state.animation = 0;
  if (!state.open || !state.renderer || !state.scene || !state.camera || !state.root) return;
  const dt = Math.min(.05, Math.max(.001, (now - state.lastTime) / 1000)); state.lastTime = now;
  if (!state.dragging) state.targetRotationY += dt * .18;
  state.rotationY += (state.targetRotationY - state.rotationY) * Math.min(1, dt * 7);
  if (state.shipGroup) {
    state.shipGroup.rotation.y = state.rotationY;
    state.shipGroup.position.y = Math.sin(now * .0016) * .12;
  }
  if (state.relicGroup) {
    state.relicGroup.rotation.y = -state.rotationY * .28;
    state.relicGroup.children.forEach((relic, index) => { relic.rotation.x += dt * (.55 + index * .08); relic.rotation.y += dt * (.8 + index * .1); });
  }
  state.root.rotation.x = -.08;
  state.renderer.render(state.scene, state.camera);
  state.animation = requestAnimationFrame(animate);
}

function ensureGameplayIdentity() {
  let badge = $('#v21-game-identity');
  if (badge) return badge;
  badge = document.createElement('aside');
  badge.id = 'v21-game-identity';
  badge.className = 'v21-game-identity hidden';
  badge.innerHTML = '<i>WA</i><div><strong data-v21-game-name>PILOTO</strong><span data-v21-game-title>PILOT</span></div><b data-v21-game-role>ASSAULT</b>';
  document.body.append(badge);
  return badge;
}

function updateGameplayIdentity() {
  const badge = ensureGameplayIdentity();
  const id = identity();
  const playing = game()?.state === 'playing';
  badge.classList.toggle('hidden', !playing);
  $('[data-v21-game-name]', badge).textContent = id.callsign;
  $('[data-v21-game-title]', badge).textContent = `${id.title} · ${id.frame}`;
  $('[data-v21-game-role]', badge).textContent = id.role;
}

export function openIdentityHangar() {
  const panel = ensureHangar();
  renderIdentity();
  state.open = true;
  panel.classList.remove('hidden');
  panel.setAttribute('aria-hidden', 'false');
  document.body.classList.add('v21-hangar-open');
  panel.classList.remove('entering');
  requestAnimationFrame(() => panel.classList.add('entering'));
  state.lastTime = performance.now();
  if (!state.animation) state.animation = requestAnimationFrame(animate);
}

export function closeIdentityHangar() {
  const panel = $('#v21-identity-hangar');
  if (!panel) return;
  state.open = false;
  panel.classList.add('hidden');
  panel.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('v21-hangar-open');
  if (state.animation) cancelAnimationFrame(state.animation);
  state.animation = 0;
}

ensureHangar();
renderIdentity();
window.clearInterval(state.tickTimer);
state.tickTimer = window.setInterval(() => {
  updateGameplayIdentity();
  if (state.open) renderIdentity();
}, 1200);
window.addEventListener('wae:v21-identity-changed', () => { renderIdentity(); updateGameplayIdentity(); });
