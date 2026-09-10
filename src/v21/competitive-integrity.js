import { commerceState } from '../v12/backend.js';

const $ = (selector, root = document) => root.querySelector(selector);
const API_URL = String(import.meta.env.VITE_WAE_SUPABASE_URL || '').replace(/\/$/, '');
const API_KEY = String(import.meta.env.VITE_WAE_SUPABASE_PUBLISHABLE_KEY || '');
const FUNCTION_URL = API_URL ? `${API_URL}/functions/v1/wae-competition-core` : '';
const SESSION_KEY = 'wae_neon_rider_v21_ranked_session';
const INTEGRITY_KEY = 'wae_neon_rider_v21_integrity_state';
const CHECKPOINT_MS = 6000;

const state = {
  sessionId: '',
  nonce: '',
  seq: 0,
  previousFingerprint: 'GENESIS',
  integrityScore: 100,
  busy: false,
  recovering: false,
  lastSentAt: 0,
  lastError: '',
  isAdmin: false,
  adminChecked: false,
  reviewQueue: [],
};

function game() { return window.__waeNeonRiderGame; }
function safeJson(key, fallback = {}) {
  try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return value && typeof value === 'object' ? value : fallback; }
  catch { return fallback; }
}
function rankedSession() { return safeJson(SESSION_KEY, {}); }
function localIntegrity() { return safeJson(INTEGRITY_KEY, {}); }
function saveLocal() {
  try {
    if (!state.sessionId) localStorage.removeItem(INTEGRITY_KEY);
    else localStorage.setItem(INTEGRITY_KEY, JSON.stringify({
      sessionId: state.sessionId,
      nonce: state.nonce,
      seq: state.seq,
      previousFingerprint: state.previousFingerprint,
      integrityScore: state.integrityScore,
      lastSentAt: state.lastSentAt,
    }));
  } catch {}
}
function clearLocal() {
  state.sessionId = '';
  state.nonce = '';
  state.seq = 0;
  state.previousFingerprint = 'GENESIS';
  state.integrityScore = 100;
  state.lastSentAt = 0;
  state.lastError = '';
  try { localStorage.removeItem(INTEGRITY_KEY); } catch {}
  renderBadge();
}
function token() { return commerceState.session?.access_token || ''; }
async function api(body) {
  if (!FUNCTION_URL || !token()) throw new Error('INTEGRITY_AUTH_REQUIRED');
  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: { apikey: API_KEY, Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error || 'INTEGRITY_REQUEST_FAILED');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}
async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
function snapshot() {
  const g = game();
  const ship = g?.ship?.position;
  return {
    score: Math.max(0, Math.floor(Number(g?.score) || 0)),
    sector: Math.max(1, Math.floor(Number(g?.sector ?? g?.level ?? g?.profile?.bestSector) || 1)),
    shield: Math.max(0, Math.floor(Number(g?.shield) || 0)),
    shipX: Number(ship?.x || 0),
    shipY: Number(ship?.y || 0),
  };
}
function ensureBadge() {
  let badge = $('#v2120-integrity-badge');
  if (badge) return badge;
  badge = document.createElement('div');
  badge.id = 'v2120-integrity-badge';
  badge.className = 'v2120-integrity-badge hidden';
  badge.innerHTML = '<span>⬢</span><div><b>RANKED INTEGRITY</b><small data-v2120-badge-status>SYNC READY</small></div><strong data-v2120-badge-score>100</strong>';
  document.body.append(badge);
  return badge;
}
function renderBadge() {
  const badge = ensureBadge();
  const active = Boolean(rankedSession()?.id);
  badge.classList.toggle('hidden', !active);
  if (!active) return;
  const score = Math.max(0, Math.min(100, Number(state.integrityScore) || 0));
  badge.dataset.zone = score >= 85 ? 'secure' : score >= 60 ? 'warn' : 'danger';
  $('[data-v2120-badge-score]', badge).textContent = String(score);
  const gState = String(game()?.state || 'idle');
  let status = state.lastError ? state.lastError : state.busy ? 'ENVIANDO CHECKPOINT…' : `CHECKPOINT ${state.seq} · ${gState === 'playing' ? 'LIVE' : 'HOLD'}`;
  $('[data-v2120-badge-status]', badge).textContent = status;
}
function ensurePanel() {
  const championship = $('#v2119-championship .v2119-shell');
  if (!championship) return null;
  let panel = $('.v2120-integrity-panel', championship);
  if (panel) return panel;
  panel = document.createElement('section');
  panel.className = 'v2120-integrity-panel';
  panel.innerHTML = `
    <div class="v2120-integrity-mark">⬢</div>
    <div><span>COMPETITIVE INTEGRITY · V21.20</span><strong>TELEMETRÍA ENCADENADA SHA-256</strong><p>Checkpoints emitidos durante la partida. Los resultados siguen siendo PROVISIONALES hasta revisión oficial.</p></div>
    <div class="v2120-integrity-metrics"><span>TRUST<strong data-v2120-panel-score>100/100</strong></span><span>CHECKPOINTS<strong data-v2120-panel-checkpoints>0</strong></span><button type="button" class="hidden" data-v2120-review-open>REVISIÓN</button></div>`;
  $('.v2119-ranked-entry', championship)?.insertAdjacentElement('afterend', panel);
  return panel;
}
function renderPanel() {
  const panel = ensurePanel();
  if (!panel) return;
  $('[data-v2120-panel-score]', panel).textContent = `${Math.round(state.integrityScore)}/100`;
  $('[data-v2120-panel-checkpoints]', panel).textContent = String(state.seq);
  $('[data-v2120-review-open]', panel).classList.toggle('hidden', !state.isAdmin);
}
async function recoverSession(session) {
  if (!session?.id || state.recovering || !token()) return;
  state.recovering = true;
  try {
    const data = await api({ action: 'resume', sessionId: session.id });
    const remote = data.session || {};
    state.sessionId = remote.id || session.id;
    state.nonce = remote.integrity_nonce || '';
    state.seq = Number(remote.lastCheckpointSeq ?? remote.last_checkpoint_seq) || 0;
    state.previousFingerprint = remote.lastFingerprint || 'GENESIS';
    state.integrityScore = Number(remote.integrity_score) || 100;
    state.lastSentAt = Date.now();
    state.lastError = '';
    saveLocal();
  } catch (error) {
    state.lastError = error.message || 'SYNC ERROR';
    if (error.message === 'SESSION_NOT_ACTIVE') clearLocal();
  } finally {
    state.recovering = false;
    renderBadge();
    renderPanel();
  }
}
async function sendCheckpoint() {
  const session = rankedSession();
  const g = game();
  if (!session?.id || !g || g.state !== 'playing' || state.busy || !state.nonce) return;
  state.busy = true;
  renderBadge();
  try {
    const snap = snapshot();
    const seq = state.seq + 1;
    const clientElapsedMs = Math.max(0, Math.floor(Date.now() - new Date(session.startedAt || session.started_at || Date.now()).getTime()));
    const canonical = `${state.previousFingerprint}|${state.nonce}|${seq}|${snap.score}|${snap.sector}|${snap.shield}|${snap.shipX.toFixed(3)}|${snap.shipY.toFixed(3)}|${clientElapsedMs}`;
    const fingerprint = await sha256Hex(canonical);
    const data = await api({ action: 'checkpoint', sessionId: session.id, seq, ...snap, clientElapsedMs, fingerprint });
    state.seq = Number(data.seq) || seq;
    state.previousFingerprint = fingerprint;
    state.integrityScore = Number(data.integrityScore) || state.integrityScore;
    state.lastSentAt = Date.now();
    state.lastError = Array.isArray(data.flags) && data.flags.length ? data.flags[0].replaceAll('_', ' ') : '';
    saveLocal();
  } catch (error) {
    state.lastError = error.message || 'CHECKPOINT ERROR';
    if (error.message === 'CHECKPOINT_SEQUENCE_MISMATCH') await recoverSession(session);
    if (['SESSION_NOT_ACTIVE', 'FINGERPRINT_MISMATCH', 'INTEGRITY_REJECTED'].includes(error.message)) clearLocal();
  } finally {
    state.busy = false;
    renderBadge();
    renderPanel();
  }
}
function decorateLeaderboard() {
  for (const row of document.querySelectorAll('.v2119-row[data-v2119-pilot]')) {
    if (row.querySelector('.v2120-row-integrity')) continue;
    try {
      const data = JSON.parse(decodeURIComponent(row.dataset.v2119Pilot || ''));
      const score = Math.max(0, Math.min(100, Number(data.integrityScore) || 0));
      const trust = document.createElement('span');
      trust.className = `v2120-row-integrity ${score >= 85 ? 'secure' : score >= 60 ? 'warn' : 'danger'}`;
      trust.innerHTML = `<i>⬢</i><b>${score}</b><small>${Number(data.checkpointCount) || 0} CP</small>`;
      row.append(trust);
    } catch {}
  }
}
async function probeAdmin() {
  if (state.adminChecked || !token()) return;
  state.adminChecked = true;
  try {
    const data = await api({ action: 'review-list' });
    state.isAdmin = true;
    state.reviewQueue = Array.isArray(data.queue) ? data.queue : [];
  } catch {
    state.isAdmin = false;
  }
  renderPanel();
}
function ensureReviewConsole() {
  let overlay = $('#v2120-review-console');
  if (overlay) return overlay;
  overlay = document.createElement('section');
  overlay.id = 'v2120-review-console';
  overlay.className = 'v2120-review-console hidden';
  overlay.innerHTML = '<div class="v2120-review-backdrop" data-v2120-review-close></div><article><header><div><span>WAE COMPETITIVE OPERATIONS</span><h3>INTEGRITY REVIEW</h3></div><button type="button" data-v2120-review-close>×</button></header><div data-v2120-review-list></div></article>';
  document.body.append(overlay);
  return overlay;
}
function renderReviewQueue() {
  const overlay = ensureReviewConsole();
  const list = $('[data-v2120-review-list]', overlay);
  list.innerHTML = state.reviewQueue.length ? state.reviewQueue.map((row) => `
    <section class="v2120-review-item"><div><span>${row.mode.toUpperCase()} · ${row.publicId}</span><strong>${row.callsign}</strong><p>${Number(row.score).toLocaleString('es-MX')} pts · sector ${row.sector} · ${row.checkpoint_count} checkpoints</p></div><div class="v2120-review-trust"><b>${row.integrity_score}/100</b><small>${(row.integrity_flags || []).join(' · ') || 'SIN FLAGS'}</small></div><div><button type="button" data-v2120-review="official" data-result-id="${row.id}">OFICIAL</button><button type="button" data-v2120-review="rejected" data-result-id="${row.id}">RECHAZAR</button></div></section>`).join('') : '<p class="v2120-review-empty">No hay resultados provisionales pendientes.</p>';
}
async function refreshReviewQueue() {
  if (!state.isAdmin) return;
  const data = await api({ action: 'review-list' });
  state.reviewQueue = Array.isArray(data.queue) ? data.queue : [];
  renderReviewQueue();
}
async function reviewResult(resultId, status) {
  try {
    await api({ action: 'review', resultId, status, note: status === 'official' ? 'Validación V21.20 aprobada.' : 'Rechazado por revisión de integridad.' });
    await refreshReviewQueue();
    window.__waeSeasonChampionship?.refresh?.();
  } catch (error) {
    state.lastError = error.message || 'REVIEW ERROR';
    renderBadge();
  }
}
function installEvents() {
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-v2119-open]')) window.setTimeout(() => { ensurePanel(); renderPanel(); probeAdmin(); decorateLeaderboard(); }, 80);
    if (event.target.closest('[data-v2120-review-open]')) { event.preventDefault(); ensureReviewConsole().classList.remove('hidden'); refreshReviewQueue(); return; }
    if (event.target.closest('[data-v2120-review-close]')) { event.preventDefault(); ensureReviewConsole().classList.add('hidden'); return; }
    const review = event.target.closest('[data-v2120-review]');
    if (review) { event.preventDefault(); reviewResult(review.dataset.resultId, review.dataset.v2120Review); }
  }, true);
}
function sync() {
  const session = rankedSession();
  if (!session?.id) {
    if (state.sessionId) clearLocal();
    renderBadge();
    renderPanel();
    decorateLeaderboard();
    return;
  }
  const local = localIntegrity();
  if (state.sessionId !== session.id) {
    state.sessionId = session.id;
    state.nonce = local.sessionId === session.id ? String(local.nonce || '') : '';
    state.seq = local.sessionId === session.id ? Number(local.seq || 0) : 0;
    state.previousFingerprint = local.sessionId === session.id ? String(local.previousFingerprint || 'GENESIS') : 'GENESIS';
    state.integrityScore = local.sessionId === session.id ? Number(local.integrityScore || 100) : 100;
    state.lastSentAt = Number(local.lastSentAt || 0);
  }
  if (!state.nonce && !state.recovering) recoverSession(session);
  if (game()?.state === 'playing' && state.nonce && Date.now() - state.lastSentAt >= CHECKPOINT_MS) sendCheckpoint();
  renderBadge();
  renderPanel();
  decorateLeaderboard();
}

ensureBadge();
ensureReviewConsole();
installEvents();
sync();
window.setInterval(sync, 750);
window.addEventListener('pageshow', sync);
window.addEventListener('storage', sync);

document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });

window.__waeCompetitiveIntegrity = Object.freeze({
  get: () => ({ sessionId: state.sessionId, seq: state.seq, integrityScore: state.integrityScore, lastFingerprint: state.previousFingerprint, isAdmin: state.isAdmin }),
  checkpoint: sendCheckpoint,
  recover: () => recoverSession(rankedSession()),
});
