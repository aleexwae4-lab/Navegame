const $ = (selector, root = document) => root.querySelector(selector);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const LIVEOPS_KEY = 'wae_neon_rider_v20_liveops_profile';
const LEVEL_XP = 500;
const MAX_LEVEL = 30;

let lastState = '';
let lastResultKey = '';
let lastRenderKey = '';

function safeJson(key, fallback = {}) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value && typeof value === 'object' ? value : fallback;
  } catch {
    return fallback;
  }
}

function game() { return window.__waeNeonRiderGame; }

function trophyIcon() {
  return `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M10 5h12v5c0 5-2.4 8-6 9-3.6-1-6-4-6-9V5Z"/><path d="M10 8H5v2c0 4 2 6 6 6M22 8h5v2c0 4-2 6-6 6M16 19v5M11 27h10M13 24h6"/></svg>`;
}

function crownIcon() {
  return `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="m5 10 6 5 5-9 5 9 6-5-2 13H7L5 10Z"/><path d="M8 26h16"/></svg>`;
}

function starMarkup(count) {
  return Array.from({ length: 5 }, (_, index) => `<i class="${index < count ? 'on' : ''}">★</i>`).join('');
}

function snapshot() {
  const live = safeJson(LIVEOPS_KEY, {});
  const g = game();
  const seasonXp = Math.max(0, Number(live.seasonXp) || 0);
  const level = clamp(Math.floor(seasonXp / LEVEL_XP) + 1, 1, MAX_LEVEL);
  const stars = clamp(Math.ceil(level / 6), 1, 5);
  const marks = Math.max(0, Number(live.marks) || 0);
  const frame = String(live?.cosmetic?.frame || 'STANDARD').toUpperCase();
  const title = String(live?.cosmetic?.title || 'PILOT').toUpperCase();
  const score = Math.max(0, Number(g?.score) || 0);
  const highScore = Math.max(0, Number(g?.highScore ?? g?.profile?.highScore) || 0);
  const sector = Math.max(1, Number(g?.sector) || 1);
  const bestSector = Math.max(sector, Number(g?.profile?.bestSector) || 1);
  return { level, stars, marks, frame, title, score, highScore, sector, bestSector };
}

function ensureAmbient() {
  let layer = $('#v2112-prestige-ambient');
  if (layer) return layer;
  layer = document.createElement('div');
  layer.id = 'v2112-prestige-ambient';
  layer.className = 'v2112-prestige-ambient';
  layer.setAttribute('aria-hidden', 'true');
  const stars = Array.from({ length: 28 }, (_, index) => {
    const x = (index * 37 + 11) % 97;
    const y = (index * 61 + 7) % 91;
    const delay = ((index * 17) % 29) / 10;
    const scale = 0.55 + ((index * 13) % 8) / 10;
    return `<i style="--x:${x}%;--y:${y}%;--delay:${delay}s;--scale:${scale}"></i>`;
  }).join('');
  layer.innerHTML = `<div class="v2112-starscape">${stars}</div><span class="v2112-orbit-mark one">✦</span><span class="v2112-orbit-mark two">✦</span>`;
  document.body.append(layer);
  return layer;
}

function ensureStartPrestige() {
  const panel = $('#start-screen .panel');
  if (!panel) return null;
  let strip = $('.v2112-prestige-strip', panel);
  if (strip) return strip;
  strip = document.createElement('section');
  strip.className = 'v2112-prestige-strip';
  strip.setAttribute('aria-label', 'Prestigio del piloto');
  const anchor = $('.feature-strip', panel);
  (anchor || panel.querySelector('p'))?.insertAdjacentElement('afterend', strip);
  return strip;
}

function renderStartPrestige(data = snapshot()) {
  const strip = ensureStartPrestige();
  if (!strip) return;
  strip.innerHTML = `
    <article class="v2112-prestige-card v2112-prestige-card--stars">
      <div class="v2112-prestige-symbol">✦</div>
      <div><span>MAESTRÍA</span><strong>NIVEL ${data.level}</strong><div class="v2112-star-row">${starMarkup(data.stars)}</div></div>
    </article>
    <article class="v2112-prestige-card v2112-prestige-card--trophy">
      <div class="v2112-prestige-symbol">${trophyIcon()}</div>
      <div><span>MEJOR SECTOR</span><strong>${data.bestSector}</strong><small>${data.marks.toLocaleString('es-MX')} MARKS</small></div>
    </article>
    <article class="v2112-prestige-card v2112-prestige-card--crown">
      <div class="v2112-prestige-symbol">${crownIcon()}</div>
      <div><span>RANGO</span><strong>${data.title}</strong><small>${data.frame} FRAME</small></div>
    </article>`;
}

function ensureGameOverCrest() {
  const panel = $('#game-over-screen .panel');
  if (!panel) return null;
  let crest = $('.v2112-result-crest', panel);
  if (crest) return crest;
  crest = document.createElement('div');
  crest.className = 'v2112-result-crest';
  const eyebrow = $('.eyebrow', panel);
  if (eyebrow) eyebrow.insertAdjacentElement('afterend', crest);
  else panel.prepend(crest);
  return crest;
}

function emitBurst(kind = 'standard') {
  if (document.body.classList.contains('v21-reduced-fx')) return;
  const burst = document.createElement('div');
  burst.className = `v2112-prestige-burst ${kind}`;
  burst.setAttribute('aria-hidden', 'true');
  burst.innerHTML = Array.from({ length: 18 }, (_, index) => {
    const angle = (360 / 18) * index;
    const distance = 54 + (index % 5) * 12;
    const glyph = index % 3 === 0 ? '★' : '✦';
    return `<i style="--angle:${angle}deg;--distance:${distance}px;--delay:${(index % 4) * 0.035}s">${glyph}</i>`;
  }).join('');
  document.body.append(burst);
  setTimeout(() => burst.remove(), 1500);
}

function renderGameOver(data = snapshot(), celebrate = false) {
  const crest = ensureGameOverCrest();
  if (!crest) return;
  const record = data.score > 0 && data.score >= data.highScore;
  crest.classList.toggle('is-record', record);
  crest.innerHTML = `
    <div class="v2112-result-emblem">${record ? crownIcon() : trophyIcon()}<span>${record ? '★' : '✦'}</span></div>
    <div><span>${record ? 'NUEVO RÉCORD' : 'MISIÓN COMPLETADA'}</span><strong>${data.score.toLocaleString('es-MX')}</strong><small>SECTOR ${data.sector} · MAESTRÍA ${data.level}</small></div>`;
  if (celebrate) emitBurst(record ? 'record' : 'standard');
}

function syncState() {
  ensureAmbient();
  const g = game();
  const state = String(g?.state || 'idle');
  const data = snapshot();
  const renderKey = `${data.level}|${data.stars}|${data.marks}|${data.frame}|${data.title}|${data.bestSector}`;
  if (renderKey !== lastRenderKey) {
    lastRenderKey = renderKey;
    renderStartPrestige(data);
  }

  document.body.dataset.v2112PrestigeScene = state === 'idle' ? 'menu' : state === 'gameover' ? 'result' : 'game';

  if (state === 'gameover') {
    const resultKey = `${data.score}|${data.sector}|${data.highScore}`;
    const celebrate = lastState !== 'gameover' || resultKey !== lastResultKey;
    renderGameOver(data, celebrate);
    lastResultKey = resultKey;
  }
  lastState = state;
}

ensureAmbient();
renderStartPrestige();
syncState();

window.setInterval(syncState, 700);
window.addEventListener('pageshow', syncState);
window.addEventListener('storage', syncState);
document.addEventListener('wae:v21-identity-changed', syncState);
document.addEventListener('wae:settings-changed', syncState);
