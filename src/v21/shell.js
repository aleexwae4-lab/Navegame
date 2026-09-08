const $ = (selector, root = document) => root.querySelector(selector);
const LIVEOPS_KEY = 'wae_neon_rider_v20_liveops_profile';
const CALLSIGN_KEY = 'wae_neon_rider_callsign';
const ROLE_KEY = 'wae_neon_rider_v18_role';

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
    frame: String(cosmetic.frame || 'STANDARD').slice(0, 24),
    role: String(localStorage.getItem(ROLE_KEY) || 'assault').toUpperCase().slice(0, 16),
  };
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
  badge.innerHTML = '<i>WA</i><div><strong data-v21-game-name>PILOTO</strong><span data-v21-game-title>PILOT · STANDARD</span></div><b data-v21-game-role>ASSAULT</b>';
  document.body.append(badge);
  return badge;
}

function syncGameplayBadge() {
  const badge = ensureGameplayBadge();
  const id = identitySnapshot();
  const playing = window.__waeNeonRiderGame?.state === 'playing';
  badge.classList.toggle('hidden', !playing);
  $('[data-v21-game-name]', badge).textContent = id.callsign;
  $('[data-v21-game-title]', badge).textContent = `${id.title} · ${id.frame}`;
  $('[data-v21-game-role]', badge).textContent = id.role;
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
