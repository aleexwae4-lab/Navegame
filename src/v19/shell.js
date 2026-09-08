const $ = (selector, root = document) => root.querySelector(selector);

let raidPromise = null;

function applyBranding() {
  document.title = 'WAE Neon Rider 3D · V19 Combat Director';
  const seal = $('.wae-game-seal small');
  const brand = $('.brand-seal span');
  const start = $('#start-screen .eyebrow');
  if (seal) seal.textContent = 'ORIGINAL GAME SEAL · V19';
  if (brand) brand.textContent = 'NEON RIDER · COMBAT DIRECTOR V19';
  if (start) start.textContent = 'WAE V19 / BOSS RAIDS · WEAK POINTS · RELIC LOOT';
}

function installRaidArchiveButton() {
  const container = $('#start-screen .start-meta');
  if (!container || container.querySelector('[data-v19-archive]')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'v19-archive-launch';
  button.dataset.v19Archive = 'true';
  button.innerHTML = '<span>◇</span> RAID ARCHIVE';
  container.append(button);
}

function showToast(text, danger = false) {
  let toast = $('#v19-shell-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'v19-shell-toast';
    toast.className = 'v19-shell-toast';
    toast.setAttribute('role', 'status');
    document.body.append(toast);
  }
  toast.textContent = text;
  toast.classList.toggle('danger', danger);
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 3200);
}

async function loadRaidDirector() {
  if (raidPromise) return raidPromise;
  raidPromise = Promise.all([
    import('./raid-director.js'),
    import('./revive-streak-guard.js'),
  ]).then(([director]) => director).catch((error) => {
    raidPromise = null;
    console.error('[WAE V19] Combat Director failed to load', error);
    showToast('COMBAT DIRECTOR NO DISPONIBLE · EL JUEGO BASE SIGUE ACTIVO', true);
    throw error;
  });
  return raidPromise;
}

async function openArchive() {
  try {
    const raid = await loadRaidDirector();
    raid.openRaidArchive?.();
  } catch {}
}

applyBranding();
installRaidArchiveButton();

window.addEventListener('pageshow', () => {
  applyBranding();
  installRaidArchiveButton();
});

document.addEventListener('click', (event) => {
  if (event.target.closest('[data-v19-archive]')) {
    event.preventDefault();
    openArchive();
    return;
  }
  if (event.target.closest('#start-btn, #restart-btn')) {
    loadRaidDirector().catch(() => {});
  }
}, true);
