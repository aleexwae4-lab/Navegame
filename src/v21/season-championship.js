import { commerceState } from '../v12/backend.js';

const $ = (selector, root = document) => root.querySelector(selector);
const API_URL = String(import.meta.env.VITE_WAE_SUPABASE_URL || '').replace(/\/$/, '');
const API_KEY = String(import.meta.env.VITE_WAE_SUPABASE_PUBLISHABLE_KEY || '');
const FUNCTION_URL = API_URL ? `${API_URL}/functions/v1/wae-competition-core` : '';
const PROFILE_KEY = 'wae_neon_rider_v21_championship_profile';
const SESSION_KEY = 'wae_neon_rider_v21_ranked_session';
const OMEGA_SKU = 'WAE-SHIP-AURELION-OMG';
const MODES = Object.freeze([
  { id: 'sector', label: 'SECTOR RUN', metric: 'SECTOR' },
  { id: 'score', label: 'SCORE ATTACK', metric: 'PUNTOS' },
  { id: 'squad', label: 'SQUAD LEAGUE', metric: 'SECTOR' },
]);
const DIVISIONS = Object.freeze(['BRONZE', 'SILVER', 'GOLD', 'ELITE', 'MYTHIC', 'OMEGA']);

const state = {
  open: false,
  mode: 'sector',
  loading: false,
  season: null,
  leaderboard: [],
  lastGameState: '',
  finishPending: false,
  profile: loadProfile(),
};

function game() { return window.__waeNeonRiderGame; }
function safeJson(key, fallback = {}) {
  try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return value && typeof value === 'object' ? value : fallback; }
  catch { return fallback; }
}
function loadProfile() {
  const raw = safeJson(PROFILE_KEY, {});
  const email = commerceState.session?.user?.email || '';
  return { callsign: sanitize(raw.callsign || email.split('@')[0] || 'PILOT', 24) };
}
function saveProfile() {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(state.profile)); } catch {}
}
function sanitize(value, max = 24) {
  return String(value || '').replace(/[^\p{L}\p{N}\s._\-]/gu, '').trim().slice(0, max) || 'PILOT';
}
function rankedSession() { return safeJson(SESSION_KEY, {}); }
function saveRankedSession(value) {
  try {
    if (value?.id) localStorage.setItem(SESSION_KEY, JSON.stringify(value));
    else localStorage.removeItem(SESSION_KEY);
  } catch {}
}
function signedIn() { return Boolean(commerceState.session?.access_token); }
function identity() {
  const data = window.__waeRewardForge?.getIdentity?.() || {};
  return { title: data.title || 'PILOT', badge: data.badgeIcon || '◇' };
}
function money(value) { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(value) || 0); }
function formatNumber(value) { return Number(value || 0).toLocaleString('es-MX'); }
function modeInfo(id = state.mode) { return MODES.find((entry) => entry.id === id) || MODES[0]; }

async function api(path = '', options = {}) {
  if (!FUNCTION_URL) throw new Error('COMPETITION_BACKEND_NOT_CONFIGURED');
  const token = commerceState.session?.access_token;
  const headers = { apikey: API_KEY, 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${FUNCTION_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error || 'COMPETITION_REQUEST_FAILED');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function ensureLauncher() {
  const startMeta = $('#start-screen .start-meta');
  if (startMeta && !startMeta.querySelector('[data-v2119-open]')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.v2119Open = 'true';
    button.className = 'v2119-launch';
    button.innerHTML = '<span>♛</span><b>CAMPEONATO</b><small>GLOBAL · S1</small>';
    startMeta.append(button);
  }
  const pausePanel = $('#pause-screen .panel');
  if (pausePanel && !pausePanel.querySelector('[data-v2119-open]')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.v2119Open = 'true';
    button.className = 'v2119-pause-launch';
    button.textContent = '♛  CAMPEONATO GLOBAL';
    pausePanel.append(button);
  }
}

function ensureChampionship() {
  let overlay = $('#v2119-championship');
  if (overlay) return overlay;
  overlay = document.createElement('section');
  overlay.id = 'v2119-championship';
  overlay.className = 'v2119-championship hidden';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Season Championship');
  overlay.innerHTML = `
    <div class="v2119-backdrop" data-v2119-close></div>
    <div class="v2119-shell">
      <header class="v2119-head">
        <div class="v2119-mark"><span>♛</span><b>S1</b></div>
        <div><span>WAE COMPETITIVE NETWORK · V21.19</span><h2>SEASON CHAMPIONSHIP</h2><p>Ranking global con sesiones competitivas emitidas por servidor.</p></div>
        <button type="button" data-v2119-close aria-label="Cerrar">×</button>
      </header>
      <section class="v2119-season" data-v2119-season></section>
      <section class="v2119-prize">
        <div class="v2119-prize-orbit"><i>✦</i><strong>Ω</strong><i>✦</i></div>
        <div><span>GRAND CHAMPIONSHIP TROPHY</span><h3>WAE AURELION SOVEREIGN Ω</h3><p>Premio insignia de temporada. Sólo un resultado marcado como <b>OFICIAL</b> puede ser elegible para adjudicación.</p></div>
        <div><strong data-v2119-prize-value>$4,999</strong><small>VALOR DE CATÁLOGO</small><button type="button" data-v2119-omega>REVEAL 3D</button></div>
      </section>
      <nav class="v2119-divisions">${DIVISIONS.map((d) => `<span data-v2119-division="${d}">${d}</span>`).join('')}</nav>
      <div class="v2119-controls">
        <div class="v2119-mode-tabs">${MODES.map((m) => `<button type="button" data-v2119-mode="${m.id}" class="${m.id === 'sector' ? 'active' : ''}">${m.label}</button>`).join('')}</div>
        <div class="v2119-profile-edit"><label>INDICATIVO<input data-v2119-callsign maxlength="24" value="PILOT"></label><button type="button" data-v2119-save-profile>GUARDAR</button></div>
      </div>
      <section class="v2119-ranked-entry" data-v2119-entry></section>
      <section class="v2119-board">
        <div class="v2119-board-head"><div><span>GLOBAL LEADERBOARD</span><strong data-v2119-board-title>SECTOR RUN</strong></div><button type="button" data-v2119-refresh>↻ ACTUALIZAR</button></div>
        <div class="v2119-podium" data-v2119-podium></div>
        <div class="v2119-list" data-v2119-list></div>
      </section>
      <footer><span>SERVER SESSION · PROVISIONAL RESULTS · OFFICIAL REVIEW FOR PRIZE</span><b>WAE NEON RIDER</b></footer>
    </div>`;
  document.body.append(overlay);
  return overlay;
}

function seasonCountdown() {
  if (!state.season?.endsAt) return 'TEMPORADA ACTIVA';
  const ms = new Date(state.season.endsAt).getTime() - Date.now();
  if (ms <= 0) return 'TEMPORADA CERRADA';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  return `${days}D ${hours}H RESTANTES`;
}

function renderSeason() {
  const overlay = ensureChampionship();
  const season = state.season;
  $('[data-v2119-season]', overlay).innerHTML = season ? `
    <article><span>TEMPORADA</span><strong>${season.name}</strong></article>
    <article><span>ESTADO</span><strong>${seasonCountdown()}</strong></article>
    <article><span>REGLAS</span><strong>V${season.rulesVersion}</strong></article>
    <article><span>PREMIO</span><strong>${money(season.prizeValueMxn)}</strong></article>` : '<article><span>RED COMPETITIVA</span><strong>CARGANDO…</strong></article>';
  if (season) $('[data-v2119-prize-value]', overlay).textContent = money(season.prizeValueMxn);
}

function renderEntry() {
  const overlay = ensureChampionship();
  const session = rankedSession();
  const entry = $('[data-v2119-entry]', overlay);
  const id = identity();
  $('[data-v2119-callsign]', overlay).value = state.profile.callsign;
  if (!signedIn()) {
    entry.innerHTML = `<div><span>RANKED ACCESS</span><strong>CUENTA WAE REQUERIDA</strong><p>El leaderboard puede consultarse públicamente, pero las partidas ranked necesitan una sesión autenticada para emitir un session_id.</p></div><button type="button" data-v2119-auth>INICIAR SESIÓN</button>`;
    return;
  }
  if (session?.id) {
    entry.innerHTML = `<div><span>SESIÓN RANKED ACTIVA</span><strong>${String(session.mode || '').toUpperCase()} · ${state.profile.callsign}</strong><p>Session ID: ${String(session.id).slice(0, 8).toUpperCase()}… · El resultado se enviará al terminar la operación.</p></div><button type="button" disabled>EN OPERACIÓN</button>`;
    return;
  }
  entry.innerHTML = `<div><span>IDENTIDAD COMPETITIVA</span><strong>${id.badge} ${state.profile.callsign} · ${id.title}</strong><p>El servidor emitirá una sesión para ${modeInfo().label}. El resultado se publicará inicialmente como PROVISIONAL.</p></div><button type="button" data-v2119-start>INICIAR RANKED</button>`;
}

function rowMarkup(row, rank) {
  const primary = state.mode === 'score' ? `${formatNumber(row.score)} PTS` : `SECTOR ${row.sector}`;
  const secondary = state.mode === 'score' ? `SECTOR ${row.sector}` : `${formatNumber(row.score)} PTS`;
  const status = row.status === 'official' ? 'OFICIAL' : 'PROVISIONAL';
  return `<button type="button" class="v2119-row" data-v2119-pilot='${encodeURIComponent(JSON.stringify(row))}'>
    <b class="v2119-rank">#${rank}</b><span class="v2119-badge">${row.badge || '◇'}</span>
    <span class="v2119-name"><strong>${row.callsign}</strong><small>${row.title || 'PILOT'} · ${row.publicId}</small></span>
    <span class="v2119-division division-${String(row.division).toLowerCase()}">${row.division}</span>
    <span class="v2119-score"><strong>${primary}</strong><small>${secondary}</small></span>
    <span class="v2119-status ${status === 'OFICIAL' ? 'official' : ''}">${status}</span>
  </button>`;
}

function renderLeaderboard() {
  const overlay = ensureChampionship();
  $('[data-v2119-board-title]', overlay).textContent = modeInfo().label;
  for (const button of overlay.querySelectorAll('[data-v2119-mode]')) button.classList.toggle('active', button.dataset.v2119Mode === state.mode);
  const top = state.leaderboard.slice(0, 3);
  $('[data-v2119-podium]', overlay).innerHTML = top.length ? [1, 0, 2].map((sourceIndex, visualIndex) => {
    const row = top[sourceIndex];
    if (!row) return '';
    const rank = sourceIndex + 1;
    const metric = state.mode === 'score' ? `${formatNumber(row.score)} PTS` : `SECTOR ${row.sector}`;
    return `<button type="button" class="v2119-podium-card place-${rank}" data-v2119-pilot='${encodeURIComponent(JSON.stringify(row))}'><span>${rank === 1 ? '♛' : rank === 2 ? '★' : '✦'}</span><b>#${rank}</b><strong>${row.callsign}</strong><small>${row.division}</small><em>${metric}</em></button>`;
  }).join('') : '<p class="v2119-empty">Todavía no hay resultados globales en esta modalidad.</p>';
  $('[data-v2119-list]', overlay).innerHTML = state.leaderboard.length ? state.leaderboard.map((row, index) => rowMarkup(row, index + 1)).join('') : '<p class="v2119-empty">Sé el primer piloto en registrar una marca.</p>';
  renderEntry();
}

async function refreshLeaderboard() {
  if (state.loading) return;
  state.loading = true;
  const overlay = ensureChampionship();
  $('[data-v2119-refresh]', overlay).disabled = true;
  try {
    const data = await api(`?mode=${encodeURIComponent(state.mode)}`);
    state.season = data.season || null;
    state.leaderboard = Array.isArray(data.leaderboard) ? data.leaderboard : [];
    renderSeason();
    renderLeaderboard();
  } catch (error) {
    showToast(error.message || 'LEADERBOARD NO DISPONIBLE');
  } finally {
    state.loading = false;
    $('[data-v2119-refresh]', overlay).disabled = false;
  }
}

async function startRanked() {
  if (!signedIn()) { openAuth(); return; }
  if (rankedSession()?.id) { showToast('YA EXISTE UNA SESIÓN RANKED ACTIVA'); return; }
  const button = $('[data-v2119-start]', ensureChampionship());
  if (button) { button.disabled = true; button.textContent = 'EMITIENDO SESIÓN…'; }
  try {
    const data = await api('', { method: 'POST', body: JSON.stringify({ action: 'start', mode: state.mode, clientVersion: 'V21.19' }) });
    const session = data.session;
    saveRankedSession({ id: session.id, mode: session.mode, startedAt: session.started_at });
    closeChampionship();
    showToast(`RANKED ${String(session.mode).toUpperCase()} · SESIÓN ACTIVA`);
    if (session.mode === 'squad') {
      document.querySelector('[data-open-v16-squad]')?.click();
    } else {
      const g = game();
      if (g?.state === 'paused') g.resume?.();
      else if (g?.state === 'idle' || g?.state === 'gameover') $('#start-btn')?.click();
    }
  } catch (error) {
    if (error.data?.session?.id) {
      const existing = error.data.session;
      saveRankedSession({ id: existing.id, mode: existing.mode, startedAt: existing.started_at });
      showToast('SE RECUPERÓ UNA SESIÓN RANKED ACTIVA');
    } else showToast(error.message || 'NO SE PUDO INICIAR RANKED');
    renderEntry();
  }
}

async function finishRanked() {
  const session = rankedSession();
  if (!session?.id || state.finishPending) return;
  const g = game();
  if (!g) return;
  state.finishPending = true;
  const id = identity();
  try {
    const data = await api('', { method: 'POST', body: JSON.stringify({
      action: 'finish', sessionId: session.id,
      score: Math.max(0, Math.floor(Number(g.score) || 0)),
      sector: Math.max(1, Math.floor(Number(g.sector ?? g.profile?.bestSector) || 1)),
      callsign: state.profile.callsign, title: id.title, badge: id.badge,
    }) });
    saveRankedSession(null);
    showToast(`${data.result?.division || 'BRONZE'} · RESULTADO PROVISIONAL REGISTRADO`);
    state.mode = data.result?.mode || state.mode;
    await refreshLeaderboard();
  } catch (error) {
    if (['SESSION_NOT_ACTIVE', 'INVALID_DURATION', 'PLAUSIBILITY_CHECK_FAILED'].includes(error.message)) saveRankedSession(null);
    showToast(error.message || 'RESULTADO NO REGISTRADO');
  } finally {
    state.finishPending = false;
  }
}

function openAuth() {
  closeChampionship();
  $('[data-open-v11-store]')?.click();
  window.setTimeout(() => document.querySelector('[data-v12-auth]')?.click(), 120);
}

function openPilot(row) {
  let modal = $('#v2119-pilot-card');
  if (!modal) {
    modal = document.createElement('section');
    modal.id = 'v2119-pilot-card';
    modal.className = 'v2119-pilot-card hidden';
    modal.innerHTML = '<div class="v2119-pilot-backdrop" data-v2119-pilot-close></div><article><button type="button" data-v2119-pilot-close>×</button><div data-v2119-pilot-content></div></article>';
    document.body.append(modal);
  }
  const metric = state.mode === 'score' ? `${formatNumber(row.score)} PTS` : `SECTOR ${row.sector}`;
  $('[data-v2119-pilot-content]', modal).innerHTML = `<span class="v2119-pilot-icon">${row.badge || '◇'}</span><small>WAE PILOT · ${row.publicId}</small><h3>${row.callsign}</h3><p>${row.title || 'PILOT'}</p><div><span>DIVISIÓN<strong>${row.division}</strong></span><span>MARCA<strong>${metric}</strong></span><span>AP<strong>${formatNumber(row.arenaPoints)}</strong></span><span>ESTADO<strong>${String(row.status).toUpperCase()}</strong></span></div><small>Los resultados provisionales aparecen en ranking, pero no son elegibles para adjudicación del premio hasta revisión oficial.</small>`;
  modal.classList.remove('hidden');
}

function closePilot() { $('#v2119-pilot-card')?.classList.add('hidden'); }
function openChampionship() {
  const g = game();
  if (g?.state === 'playing') g.pause?.();
  ensureChampionship().classList.remove('hidden');
  document.body.classList.add('v2119-open');
  state.open = true;
  renderSeason();
  renderEntry();
  refreshLeaderboard();
}
function closeChampionship() {
  ensureChampionship().classList.add('hidden');
  document.body.classList.remove('v2119-open');
  state.open = false;
}
function showToast(message) {
  let toast = $('#v2119-toast');
  if (!toast) { toast = document.createElement('div'); toast.id = 'v2119-toast'; toast.className = 'v2119-toast'; document.body.append(toast); }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function syncGameState() {
  const current = String(game()?.state || 'idle');
  if (current === 'gameover' && state.lastGameState !== 'gameover' && rankedSession()?.id) finishRanked();
  state.lastGameState = current;
  ensureLauncher();
  if (state.open) renderEntry();
}

function installEvents() {
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-v2119-open]')) { event.preventDefault(); openChampionship(); return; }
    if (event.target.closest('[data-v2119-close]')) { event.preventDefault(); closeChampionship(); return; }
    if (event.target.closest('[data-v2119-refresh]')) { event.preventDefault(); refreshLeaderboard(); return; }
    if (event.target.closest('[data-v2119-auth]')) { event.preventDefault(); openAuth(); return; }
    if (event.target.closest('[data-v2119-start]')) { event.preventDefault(); startRanked(); return; }
    if (event.target.closest('[data-v2119-save-profile]')) {
      event.preventDefault(); state.profile.callsign = sanitize($('[data-v2119-callsign]', ensureChampionship()).value, 24); saveProfile(); renderEntry(); showToast('INDICATIVO GUARDADO'); return;
    }
    const mode = event.target.closest('[data-v2119-mode]');
    if (mode) { event.preventDefault(); state.mode = MODES.some((m) => m.id === mode.dataset.v2119Mode) ? mode.dataset.v2119Mode : 'sector'; refreshLeaderboard(); return; }
    const pilot = event.target.closest('[data-v2119-pilot]');
    if (pilot) { event.preventDefault(); try { openPilot(JSON.parse(decodeURIComponent(pilot.dataset.v2119Pilot))); } catch {} return; }
    if (event.target.closest('[data-v2119-pilot-close]')) { event.preventDefault(); closePilot(); return; }
    if (event.target.closest('[data-v2119-omega]')) { event.preventDefault(); window.__waeLuxuryShowroom?.open?.(OMEGA_SKU); }
  }, true);
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!$('#v2119-pilot-card')?.classList.contains('hidden')) { event.stopImmediatePropagation(); closePilot(); return; }
    if (state.open) { event.stopImmediatePropagation(); closeChampionship(); }
  }, true);
}

ensureChampionship();
ensureLauncher();
installEvents();
syncGameState();
window.setInterval(syncGameState, 700);
window.setInterval(() => { if (state.open) renderSeason(); }, 60000);
window.addEventListener('pageshow', syncGameState);
window.addEventListener('storage', syncGameState);

window.__waeSeasonChampionship = Object.freeze({
  open: openChampionship,
  close: closeChampionship,
  refresh: refreshLeaderboard,
  start: startRanked,
  get: () => ({ mode: state.mode, season: state.season, leaderboard: [...state.leaderboard], rankedSession: rankedSession() }),
});
