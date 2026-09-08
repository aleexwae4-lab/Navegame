const $ = (selector, root = document) => root.querySelector(selector);

let multiplayerPromise = null;

function applyBranding() {
  document.title = 'WAE Neon Rider 3D · V16 Co-Op Squadron';
  const seal = $('.wae-game-seal small');
  const brand = $('.brand-seal span');
  const start = $('#start-screen .eyebrow');
  if (seal) seal.textContent = 'ORIGINAL GAME SEAL · V16';
  if (brand) brand.textContent = 'NEON RIDER · CO-OP SQUADRON V16';
  if (start) start.textContent = 'WAE V16 / COMBATE · ESCUADRÓN · CO-OP';
}

function installLauncher() {
  const container = $('#start-screen .start-meta');
  if (!container || container.querySelector('[data-open-v16-squad]')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'v16-squad-launch';
  button.dataset.openV16Squad = 'true';
  button.innerHTML = '<span>●</span> ESCUADRÓN ONLINE';
  container.append(button);
}

async function loadMultiplayer() {
  if (multiplayerPromise) return multiplayerPromise;
  multiplayerPromise = import('./multiplayer.js').catch((error) => {
    multiplayerPromise = null;
    console.error('[WAE V16] Multiplayer module failed to load', error);
    throw error;
  });
  return multiplayerPromise;
}

async function openSquad(room = '') {
  try {
    const module = await loadMultiplayer();
    module.openSquadLobby?.(room);
  } catch {
    window.dispatchEvent(new CustomEvent('wae:v16:multiplayer-error'));
  }
}

applyBranding();
installLauncher();

document.addEventListener('click', (event) => {
  if (!event.target.closest('[data-open-v16-squad]')) return;
  event.preventDefault();
  openSquad();
}, true);

const inviteRoom = new URLSearchParams(window.location.search).get('squad');
if (inviteRoom) {
  window.setTimeout(() => openSquad(inviteRoom), 350);
}
