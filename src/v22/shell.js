const $ = (selector, root = document) => root.querySelector(selector);

let directorPromise = null;
let directorReady = false;
let replayingStart = false;

function applyBranding() {
  document.title = 'WAE Neon Rider 3D · V22 Cinematic Experience';
  const seal = $('.wae-game-seal small');
  const brand = $('.brand-seal span');
  const start = $('#start-screen .eyebrow');
  if (seal) seal.textContent = 'ORIGINAL GAME SEAL · V22';
  if (brand) brand.textContent = 'NEON RIDER · CINEMATIC EXPERIENCE V22';
  if (start) start.textContent = 'WAE V22 / CINEMATIC LAUNCH · ADAPTIVE AUDIO · TACTILE COMBAT';
}

function installSignalChip() {
  const container = $('#start-screen .start-meta');
  if (!container || container.querySelector('.v22-signal-chip')) return;
  const chip = document.createElement('div');
  chip.className = 'v22-signal-chip';
  chip.innerHTML = '<i></i><div><strong>CINEMATIC ENGINE</strong><span>ADAPTIVE AUDIO · HAPTICS · CAMERA</span></div>';
  container.append(chip);
}

function showToast(text, danger = false) {
  let toast = $('#v22-shell-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'v22-shell-toast';
    toast.className = 'v22-shell-toast';
    toast.setAttribute('role', 'status');
    document.body.append(toast);
  }
  toast.textContent = text;
  toast.classList.toggle('danger', danger);
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 3200);
}

async function loadDirector() {
  if (directorPromise) return directorPromise;
  directorPromise = import('./cinematic-director.js').then((module) => {
    directorReady = true;
    module.installCinematicDirector?.();
    return module;
  }).catch((error) => {
    directorPromise = null;
    directorReady = false;
    console.error('[WAE V22] Cinematic Director failed to load', error);
    showToast('CINEMATIC ENGINE NO DISPONIBLE · EL JUEGO BASE SIGUE ACTIVO', true);
    throw error;
  });
  return directorPromise;
}

function closeHangarAndLaunch() {
  const hangar = $('#v21-identity-hangar:not(.hidden)');
  hangar?.querySelector('[data-v21-close]')?.click();
  window.setTimeout(() => $('#start-btn')?.click(), 180);
}

applyBranding();
installSignalChip();

window.addEventListener('pageshow', () => {
  applyBranding();
  installSignalChip();
});

document.addEventListener('click', async (event) => {
  const hangarLaunch = event.target.closest('[data-v22-launch]');
  if (hangarLaunch) {
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      await loadDirector();
      closeHangarAndLaunch();
    } catch {}
    return;
  }

  const startButton = event.target.closest('#start-btn, #restart-btn');
  if (!startButton || replayingStart || directorReady) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  try {
    await loadDirector();
    replayingStart = true;
    startButton.click();
  } catch {
    replayingStart = true;
    startButton.click();
  } finally {
    queueMicrotask(() => { replayingStart = false; });
  }
}, true);

for (const eventName of ['pointerenter', 'focusin', 'touchstart']) {
  document.addEventListener(eventName, (event) => {
    if (event.target.closest?.('#start-btn, #restart-btn, [data-v21-hangar], [data-v22-launch]')) loadDirector().catch(() => {});
  }, { capture: true, passive: eventName === 'touchstart' });
}

const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
if (!connection?.saveData && !/2g/i.test(connection?.effectiveType || '')) {
  const warm = () => loadDirector().catch(() => {});
  if ('requestIdleCallback' in window) window.requestIdleCallback(warm, { timeout: 6500 });
  else window.setTimeout(warm, 6000);
}
