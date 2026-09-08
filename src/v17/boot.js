import '../v16/boot.js';
import './styles.css';

const $ = (selector, root = document) => root.querySelector(selector);
let battlefieldPromise = null;
let lastRoom = '';

function applyV17Branding() {
  document.title = 'WAE Neon Rider 3D · V17 Shared Battlefield';
  const seal = $('.wae-game-seal small');
  const brand = $('.brand-seal span');
  const start = $('#start-screen .eyebrow');
  if (seal) seal.textContent = 'ORIGINAL GAME SEAL · V17';
  if (brand) brand.textContent = 'NEON RIDER · SHARED BATTLEFIELD V17';
  if (start) start.textContent = 'WAE V17 / CO-OP · CAMPO COMPARTIDO · ELITE';
}

function squadRoom() {
  return String(new URLSearchParams(location.search).get('squad') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function loadBattlefield() {
  if (battlefieldPromise) return battlefieldPromise;
  battlefieldPromise = import('./shared-battlefield.js').catch((error) => {
    battlefieldPromise = null;
    console.error('[WAE V17] Shared battlefield failed to load', error);
    throw error;
  });
  return battlefieldPromise;
}

function watchSquadRoom() {
  const room = squadRoom();
  if (room && room !== lastRoom) loadBattlefield().catch(() => {});
  lastRoom = room;
}

applyV17Branding();
watchSquadRoom();
window.addEventListener('pageshow', () => {
  applyV17Branding();
  watchSquadRoom();
});
document.addEventListener('click', (event) => {
  if (event.target.closest('[data-open-v16-squad]')) window.setTimeout(watchSquadRoom, 250);
}, true);
window.setInterval(watchSquadRoom, 500);
