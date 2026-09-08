const $ = (selector, root = document) => root.querySelector(selector);
let liveOpsPromise = null;

function applyBranding() {
  document.title = 'WAE Neon Rider 3D · V20 Command Deck';
  const seal = $('.wae-game-seal small');
  const brand = $('.brand-seal span');
  const start = $('#start-screen .eyebrow');
  if (seal) seal.textContent = 'ORIGINAL GAME SEAL · V20';
  if (brand) brand.textContent = 'NEON RIDER · COMMAND DECK V20';
  if (start) start.textContent = 'WAE V20 / LIVE OPS · SEASON COMMAND · PREMIUM PROGRESSION';
}

function installCommandButton() {
  const container = $('#start-screen .start-meta');
  if (!container || container.querySelector('[data-v20-command]')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'v20-command-launch';
  button.dataset.v20Command = 'true';
  button.innerHTML = '<span>◈</span> COMMAND DECK';
  container.append(button);
}

function showToast(text, danger = false) {
  let toast = $('#v20-shell-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'v20-shell-toast';
    toast.className = 'v20-shell-toast';
    toast.setAttribute('role', 'status');
    document.body.append(toast);
  }
  toast.textContent = text;
  toast.classList.toggle('danger', danger);
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 3200);
}

async function loadLiveOps() {
  if (liveOpsPromise) return liveOpsPromise;
  liveOpsPromise = import('./liveops.js').catch((error) => {
    liveOpsPromise = null;
    console.error('[WAE V20] Live Ops failed to load', error);
    showToast('COMMAND DECK NO DISPONIBLE · EL JUEGO SIGUE ACTIVO', true);
    throw error;
  });
  return liveOpsPromise;
}

async function openCommandDeck() {
  try {
    const module = await loadLiveOps();
    module.openCommandDeck?.();
  } catch {}
}

applyBranding();
installCommandButton();
window.addEventListener('pageshow', () => {
  applyBranding();
  installCommandButton();
});

document.addEventListener('click', (event) => {
  if (event.target.closest('[data-v20-command]')) {
    event.preventDefault();
    openCommandDeck();
    return;
  }
  if (event.target.closest('#start-btn, #restart-btn, [data-open-v16-squad]')) loadLiveOps().catch(() => {});
}, true);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') liveOpsPromise?.then((module) => module.closeCommandDeck?.()).catch(() => {});
});

const preload = () => loadLiveOps().catch(() => {});
if ('requestIdleCallback' in window) window.requestIdleCallback(preload, { timeout: 2600 });
else window.setTimeout(preload, 2200);
