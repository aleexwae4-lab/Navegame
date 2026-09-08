const $ = (selector, root = document) => root.querySelector(selector);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const PROFILE_KEY = 'wae_neon_rider_v20_liveops_profile';
const RAID_KEY = 'wae_neon_rider_v19_raid_profile';
const HISTORY_KEY = 'wae_neon_rider_v18_runs';
const SEASON_EPOCH = Date.UTC(2026, 8, 8, 0, 0, 0);
const SEASON_MS = 28 * 24 * 60 * 60 * 1000;
const LEVEL_XP = 500;
const MAX_LEVEL = 30;
const TICK_MS = 750;

const SEASON_NAMES = Object.freeze([
  'ECLIPSE PROTOCOL',
  'SOVEREIGN SIGNAL',
  'OBSIDIAN FRONT',
  'CELESTIAL VECTOR',
]);

const DAILY_POOL = Object.freeze([
  { metric: 'kills', label: 'CAZADOR DE NEÓN', description: 'Destruye {target} enemigos.', targets: [18, 24, 30], xp: 120 },
  { metric: 'elites', label: 'PRECISIÓN ÉLITE', description: 'Destruye {target} enemigos élite.', targets: [2, 3, 4], xp: 150 },
  { metric: 'missiles', label: 'LOCK & FIRE', description: 'Dispara {target} misiles WAE.', targets: [4, 6, 8], xp: 110 },
  { metric: 'objectives', label: 'OBJETIVO CUMPLIDO', description: 'Completa {target} objetivos secundarios.', targets: [1, 2, 3], xp: 140 },
  { metric: 'raids', label: 'GUARDIAN BREAKER', description: 'Derrota {target} Guardián.', targets: [1], xp: 180 },
  { metric: 'evades', label: 'PERFECT VECTOR', description: 'Consigue {target} Perfect Evades.', targets: [2, 3], xp: 170 },
]);

const WEEKLY_POOL = Object.freeze([
  { metric: 'kills', label: 'PURGA SECTORIAL', description: 'Destruye {target} enemigos.', targets: [120, 150, 180], xp: 480 },
  { metric: 'elites', label: 'ELITE HUNTER', description: 'Destruye {target} élites.', targets: [10, 12, 15], xp: 520 },
  { metric: 'raids', label: 'RAID COMMAND', description: 'Completa {target} raids de Guardianes.', targets: [3, 4, 5], xp: 620 },
  { metric: 'objectives', label: 'MISSION CONTROL', description: 'Completa {target} objetivos secundarios.', targets: [7, 9, 12], xp: 500 },
  { metric: 'missiles', label: 'ARSENAL DOCTRINE', description: 'Dispara {target} misiles WAE.', targets: [20, 25, 30], xp: 470 },
  { metric: 'evades', label: 'ZERO-HIT THEORY', description: 'Consigue {target} Perfect Evades.', targets: [8, 10, 12], xp: 650 },
]);

const TRACK_REWARDS = Object.freeze([
  'COMMAND MARK I', 'CYAN FRAME', '150 MARKS', 'VECTOR TITLE', 'COMMAND MARK II',
  'VIOLET FRAME', '200 MARKS', 'RAIDBREAKER TITLE', 'COMMAND MARK III', 'OBSIDIAN FRAME',
  '250 MARKS', 'SOVEREIGN TITLE', 'COMMAND MARK IV', 'GOLD FRAME', '300 MARKS',
  'ECLIPSE TITLE', 'COMMAND MARK V', 'CELESTIAL FRAME', '400 MARKS', 'WARDEN TITLE',
  'COMMAND MARK VI', 'PRISM FRAME', '500 MARKS', 'IMPERIUM TITLE', 'COMMAND MARK VII',
  'FOUNDER FRAME', '650 MARKS', 'MYTHIC TITLE', 'COMMAND MARK VIII', 'CROWN SIGNAL',
]);

const state = {
  tickTimer: 0,
  open: false,
  profile: null,
  daily: [],
  weekly: [],
  metrics: null,
  lastRenderKey: '',
};

function game() {
  return window.__waeNeonRiderGame;
}

function safeJson(key, fallback = {}) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value && typeof value === 'object' ? value : fallback;
  } catch {
    return fallback;
  }
}

function utcDayKey(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

function utcWeekKey(now = Date.now()) {
  const date = new Date(now);
  const day = (date.getUTCDay() + 6) % 7;
  const monday = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day);
  return new Date(monday).toISOString().slice(0, 10);
}

function seasonInfo(now = Date.now()) {
  const cycle = Math.max(0, Math.floor((now - SEASON_EPOCH) / SEASON_MS));
  const start = SEASON_EPOCH + cycle * SEASON_MS;
  const end = start + SEASON_MS;
  const id = `S${String(cycle + 1).padStart(2, '0')}`;
  return {
    id,
    cycle,
    name: SEASON_NAMES[cycle % SEASON_NAMES.length],
    start,
    end,
    remaining: Math.max(0, end - now),
  };
}

function defaultProfile() {
  return {
    seasonXp: 0,
    marks: 0,
    claimed: {},
    baselines: {},
    cosmetic: { frame: 'STANDARD', title: 'PILOT' },
    unlocked: ['COMMAND MARK I'],
    lastSeason: seasonInfo().id,
  };
}

function loadProfile() {
  const raw = safeJson(PROFILE_KEY, {});
  const profile = {
    ...defaultProfile(),
    ...raw,
    claimed: raw.claimed && typeof raw.claimed === 'object' ? raw.claimed : {},
    baselines: raw.baselines && typeof raw.baselines === 'object' ? raw.baselines : {},
    cosmetic: raw.cosmetic && typeof raw.cosmetic === 'object' ? raw.cosmetic : { frame: 'STANDARD', title: 'PILOT' },
    unlocked: Array.isArray(raw.unlocked) && raw.unlocked.length ? raw.unlocked : ['COMMAND MARK I'],
  };
  const season = seasonInfo();
  if (profile.lastSeason !== season.id) {
    profile.seasonXp = 0;
    profile.claimed = {};
    profile.baselines = {};
    profile.lastSeason = season.id;
  }
  return profile;
}

function saveProfile() {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(state.profile)); } catch {}
}

function hashSeed(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededPick(pool, count, seedText) {
  const copy = [...pool];
  let seed = hashSeed(seedText);
  const out = [];
  while (copy.length && out.length < count) {
    seed = Math.imul(seed ^ (seed >>> 13), 1597334677) >>> 0;
    const index = seed % copy.length;
    const base = copy.splice(index, 1)[0];
    seed = Math.imul(seed ^ (seed >>> 11), 2246822519) >>> 0;
    const target = base.targets[seed % base.targets.length];
    out.push({ ...base, target });
  }
  return out;
}

function readMetrics() {
  const g = game();
  const raid = safeJson(RAID_KEY, {});
  const raidHistory = Array.isArray(raid.history) ? raid.history : [];
  const squadHistory = safeJson(HISTORY_KEY, []);
  return {
    kills: Math.max(0, Number(g?.profile?.totalKills) || 0),
    elites: Math.max(0, Number(g?.profile?.eliteKills) || 0),
    missiles: Math.max(0, Number(g?.profile?.missilesFired) || 0),
    objectives: Math.max(0, Number(g?.profile?.sideObjectivesCompleted) || 0),
    raids: Math.max(0, Number(raid.raids) || 0),
    evades: raidHistory.reduce((sum, item) => sum + Math.max(0, Number(item?.perfectEvades) || 0), 0),
    bestSector: Math.max(1, Number(g?.profile?.bestSector ?? g?.sector) || 1),
    squadRuns: Array.isArray(squadHistory) ? squadHistory.length : 0,
  };
}

function ensureBaseline(periodKey, metrics) {
  if (!state.profile.baselines[periodKey]) state.profile.baselines[periodKey] = { ...metrics };
  return state.profile.baselines[periodKey];
}

function buildContracts() {
  const season = seasonInfo();
  const day = utcDayKey();
  const week = utcWeekKey();
  state.daily = seededPick(DAILY_POOL, 3, `${season.id}|daily|${day}`)
    .map((item, index) => ({ ...item, id: `daily:${day}:${index}`, periodKey: `d:${day}`, kind: 'DAILY' }));
  state.weekly = seededPick(WEEKLY_POOL, 3, `${season.id}|weekly|${week}`)
    .map((item, index) => ({ ...item, id: `weekly:${week}:${index}`, periodKey: `w:${week}`, kind: 'WEEKLY' }));
}

function contractProgress(contract, metrics) {
  const baseline = ensureBaseline(contract.periodKey, metrics);
  const current = Math.max(0, Number(metrics[contract.metric]) || 0);
  const start = Math.max(0, Number(baseline[contract.metric]) || 0);
  return clamp(current - start, 0, contract.target);
}

function contractStatus(contract, metrics) {
  const progress = contractProgress(contract, metrics);
  const claimed = Boolean(state.profile.claimed[contract.id]);
  return { progress, complete: progress >= contract.target, claimed };
}

function levelInfo() {
  const xp = Math.max(0, Number(state.profile.seasonXp) || 0);
  const level = clamp(Math.floor(xp / LEVEL_XP) + 1, 1, MAX_LEVEL);
  const into = level >= MAX_LEVEL ? LEVEL_XP : xp % LEVEL_XP;
  return { level, xp, into, percent: level >= MAX_LEVEL ? 100 : clamp(into / LEVEL_XP * 100, 0, 100) };
}

function unlockRewards(previousLevel, nextLevel) {
  for (let level = previousLevel + 1; level <= nextLevel; level += 1) {
    const reward = TRACK_REWARDS[level - 1];
    if (!reward || state.profile.unlocked.includes(reward)) continue;
    state.profile.unlocked.push(reward);
    if (/MARKS$/.test(reward)) {
      const amount = Number(reward.split(' ')[0]) || 0;
      state.profile.marks += amount;
    }
    if (/FRAME$/.test(reward)) state.profile.cosmetic.frame = reward.replace(' FRAME', '');
    if (/TITLE$/.test(reward)) state.profile.cosmetic.title = reward.replace(' TITLE', '');
  }
}

function claimContract(id) {
  const all = [...state.daily, ...state.weekly];
  const contract = all.find((item) => item.id === id);
  if (!contract || state.profile.claimed[id]) return;
  const metrics = readMetrics();
  const status = contractStatus(contract, metrics);
  if (!status.complete) return;
  const before = levelInfo().level;
  state.profile.claimed[id] = Date.now();
  state.profile.seasonXp += contract.xp;
  state.profile.marks += contract.kind === 'WEEKLY' ? 45 : 15;
  const after = levelInfo().level;
  unlockRewards(before, after);
  saveProfile();
  render(true);
  showToast(`RECOMPENSA RECLAMADA · +${contract.xp} XP · +${contract.kind === 'WEEKLY' ? 45 : 15} MARKS`);
}

function formatRemaining(ms) {
  const totalHours = Math.max(0, Math.ceil(ms / 3600000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return `${days}D ${hours}H`;
}

function ensureDeck() {
  let deck = $('#v20-command-deck');
  if (deck) return deck;
  deck = document.createElement('section');
  deck.id = 'v20-command-deck';
  deck.className = 'v20-command-deck hidden';
  deck.setAttribute('aria-hidden', 'true');
  deck.innerHTML = `
    <div class="v20-deck-backdrop" data-v20-close></div>
    <div class="v20-deck-shell" role="dialog" aria-modal="true" aria-label="Command Deck">
      <header class="v20-deck-head">
        <div class="v20-season-emblem"><i></i><b>20</b></div>
        <div class="v20-deck-title"><span>WAE LIVE OPERATIONS</span><strong data-v20-season-name>SEASON</strong><small data-v20-season-time>—</small></div>
        <button type="button" data-v20-close aria-label="Cerrar">×</button>
      </header>
      <div class="v20-deck-grid">
        <section class="v20-command-card v20-progress-card">
          <div class="v20-card-kicker">SEASON COMMAND</div>
          <div class="v20-level-wrap">
            <div class="v20-level-orbit"><div><small>LEVEL</small><strong data-v20-level>1</strong></div></div>
            <div class="v20-level-copy"><span data-v20-title>PILOT</span><strong data-v20-xp>0 / 500 XP</strong><i><b data-v20-level-fill></b></i><small><b data-v20-marks>0</b> COMMAND MARKS</small></div>
          </div>
          <div class="v20-cosmetic-row"><span>FRAME <b data-v20-frame>STANDARD</b></span><span>UNLOCKS <b data-v20-unlocks>0</b></span></div>
        </section>
        <section class="v20-command-card v20-contracts-card">
          <div class="v20-card-head"><div><span>DAILY DIRECTIVES</span><strong>HOY</strong></div><small data-v20-day-reset>UTC</small></div>
          <div class="v20-contract-list" data-v20-daily></div>
        </section>
        <section class="v20-command-card v20-contracts-card">
          <div class="v20-card-head"><div><span>WEEKLY OPERATIONS</span><strong>ESTA SEMANA</strong></div><small data-v20-week-reset>UTC</small></div>
          <div class="v20-contract-list" data-v20-weekly></div>
        </section>
        <section class="v20-command-card v20-track-card">
          <div class="v20-card-head"><div><span>FREE PROGRESSION TRACK</span><strong>30 NIVELES</strong></div><small>GAMEPLAY ONLY</small></div>
          <div class="v20-track" data-v20-track></div>
        </section>
        <section class="v20-command-card v20-intel-card">
          <div class="v20-card-head"><div><span>PLAYER INTEL</span><strong>LIVE METRICS</strong></div><small>LOCAL PROFILE</small></div>
          <div class="v20-intel-grid" data-v20-intel></div>
        </section>
      </div>
      <footer class="v20-deck-foot"><span>WAE NEON RIDER · COMMAND DECK</span><small>PROGRESIÓN LOCAL · SIN VENTAJA DE PAGO · COMMERCE AISLADO</small></footer>
    </div>`;
  document.body.append(deck);
  deck.addEventListener('click', (event) => {
    if (event.target.closest('[data-v20-close]')) closeCommandDeck();
    const claim = event.target.closest('[data-v20-claim]');
    if (claim) claimContract(claim.dataset.v20Claim);
  });
  return deck;
}

function renderContracts(root, contracts, metrics) {
  root.replaceChildren(...contracts.map((contract) => {
    const status = contractStatus(contract, metrics);
    const item = document.createElement('article');
    item.className = `v20-contract ${status.complete ? 'complete' : ''} ${status.claimed ? 'claimed' : ''}`;
    const percent = clamp(status.progress / contract.target * 100, 0, 100);
    item.innerHTML = `
      <div class="v20-contract-top"><div><span>${contract.label}</span><strong>${contract.description.replace('{target}', String(contract.target))}</strong></div><b>+${contract.xp} XP</b></div>
      <div class="v20-contract-progress"><i><b style="width:${percent}%"></b></i><span>${Math.floor(status.progress)} / ${contract.target}</span></div>
      <button type="button" data-v20-claim="${contract.id}" ${status.complete && !status.claimed ? '' : 'disabled'}>${status.claimed ? 'CLAIMED' : status.complete ? 'CLAIM REWARD' : 'IN PROGRESS'}</button>`;
    return item;
  }));
}

function renderTrack(root, level) {
  const start = clamp(level - 3, 1, MAX_LEVEL - 7);
  const levels = Array.from({ length: 8 }, (_, index) => start + index);
  root.replaceChildren(...levels.map((value) => {
    const reward = TRACK_REWARDS[value - 1] || 'COMMAND CACHE';
    const node = document.createElement('article');
    node.className = value < level ? 'unlocked' : value === level ? 'current' : '';
    node.innerHTML = `<span>LV ${String(value).padStart(2, '0')}</span><i>◇</i><strong>${reward}</strong><small>${value <= level ? 'UNLOCKED' : `${value * LEVEL_XP - state.profile.seasonXp} XP`}</small>`;
    return node;
  }));
}

function render(force = false) {
  if (!state.profile) state.profile = loadProfile();
  const deck = ensureDeck();
  const metrics = readMetrics();
  state.metrics = metrics;
  const season = seasonInfo();
  const info = levelInfo();
  const renderKey = JSON.stringify([season.id, info.level, state.profile.seasonXp, state.profile.marks, state.profile.unlocked.length, metrics, Object.keys(state.profile.claimed).length]);
  if (!force && !state.open && renderKey === state.lastRenderKey) return;
  state.lastRenderKey = renderKey;

  $('[data-v20-season-name]', deck).textContent = `${season.id} · ${season.name}`;
  $('[data-v20-season-time]', deck).textContent = `ENDS IN ${formatRemaining(season.remaining)}`;
  $('[data-v20-level]', deck).textContent = String(info.level);
  $('[data-v20-title]', deck).textContent = state.profile.cosmetic.title || 'PILOT';
  $('[data-v20-xp]', deck).textContent = `${info.into} / ${LEVEL_XP} XP`;
  $('[data-v20-level-fill]', deck).style.width = `${info.percent}%`;
  $('[data-v20-marks]', deck).textContent = Number(state.profile.marks || 0).toLocaleString('es-MX');
  $('[data-v20-frame]', deck).textContent = state.profile.cosmetic.frame || 'STANDARD';
  $('[data-v20-unlocks]', deck).textContent = String(state.profile.unlocked.length);
  $('[data-v20-day-reset]', deck).textContent = `RESET ${utcDayKey()}`;
  $('[data-v20-week-reset]', deck).textContent = `WEEK ${utcWeekKey()}`;
  renderContracts($('[data-v20-daily]', deck), state.daily, metrics);
  renderContracts($('[data-v20-weekly]', deck), state.weekly, metrics);
  renderTrack($('[data-v20-track]', deck), info.level);

  const intel = $('[data-v20-intel]', deck);
  const values = [
    ['KILLS', metrics.kills], ['ELITES', metrics.elites], ['RAIDS', metrics.raids],
    ['PERFECT EVADES', metrics.evades], ['BEST SECTOR', metrics.bestSector], ['SQUAD RUNS', metrics.squadRuns],
  ];
  intel.replaceChildren(...values.map(([label, value]) => {
    const node = document.createElement('div');
    node.innerHTML = `<span>${label}</span><strong>${Number(value || 0).toLocaleString('es-MX')}</strong>`;
    return node;
  }));
  saveProfile();
}

function showToast(text) {
  let toast = $('#v20-liveops-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'v20-liveops-toast';
    toast.className = 'v20-liveops-toast';
    document.body.append(toast);
  }
  toast.textContent = text;
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 3200);
}

export function openCommandDeck() {
  state.open = true;
  const deck = ensureDeck();
  deck.classList.remove('hidden');
  deck.setAttribute('aria-hidden', 'false');
  document.body.classList.add('v20-deck-open');
  render(true);
}

export function closeCommandDeck() {
  state.open = false;
  const deck = ensureDeck();
  deck.classList.add('hidden');
  deck.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('v20-deck-open');
}

function tick() {
  const currentSeason = seasonInfo().id;
  if (!state.profile || state.profile.lastSeason !== currentSeason) {
    state.profile = loadProfile();
    buildContracts();
  }
  render(false);
}

state.profile = loadProfile();
buildContracts();
ensureDeck();
window.clearInterval(state.tickTimer);
state.tickTimer = window.setInterval(tick, TICK_MS);
window.addEventListener('storage', (event) => {
  if ([PROFILE_KEY, RAID_KEY, HISTORY_KEY].includes(event.key)) {
    state.profile = loadProfile();
    render(true);
  }
});
