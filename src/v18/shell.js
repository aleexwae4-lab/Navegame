const $ = (selector, root = document) => root.querySelector(selector);

let networkPromise = null;

function applyBranding() {
  document.title = 'WAE Neon Rider 3D · V18 Squadron Network';
  const seal = $('.wae-game-seal small');
  const brand = $('.brand-seal span');
  const start = $('#start-screen .eyebrow');
  if (seal) seal.textContent = 'ORIGINAL GAME SEAL · V18';
  if (brand) brand.textContent = 'NEON RIDER · SQUADRON NETWORK V18';
  if (start) start.textContent = 'WAE V18 / SQUADRON NETWORK · ROLES · RESCUE · SYNERGY';
}

function installQuickLauncher() {
  const container = $('#start-screen .start-meta');
  if (!container || container.querySelector('[data-v18-quickmatch]')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'v18-quick-launch';
  button.dataset.v18Quickmatch = 'true';
  button.innerHTML = '<span>⚡</span> PARTIDA RÁPIDA';
  container.append(button);
}

function showToast(text, danger = false) {
  let toast = $('#v18-shell-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'v18-shell-toast';
    toast.className = 'v18-shell-toast';
    toast.setAttribute('role', 'status');
    document.body.append(toast);
  }
  toast.textContent = text;
  toast.classList.toggle('danger', danger);
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 3200);
}

async function loadNetwork() {
  if (networkPromise) return networkPromise;
  networkPromise = import('./squad-network.js').catch((error) => {
    networkPromise = null;
    console.error('[WAE V18] Squadron Network failed to load', error);
    showToast('SQUADRON NETWORK NO DISPONIBLE · EL JUEGO LOCAL SIGUE ACTIVO', true);
    throw error;
  });
  return networkPromise;
}

async function startQuickMatch() {
  try {
    showToast('BUSCANDO ESCUADRÓN · MATCHMAKING REALTIME');
    const network = await loadNetwork();
    await network.startQuickMatch?.();
  } catch {}
}

applyBranding();
installQuickLauncher();

window.addEventListener('pageshow', () => {
  applyBranding();
  installQuickLauncher();
});

document.addEventListener('click', (event) => {
  if (event.target.closest('[data-v18-quickmatch]')) {
    event.preventDefault();
    startQuickMatch();
    return;
  }
  if (event.target.closest('[data-open-v16-squad]')) loadNetwork().catch(() => {});
}, true);

const initialRoom = String(new URLSearchParams(location.search).get('squad') || '').trim();
if (initialRoom) window.setTimeout(() => loadNetwork().catch(() => {}), 300);
