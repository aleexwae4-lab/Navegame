const $ = (selector, root = document) => root.querySelector(selector);

const ARENA_KEY = 'wae_neon_rider_v21_competition_arena';
const SESSION_KEY = 'wae_neon_rider_v21_competition_session';

const MODES = Object.freeze([
  { id: 'sector', icon: '✦', label: 'SECTOR RUN', type: 'SOLO', description: 'Llega al sector más lejano posible en una sola operación.', metric: 'sector', reward: 'ARENA POINTS' },
  { id: 'score', icon: '★', label: 'SCORE ATTACK', type: 'SOLO', description: 'Maximiza puntuación y combos antes de perder la nave.', metric: 'score', reward: 'ARENA POINTS' },
  { id: 'squad', icon: '⋈', label: 'SQUAD LEAGUE', type: 'CO-OP', description: 'Forma un escuadrón y compite por desempeño coordinado.', metric: 'sector', reward: 'PRESTIGE + AP' },
]);

const state = { open: false, profile: null, lastGameState: '' };

function game() { return window.__waeNeonRiderGame; }
function safeJson(key, fallback = {}) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value && typeof value === 'object' ? value : fallback;
  } catch { return fallback; }
}

function defaultProfile() {
  return { points: 0, runs: [], best: { sector: 1, score: 0, squad: 1 }, season: 'FOUNDERS CIRCUIT' };
}

function loadProfile() {
  const raw = safeJson(ARENA_KEY, {});
  return {
    ...defaultProfile(),
    ...raw,
    best: { ...defaultProfile().best, ...(raw.best || {}) },
    runs: Array.isArray(raw.runs) ? raw.runs.slice(-40) : [],
  };
}

function saveProfile() {
  try { localStorage.setItem(ARENA_KEY, JSON.stringify(state.profile)); } catch {}
}

function currentSession() { return safeJson(SESSION_KEY, {}); }
function setSession(mode) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ mode, startedAt: Date.now() })); } catch {}
}
function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch {} }

function ensureLauncher() {
  const startMeta = $('#start-screen .start-meta');
  if (startMeta && !startMeta.querySelector('[data-v2115-arena-open]')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'v2115-arena-launch';
    button.dataset.v2115ArenaOpen = 'true';
    button.innerHTML = '<span>◇</span><b>COMPETIR</b><small data-v2115-ap>0 AP</small>';
    startMeta.append(button);
  }
  for (const node of document.querySelectorAll('[data-v2115-ap]')) node.textContent = `${state.profile?.points || 0} AP`;
}

function ensureArena() {
  let arena = $('#v2115-competition-arena');
  if (arena) return arena;
  arena = document.createElement('section');
  arena.id = 'v2115-competition-arena';
  arena.className = 'v2115-arena hidden';
  arena.setAttribute('role', 'dialog');
  arena.setAttribute('aria-modal', 'true');
  arena.setAttribute('aria-label', 'Competition Arena');
  arena.innerHTML = `
    <div class="v2115-arena-backdrop" data-v2115-arena-close></div>
    <div class="v2115-arena-shell">
      <header class="v2115-arena-head">
        <div class="v2115-arena-emblem">◇</div>
        <div><span>WAE COMPETITIVE SYSTEM · V21.15</span><h2>COMPETITION ARENA</h2><p>Competencia basada en habilidad. El modo con dinero real permanece bloqueado hasta contar con permisos y controles regulatorios.</p></div>
        <button type="button" data-v2115-arena-close aria-label="Cerrar">×</button>
      </header>
      <section class="v2115-arena-summary" data-v2115-summary></section>
      <div class="v2115-arena-grid" data-v2115-modes></div>
      <section class="v2115-money-gate">
        <div><span>REAL-MONEY COMPETITION</span><strong>COMPLIANCE GATE · BLOQUEADO</strong><p>No se aceptan depósitos ni se procesan premios en efectivo en esta versión.</p></div>
        <div class="v2115-money-requirements"><b>18+</b><b>LICENCIA / PERMISO</b><b>GEO</b><b>KYC / AML</b><b>REGLAS</b><b>ANTI-FRAUDE</b></div>
      </section>
      <section class="v2115-run-history" data-v2115-history></section>
      <footer><span>FREE ENTRY · SKILL-BASED · SIN DEPÓSITOS</span><b>WAE NEON RIDER</b></footer>
    </div>`;
  document.body.append(arena);
  return arena;
}

function renderArena() {
  const arena = ensureArena();
  const p = state.profile;
  $('[data-v2115-summary]', arena).innerHTML = `
    <article><span>ARENA POINTS</span><strong>${p.points.toLocaleString('es-MX')}</strong></article>
    <article><span>MEJOR SECTOR</span><strong>${p.best.sector}</strong></article>
    <article><span>MEJOR SCORE</span><strong>${p.best.score.toLocaleString('es-MX')}</strong></article>
    <article><span>TEMPORADA</span><strong>${p.season}</strong></article>`;

  $('[data-v2115-modes]', arena).innerHTML = MODES.map((mode) => {
    const best = mode.id === 'score' ? p.best.score.toLocaleString('es-MX') : mode.id === 'squad' ? p.best.squad : p.best.sector;
    return `<article class="v2115-mode-card">
      <div class="v2115-mode-icon">${mode.icon}</div>
      <span>${mode.type} · FREE ENTRY</span>
      <strong>${mode.label}</strong>
      <p>${mode.description}</p>
      <div><small>MEJOR</small><b>${best}</b><small>${mode.reward}</small></div>
      <button type="button" data-v2115-arena-play="${mode.id}">${mode.id === 'squad' ? 'ABRIR ESCUADRÓN' : 'INICIAR RETO'}</button>
    </article>`;
  }).join('');

  const recent = [...p.runs].slice(-5).reverse();
  $('[data-v2115-history]', arena).innerHTML = `<div class="v2115-history-head"><span>ÚLTIMAS OPERACIONES</span><b>${p.runs.length} REGISTRADAS</b></div>${recent.length ? recent.map((run) => `<article><span>${String(run.mode || 'sector').toUpperCase()}</span><strong>SECTOR ${run.sector}</strong><b>${Number(run.score || 0).toLocaleString('es-MX')} PTS</b><small>+${run.ap || 0} AP</small></article>`).join('') : '<p class="v2115-empty">Completa un reto para registrar tu primera operación competitiva.</p>'}`;
}

function openArena() {
  const g = game();
  if (g?.state === 'playing') g.pause?.();
  renderArena();
  ensureArena().classList.remove('hidden');
  document.body.classList.add('v2115-arena-open');
  state.open = true;
}

function closeArena() {
  ensureArena().classList.add('hidden');
  document.body.classList.remove('v2115-arena-open');
  state.open = false;
}

function startMode(mode) {
  if (!MODES.some((item) => item.id === mode)) return;
  setSession(mode);
  closeArena();
  if (mode === 'squad') {
    const squad = $('[data-open-v16-squad]');
    if (squad) squad.click();
    return;
  }
  const g = game();
  if (g?.state === 'paused') g.resume?.();
  else if (g?.state === 'idle' || g?.state === 'gameover') $('#start-btn')?.click();
}

function registerResult() {
  const session = currentSession();
  const mode = MODES.some((item) => item.id === session.mode) ? session.mode : '';
  if (!mode) return;
  const g = game();
  const score = Math.max(0, Math.floor(Number(g?.score) || 0));
  const sector = Math.max(1, Math.floor(Number(g?.sector ?? g?.profile?.bestSector) || 1));
  const oldSector = mode === 'squad' ? Number(state.profile.best.squad) || 1 : Number(state.profile.best.sector) || 1;
  const oldScore = Number(state.profile.best.score) || 0;
  let ap = 0;

  if (mode === 'score') {
    if (score > oldScore) ap = Math.max(20, Math.floor((score - oldScore) / 250));
    state.profile.best.score = Math.max(oldScore, score);
  } else if (mode === 'squad') {
    if (sector > oldSector) ap = Math.max(30, (sector - oldSector) * 35);
    state.profile.best.squad = Math.max(oldSector, sector);
  } else {
    if (sector > oldSector) ap = Math.max(20, (sector - oldSector) * 25);
    state.profile.best.sector = Math.max(oldSector, sector);
  }

  state.profile.points += ap;
  state.profile.runs.push({ mode, score, sector, ap, at: Date.now() });
  state.profile.runs = state.profile.runs.slice(-40);
  saveProfile();
  clearSession();
  ensureLauncher();
  if (state.open) renderArena();
  if (ap > 0) showToast(`NUEVA MARCA · +${ap} AP`);
}

function showToast(message) {
  let toast = $('#v2115-arena-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'v2115-arena-toast';
    toast.className = 'v2115-arena-toast';
    document.body.append(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 1800);
}

function syncGameState() {
  const current = String(game()?.state || 'idle');
  if (current === 'gameover' && state.lastGameState !== 'gameover') registerResult();
  state.lastGameState = current;
  ensureLauncher();
}

function installEvents() {
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-v2115-arena-open]')) { event.preventDefault(); openArena(); return; }
    if (event.target.closest('[data-v2115-arena-close]')) { event.preventDefault(); closeArena(); return; }
    const play = event.target.closest('[data-v2115-arena-play]');
    if (play) { event.preventDefault(); startMode(play.dataset.v2115ArenaPlay); }
  }, true);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.open) { event.stopImmediatePropagation(); closeArena(); }
  }, true);
}

state.profile = loadProfile();
ensureArena();
ensureLauncher();
installEvents();
syncGameState();
window.setInterval(syncGameState, 700);
window.addEventListener('pageshow', syncGameState);

window.__waeCompetitionArena = Object.freeze({ open: openArena, get: () => ({ ...state.profile }), start: startMode });
