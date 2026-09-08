const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let combatPromise = null;
let stateTimer = 0;

function game() { return window.__waeNeonRiderGame; }

function applyBranding() {
  document.title = 'WAE Neon Rider 3D · V24 Combat Feel';
  const seal = $('.wae-game-seal small');
  const brand = $('.brand-seal span');
  const start = $('#start-screen .eyebrow');
  if (seal) seal.textContent = 'ORIGINAL GAME SEAL · V24';
  if (brand) brand.textContent = 'NEON RIDER · COMBAT FEEL V24';
  if (start) start.textContent = 'WAE V24 / COMBAT FEEL · VISUAL RECOVERY · MOBILE FIRST';
}

function recoverStartHierarchy() {
  const panel = $('#start-screen .panel');
  const meta = $('#start-screen .start-meta');
  const intro = $('#start-screen .panel > p');
  const feature = $('#start-screen .feature-strip');
  if (!panel || !meta) return;

  panel.classList.add('v24-start-panel');
  meta.classList.add('v24-start-meta');

  if (intro) intro.textContent = 'Pilota, combate y evoluciona. Raids, escuadrones y un universo vivo sin sacrificar la claridad del campo de batalla.';
  if (feature && !feature.classList.contains('v24-guide')) {
    feature.classList.add('v24-guide');
    feature.innerHTML = '<span><b>01</b><strong>ARRASTRA</strong><small>MOVER</small></span><span><b>02</b><strong>FUEGO</strong><small>MANTÉN</small></span><span><b>03</b><strong>PULSO · ESQUIVA · MISIL</strong><small>TÁCTICO</small></span>';
  }

  const redundant = ['.v22-signal-chip', '.v23-world-chip'];
  for (const selector of redundant) meta.querySelector(selector)?.classList.add('v24-redundant-status');

  let status = meta.querySelector('.v24-system-status');
  if (!status) {
    status = document.createElement('div');
    status.className = 'v24-system-status';
    status.innerHTML = '<i></i><div><strong>FLIGHT SYSTEMS ONLINE</strong><span>CINEMATIC · LIVING UNIVERSE · REALTIME READY</span></div>';
    meta.append(status);
  }

  for (const button of $$(':scope > button', meta)) button.classList.add('v24-module-button');
  meta.querySelector('.v21-pilot-chip')?.classList.add('v24-pilot-chip');

  const startButton = $('#start-btn');
  if (startButton) startButton.textContent = `JUGAR · SECTOR ${game()?.profile?.selectedSector || game()?.sector || 1}`;
}

function ensureCompactCombatLabel() {
  let label = $('#v24-flight-strip');
  if (label) return label;
  label = document.createElement('aside');
  label.id = 'v24-flight-strip';
  label.className = 'v24-flight-strip hidden';
  label.setAttribute('aria-live', 'polite');
  label.innerHTML = '<i></i><div><strong data-v24-flight>COMBAT LINK</strong><span data-v24-flight-sub>LOCAL · READY</span></div>';
  document.body.append(label);
  return label;
}

function syncGameplayState() {
  const g = game();
  const playing = g?.state === 'playing';
  document.body.classList.toggle('v24-playing', playing);
  document.body.classList.toggle('v24-not-playing', !playing);

  const strip = ensureCompactCombatLabel();
  strip.classList.toggle('hidden', !playing);
  if (!playing) return;

  const snapshot = g.snapshot?.() || {};
  const sector = Number(snapshot.sector ?? g.sector ?? 1) || 1;
  const boss = snapshot.boss || g.boss;
  const room = new URLSearchParams(location.search).get('squad');
  $('[data-v24-flight]', strip).textContent = boss ? `GUARDIAN CONTACT · S${sector}` : `SECTOR ${sector} · FLIGHT LINK`;
  $('[data-v24-flight-sub]', strip).textContent = room ? 'SQUADRON · SHARED BATTLEFIELD' : 'SOLO · LIVING UNIVERSE';
}

function installTouchSafety() {
  const safeInfo = [
    '#hud', '.combat-stack', '.meta-strip', '.biome-pill', '.contract-pill', '.encounter-pill', '.campaign-ribbon',
    '.v16-squad-hud', '.v17-shared-hud', '.v18-squad-hud', '.v19-raid-hud', '.v19-telegraph',
    '#v21-game-identity', '.v22-flight-id', '.v22-audio-badge', '.v22-victory', '.v23-world-hud', '.v23-discovery'
  ];
  for (const selector of safeInfo) for (const node of $$(selector)) node.dataset.v24TouchThrough = 'true';
}

function showAuditToast() {
  if (sessionStorage.getItem('wae_v24_visual_recovery_seen')) return;
  sessionStorage.setItem('wae_v24_visual_recovery_seen', '1');
  let toast = $('#v24-recovery-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'v24-recovery-toast';
    toast.className = 'v24-recovery-toast';
    toast.textContent = 'V24 · HUD RECUPERADO · CONTROLES LIBRES · COMBAT FEEL ONLINE';
    document.body.append(toast);
  }
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => toast.classList.remove('show'), 3300);
}

async function loadCombatFeel() {
  if (combatPromise) return combatPromise;
  combatPromise = import('./combat-feel.js').then((module) => {
    module.installCombatFeel?.();
    return module;
  }).catch((error) => {
    combatPromise = null;
    console.error('[WAE V24] Combat Feel failed to load', error);
    throw error;
  });
  return combatPromise;
}

applyBranding();
recoverStartHierarchy();
installTouchSafety();
syncGameplayState();
showAuditToast();

window.addEventListener('pageshow', () => {
  applyBranding();
  recoverStartHierarchy();
  installTouchSafety();
  syncGameplayState();
});

const observer = new MutationObserver(() => {
  recoverStartHierarchy();
  installTouchSafety();
});
observer.observe(document.body, { childList: true, subtree: true });

window.clearInterval(stateTimer);
stateTimer = window.setInterval(syncGameplayState, 350);

document.addEventListener('click', (event) => {
  if (event.target.closest('#start-btn, #restart-btn, #fire-btn, #secondary-btn, #dash-btn, #missile-btn')) loadCombatFeel().catch(() => {});
}, true);

for (const eventName of ['pointerenter', 'touchstart', 'focusin']) {
  document.addEventListener(eventName, (event) => {
    if (event.target.closest?.('#start-btn, #restart-btn')) loadCombatFeel().catch(() => {});
  }, { capture: true, passive: eventName === 'touchstart' });
}

const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
if (!connection?.saveData && !/2g/i.test(connection?.effectiveType || '')) {
  const warm = () => loadCombatFeel().catch(() => {});
  if ('requestIdleCallback' in window) window.requestIdleCallback(warm, { timeout: 7000 });
  else window.setTimeout(warm, 6500);
}
