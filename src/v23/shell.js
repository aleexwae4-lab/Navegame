const $ = (selector, root = document) => root.querySelector(selector);

let worldPromise = null;

function applyBranding() {
  document.title = 'WAE Neon Rider 3D · V23 World Evolution';
  const seal = $('.wae-game-seal small');
  const brand = $('.brand-seal span');
  const start = $('#start-screen .eyebrow');
  if (seal) seal.textContent = 'ORIGINAL GAME SEAL · V23';
  if (brand) brand.textContent = 'NEON RIDER · WORLD EVOLUTION V23';
  if (start) start.textContent = 'WAE V23 / PROCEDURAL EVENTS · LIVING SECTORS · WORLD ATLAS';
}

function installWorldControls() {
  const container = $('#start-screen .start-meta');
  if (!container) return;

  if (!container.querySelector('[data-v23-atlas]')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'v23-atlas-launch';
    button.dataset.v23Atlas = 'true';
    button.innerHTML = '<span>◎</span> WORLD ATLAS';
    container.append(button);
  }

  if (!container.querySelector('.v23-world-chip')) {
    const chip = document.createElement('div');
    chip.className = 'v23-world-chip';
    chip.innerHTML = '<i></i><div><strong>LIVING UNIVERSE</strong><span>ANOMALIES · EVENTS · DISCOVERIES</span></div>';
    container.append(chip);
  }
}

function showToast(text, danger = false) {
  let toast = $('#v23-shell-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'v23-shell-toast';
    toast.className = 'v23-shell-toast';
    toast.setAttribute('role', 'status');
    document.body.append(toast);
  }
  toast.textContent = text;
  toast.classList.toggle('danger', danger);
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 3200);
}

async function loadWorld() {
  if (worldPromise) return worldPromise;
  worldPromise = import('./world-director.js').then((module) => {
    module.installWorldDirector?.();
    return module;
  }).catch((error) => {
    worldPromise = null;
    console.error('[WAE V23] World Director failed to load', error);
    showToast('WORLD DIRECTOR NO DISPONIBLE · COMBATE BASE CONTINÚA', true);
    throw error;
  });
  return worldPromise;
}

async function openAtlas() {
  try {
    const module = await loadWorld();
    module.openWorldAtlas?.();
  } catch {}
}

applyBranding();
installWorldControls();

window.addEventListener('pageshow', () => {
  applyBranding();
  installWorldControls();
});

document.addEventListener('click', (event) => {
  if (event.target.closest('[data-v23-atlas]')) {
    event.preventDefault();
    openAtlas();
    return;
  }
  if (event.target.closest('#start-btn, #restart-btn, [data-v16-launch-squad]')) loadWorld().catch(() => {});
}, true);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') worldPromise?.then((module) => module.closeWorldAtlas?.()).catch(() => {});
});

for (const eventName of ['pointerenter', 'focusin', 'touchstart']) {
  document.addEventListener(eventName, (event) => {
    if (event.target.closest?.('[data-v23-atlas], #start-btn, #restart-btn')) loadWorld().catch(() => {});
  }, { capture: true, passive: eventName === 'touchstart' });
}
