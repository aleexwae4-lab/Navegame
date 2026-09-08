const $ = (selector, root = document) => root.querySelector(selector);
const LIVEOPS_KEY = 'wae_neon_rider_v20_liveops_profile';
const CALLSIGN_KEY = 'wae_neon_rider_callsign';
const ROLE_KEY = 'wae_neon_rider_v18_role';
const PREMIUM_SHIP_KEY = 'wae_neon_rider_v12_ship_sku';
const GAMEPLAY_SHIP_SCALE = 0.9;

const PREMIUM_SHIP_NAMES = Object.freeze({
  'WAE-SHIP-VIPER-BLK': 'VIPER R BLACK EDITION',
  'WAE-SHIP-AEGIS-SOV': 'AEGIS SOVEREIGN',
  'WAE-SHIP-NOVA-IMP': 'NOVA IMPERIUM',
  'WAE-SHIP-ECLIPSE-X': 'WAE ECLIPSE X',
  'WAE-SHIP-OBSIDIAN-1': 'WAE OBSIDIAN ONE',
  'WAE-SHIP-CELESTIAL': 'WAE CELESTIAL CROWN',
});

const LEGACY_SHIP_NAMES = Object.freeze({
  'AEGIS-32': 'AEGIS X',
  'AEGIS 32': 'AEGIS X',
});

let identityPromise = null;
let badgeTimer = 0;

function safeJson(key, fallback = {}) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function identitySnapshot() {
  const profile = safeJson(LIVEOPS_KEY, {});
  const cosmetic = profile.cosmetic && typeof profile.cosmetic === 'object' ? profile.cosmetic : {};
  return {
    callsign: String(localStorage.getItem(CALLSIGN_KEY) || 'PILOTO').slice(0, 18),
    title: String(cosmetic.title || 'PILOT').slice(0, 24),
    frame: String(cosmetic.frame || 'STANDARD').slice(0, 24).toUpperCase(),
    role: String(localStorage.getItem(ROLE_KEY) || 'assault').toUpperCase().slice(0, 16),
  };
}

function cleanLabel(value, fallback, max = 28) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  return (text || fallback).slice(0, max);
}

function shipIdentitySnapshot(identity = identitySnapshot()) {
  const game = window.__waeNeonRiderGame;
  const ship = game?.getShip?.() || {};
  const premiumSku = localStorage.getItem(PREMIUM_SHIP_KEY) || '';
  const sourceName = cleanLabel(
    ship.displayName || ship.modelName || PREMIUM_SHIP_NAMES[premiumSku] || ship.name,
    'AEGIS X',
    30,
  );
  const legacyKey = sourceName.toUpperCase();
  const displayName = LEGACY_SHIP_NAMES[legacyKey] || sourceName;
  const className = cleanLabel(
    ship.className || ship.roleName || ship.shipClass || ship.class || identity.role,
    'VANGUARD',
    22,
  ).toUpperCase();
  const pilotStatus = identity.title !== 'PILOT'
    ? cleanLabel(identity.title, 'PILOTO ESTÁNDAR', 24).toUpperCase()
    : identity.frame === 'STANDARD'
      ? 'PILOTO ESTÁNDAR'
      : `${cleanLabel(identity.frame, 'STANDARD', 18).toUpperCase()} PILOT`;
  return { displayName, className, pilotStatus };
}

function shipMonogram(name) {
  const parts = String(name || 'WAE').toUpperCase().match(/[A-Z0-9]+/g) || ['WAE'];
  if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`.slice(0, 2);
  return parts[0].slice(0, 2);
}

function syncGameplayComposition(playing) {
  const ship = window.__waeNeonRiderGame?.ship;
  if (!ship?.scale) return;
  ship.userData ??= {};
  const applied = Boolean(ship.userData.v21HudScaleApplied);
  if (playing && !applied) {
    ship.scale.multiplyScalar(GAMEPLAY_SHIP_SCALE);
    ship.userData.v21HudScaleApplied = true;
  } else if (!playing && applied) {
    ship.scale.multiplyScalar(1 / GAMEPLAY_SHIP_SCALE);
    ship.userData.v21HudScaleApplied = false;
  }
}

function applyBranding() {
  document.title = 'WAE Neon Rider 3D · V21 Identity Hangar';
  const seal = $('.wae-game-seal small');
  const brand = $('.brand-seal span');
  const start = $('#start-screen .eyebrow');
  if (seal) seal.textContent = 'ORIGINAL GAME SEAL · V21';
  if (brand) brand.textContent = 'NEON RIDER · IDENTITY HANGAR V21';
  if (start) start.textContent = 'WAE V21 / PLAYER IDENTITY · 3D HANGAR · RELIC DISPLAY';
}

function warmIdentity() {
  loadIdentity().catch(() => {});
}

function installHangarButton() {
  const container = $('#start-screen .start-meta');
  if (!container || container.querySelector('[data-v21-hangar]')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'v21-hangar-launch';
  button.dataset.v21Hangar = 'true';
  button.innerHTML = '<span>◇</span> IDENTITY HANGAR';
  button.addEventListener('pointerenter', warmIdentity, { once: true });
  button.addEventListener('touchstart', warmIdentity, { once: true, passive: true });
  container.append(button);
}

function installPilotChip() {
  const container = $('#start-screen .start-meta');
  if (!container) return;
  let chip = container.querySelector('.v21-pilot-chip');
  if (!chip) {
    chip = document.createElement('div');
    chip.className = 'v21-pilot-chip';
    chip.innerHTML = '<i>WA</i><div><strong data-v21-chip-name>PILOTO</strong><span data-v21-chip-meta>PILOT · STANDARD</span></div>';
    container.append(chip);
  }
  const id = identitySnapshot();
  $('[data-v21-chip-name]', chip).textContent = id.callsign;
  $('[data-v21-chip-meta]', chip).textContent = `${id.title} · ${id.frame}`;
  document.body.dataset.v21Frame = id.frame.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function ensureGameplayBadge() {
  let badge = $('#v21-game-identity');
  if (badge) return badge;
  badge = document.createElement('aside');
  badge.id = 'v21-game-identity';
  badge.className = 'v21-game-identity hidden';
  badge.setAttribute('aria-label', 'Identidad de nave activa');
  badge.innerHTML = '<i data-v21-game-mark>AX</i><div><strong data-v21-game-name>AEGIS X</strong><b data-v21-game-class>VANGUARD</b><span data-v21-game-pilot>PILOTO ESTÁNDAR</span></div>';
  document.body.append(badge);
  return badge;
}

function syncGameplayBadge() {
  const badge = ensureGameplayBadge();
  const id = identitySnapshot();
  const ship = shipIdentitySnapshot(id);
  const playing = window.__waeNeonRiderGame?.state === 'playing';
  badge.classList.toggle('hidden', !playing);
  $('[data-v21-game-mark]', badge).textContent = shipMonogram(ship.displayName);
  $('[data-v21-game-name]', badge).textContent = ship.displayName;
  $('[data-v21-game-class]', badge).textContent = ship.className;
  $('[data-v21-game-pilot]', badge).textContent = ship.pilotStatus;
  syncGameplayComposition(playing);
}

function showToast(text, danger = false) {
  let toast = $('#v21-shell-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'v21-shell-toast';
    toast.className = 'v21-shell-toast';
    toast.setAttribute('role', 'status');
    document.body.append(toast);
  }
  toast.textContent = text;
  toast.classList.toggle('danger', danger);
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 3200);
}

async function loadIdentity() {
  if (identityPromise) return identityPromise;
  const nativeSetInterval = window.setInterval.bind(window);
  const captured = [];
  window.setInterval = (fn, delay, ...args) => {
    const timer = nativeSetInterval(fn, delay, ...args);
    if (delay === 1200) captured.push(timer);
    return timer;
  };
  identityPromise = Promise.all([
    import('./identity-hangar.js'),
    import('./styles.css'),
  ]).then(([module]) => {
    for (const timer of captured) window.clearInterval(timer);
    window.setInterval = nativeSetInterval;
    syncGameplayBadge();
    return module;
  }).catch((error) => {
    for (const timer of captured) window.clearInterval(timer);
    window.setInterval = nativeSetInterval;
    identityPromise = null;
    console.error('[WAE V21] Identity Hangar failed to load', error);
    showToast('IDENTITY HANGAR NO DISPONIBLE · EL JUEGO SIGUE ACTIVO', true);
    throw error;
  });
  return identityPromise;
}

async function openHangar() {
  try {
    const module = await loadIdentity();
    module.openIdentityHangar?.();
  } catch {}
}

applyBranding();
installHangarButton();
installPilotChip();
syncGameplayBadge();

window.addEventListener('pageshow', () => {
  applyBranding();
  installHangarButton();
  installPilotChip();
  syncGameplayBadge();
});
window.addEventListener('wae:v21-identity-changed', () => {
  installPilotChip();
  syncGameplayBadge();
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('[data-v21-hangar]')) return;
  event.preventDefault();
  openHangar();
}, true);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') identityPromise?.then((module) => module.closeIdentityHangar?.()).catch(() => {});
});

window.clearInterval(badgeTimer);
badgeTimer = window.setInterval(syncGameplayBadge, 1000);
