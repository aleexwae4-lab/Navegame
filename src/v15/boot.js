import '../v12/runtime-hook.js';
import '../v10/boot.js';
import '../v12/styles.css';
import '../v14/cinematic.js';
import './premium-visuals.js';
import './styles.css';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let premiumSuitePromise = null;
let indicatorTimer = 0;

function applyV15Branding() {
  document.title = 'WAE Neon Rider 3D · V15 Performance Arsenal';
  const seal = $('.wae-game-seal small');
  const brand = $('.brand-seal span');
  const start = $('#start-screen .eyebrow');
  if (seal) seal.textContent = 'ORIGINAL GAME SEAL · V15';
  if (brand) brand.textContent = 'NEON RIDER · PERFORMANCE ARSENAL V15';
  if (start) start.textContent = 'WAE V15 / COMBATE · COLECCIÓN · RENDIMIENTO';
}

function installIndicator() {
  if ($('#v15-load-indicator')) return $('#v15-load-indicator');
  const indicator = document.createElement('div');
  indicator.id = 'v15-load-indicator';
  indicator.className = 'v15-load-indicator';
  indicator.setAttribute('role', 'status');
  document.body.append(indicator);
  return indicator;
}

function showIndicator(message, duration = 0) {
  const indicator = installIndicator();
  window.clearTimeout(indicatorTimer);
  indicator.textContent = message;
  indicator.classList.add('show');
  if (duration > 0) {
    indicatorTimer = window.setTimeout(() => indicator.classList.remove('show'), duration);
  }
}

function hideIndicator() {
  const indicator = $('#v15-load-indicator');
  if (indicator) indicator.classList.remove('show');
}

function installLaunchButton(container, label = 'ARSENAL PREMIUM') {
  if (!container || container.querySelector('[data-open-v15-store]')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'v15-premium-launch';
  button.dataset.openV15Store = 'true';
  button.textContent = label;
  container.append(button);
}

function installLaunchers() {
  installLaunchButton($('#start-screen .start-meta'), 'ARSENAL PREMIUM');
  installLaunchButton($('#hangar-screen .meta-panel-header > div'), 'ARSENAL COLLECTOR');
  installLaunchButton($('#game-over-screen .panel'), 'TIENDA PREMIUM');
}

async function loadPremiumSuite() {
  if (premiumSuitePromise) return premiumSuitePromise;
  document.body.classList.add('v15-premium-loading');
  $$('.v15-premium-launch').forEach((button) => {
    button.classList.add('is-loading');
    button.textContent = 'CARGANDO ARSENAL…';
  });
  showIndicator('CARGANDO WAE PRIVATE VAULT · MÓDULOS BAJO DEMANDA');

  premiumSuitePromise = (async () => {
    await import('../v11/store.js');
    await import('../v12/commerce-live.js');
    await Promise.all([
      import('../v13/styles.css'),
      import('../v13/collection.js'),
    ]);
    await Promise.all([
      import('../v14/styles.css'),
      import('../v14/showroom.js'),
    ]);
    applyV15Branding();
    document.body.classList.remove('v15-premium-loading');
    $$('.v15-premium-launch').forEach((button) => button.remove());
    hideIndicator();
    return true;
  })().catch((error) => {
    premiumSuitePromise = null;
    document.body.classList.remove('v15-premium-loading');
    console.error('[WAE V15] Premium suite failed to load', error);
    $$('.v15-premium-launch').forEach((button) => {
      button.classList.remove('is-loading');
      button.textContent = 'REINTENTAR ARSENAL';
    });
    showIndicator('NO SE PUDO CARGAR EL ARSENAL · TOCA PARA REINTENTAR', 2800);
    throw error;
  });

  return premiumSuitePromise;
}

async function openPremiumStore() {
  try {
    await loadPremiumSuite();
    const nativeButton = $('[data-open-v11-store]');
    if (nativeButton) nativeButton.click();
  } catch {}
}

function warmPremiumSuite() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (connection?.saveData) return;
  if (['slow-2g', '2g'].includes(connection?.effectiveType)) return;
  const warm = () => loadPremiumSuite().catch(() => {});
  if ('requestIdleCallback' in window) window.requestIdleCallback(warm, { timeout: 7000 });
  else window.setTimeout(warm, 6500);
}

applyV15Branding();
installLaunchers();
installIndicator();

document.addEventListener('click', (event) => {
  if (!event.target.closest('[data-open-v15-store]')) return;
  event.preventDefault();
  openPremiumStore();
}, true);

document.addEventListener('pointerenter', (event) => {
  if (event.target.closest?.('[data-open-v15-store]')) loadPremiumSuite().catch(() => {});
}, true);

document.addEventListener('touchstart', (event) => {
  if (event.target.closest?.('[data-open-v15-store]')) loadPremiumSuite().catch(() => {});
}, { capture: true, passive: true });

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  premiumSuitePromise = null;
  showIndicator('ACTUALIZACIÓN DETECTADA · RECARGA PARA CONTINUAR', 3500);
});

warmPremiumSuite();
