import '../v16/boot.js';
import './styles.css';
import './shared-battlefield.js';

const $ = (selector, root = document) => root.querySelector(selector);

function applyV17Branding() {
  document.title = 'WAE Neon Rider 3D · V17 Shared Battlefield';
  const seal = $('.wae-game-seal small');
  const brand = $('.brand-seal span');
  const start = $('#start-screen .eyebrow');
  if (seal) seal.textContent = 'ORIGINAL GAME SEAL · V17';
  if (brand) brand.textContent = 'NEON RIDER · SHARED BATTLEFIELD V17';
  if (start) start.textContent = 'WAE V17 / CO-OP · CAMPO COMPARTIDO · ELITE';
}

applyV17Branding();
window.addEventListener('pageshow', applyV17Branding);
