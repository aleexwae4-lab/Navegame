const $ = (selector, root = document) => root.querySelector(selector);
let directorPromise = null;

function applyBranding() {
  document.title = 'WAE Neon Rider 3D · V27 Encounter Director';
  const seal = $('.wae-game-seal small');
  const brand = $('.brand-seal span');
  const start = $('#start-screen .eyebrow');
  if (seal) seal.textContent = 'ORIGINAL GAME SEAL · V27';
  if (brand) brand.textContent = 'NEON RIDER · ENCOUNTER DIRECTOR V27';
  if (start) start.textContent = 'WAE V27 / ADVANCED AI · FORMATIONS · TACTICAL ENCOUNTERS';
  document.body.classList.add('v27-encounter-direction');
}

function ensureHud() {
  let hud = $('#v27-tactical-hud');
  if (hud) return hud;
  hud = document.createElement('aside');
  hud.id = 'v27-tactical-hud';
  hud.className = 'v27-tactical-hud hidden';
  hud.setAttribute('aria-live', 'polite');
  hud.innerHTML = `
    <div class="v27-tactical-head">
      <i></i>
      <span>TACTICAL DIRECTOR</span>
      <b data-v27-doctrine>WEDGE</b>
    </div>
    <div class="v27-tactical-line">
      <strong data-v27-tactic>FORMATION</strong>
      <span><b data-v27-cells>1</b> CELLS</span>
    </div>`;
  $('#app')?.append(hud);
  return hud;
}

function installMark() {
  const status = $('.v24-system-status');
  if (!status || status.querySelector('[data-v27-ai-mark]')) return;
  const mark = document.createElement('span');
  mark.dataset.v27AiMark = 'true';
  mark.textContent = 'TACTICAL AI · V27';
  status.append(mark);
}

async function loadDirector() {
  if (directorPromise) return directorPromise;
  directorPromise = import('./encounter-director.js').then(async (module) => {
    let attempts = 0;
    while (attempts < 12 && !module.installEncounterDirector?.()) {
      attempts += 1;
      await new Promise((resolve) => window.setTimeout(resolve, 70));
    }
    document.body.classList.add('v27-director-ready');
    return module;
  }).catch((error) => {
    directorPromise = null;
    console.error('[WAE V27] Encounter Director failed to load', error);
    return null;
  });
  return directorPromise;
}

applyBranding();
ensureHud();
installMark();
window.addEventListener('pageshow', () => { applyBranding(); ensureHud(); installMark(); });
window.addEventListener('wae:v27-encounter-ready', installMark);

document.addEventListener('click', (event) => {
  if (event.target.closest('#start-btn,#restart-btn,[data-v16-launch-squad]')) loadDirector();
}, true);

for (const eventName of ['pointerenter','focusin','touchstart']) {
  document.addEventListener(eventName, (event) => {
    if (event.target.closest?.('#start-btn,#restart-btn,[data-v16-launch-squad]')) loadDirector();
  }, { capture: true, passive: eventName === 'touchstart' });
}

const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
if (!connection?.saveData && !/2g/i.test(connection?.effectiveType || '')) {
  const warm = () => loadDirector();
  if ('requestIdleCallback' in window) window.requestIdleCallback(warm, { timeout: 4200 });
  else window.setTimeout(warm, 3200);
}
