const $ = (selector, root = document) => root.querySelector(selector);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const VAULT_KEY = 'wae_neon_rider_v21_achievement_vault';
const LIVEOPS_KEY = 'wae_neon_rider_v20_liveops_profile';
const RAID_KEY = 'wae_neon_rider_v19_raid_profile';
const SQUAD_HISTORY_KEY = 'wae_neon_rider_v18_runs';
const LEVEL_XP = 500;

const RARITY_ORDER = Object.freeze({ core: 0, rare: 1, epic: 2, mythic: 3 });

const ACHIEVEMENTS = Object.freeze([
  { id: 'first-vector', rarity: 'core', icon: '✦', title: 'FIRST VECTOR', description: 'Supera el primer sector de combate.', metric: 'bestSector', target: 2 },
  { id: 'neon-hunter', rarity: 'core', icon: '★', title: 'NEON HUNTER', description: 'Destruye 50 enemigos.', metric: 'kills', target: 50 },
  { id: 'elite-breaker', rarity: 'rare', icon: '◆', title: 'ELITE BREAKER', description: 'Destruye 10 enemigos élite.', metric: 'elites', target: 10 },
  { id: 'arsenal-doctrine', rarity: 'rare', icon: '⌁', title: 'ARSENAL DOCTRINE', description: 'Dispara 25 misiles WAE.', metric: 'missiles', target: 25 },
  { id: 'mission-control', rarity: 'rare', icon: '◇', title: 'MISSION CONTROL', description: 'Completa 5 objetivos secundarios.', metric: 'objectives', target: 5 },
  { id: 'deep-sector', rarity: 'epic', icon: '✧', title: 'DEEP SECTOR', description: 'Alcanza el sector 10.', metric: 'bestSector', target: 10 },
  { id: 'guardian-breaker', rarity: 'epic', icon: '♜', title: 'GUARDIAN BREAKER', description: 'Completa tu primer raid de Guardián.', metric: 'raids', target: 1 },
  { id: 'perfect-vector', rarity: 'epic', icon: '✶', title: 'PERFECT VECTOR', description: 'Consigue 5 Perfect Evades.', metric: 'evades', target: 5 },
  { id: 'squadron-born', rarity: 'epic', icon: '⋈', title: 'SQUADRON BORN', description: 'Completa una operación de escuadrón.', metric: 'squadRuns', target: 1 },
  { id: 'command-elite', rarity: 'mythic', icon: '♛', title: 'COMMAND ELITE', description: 'Alcanza nivel 10 de temporada.', metric: 'seasonLevel', target: 10 },
  { id: 'gold-reserve', rarity: 'mythic', icon: '⬢', title: 'GOLD RESERVE', description: 'Acumula 500 Marks.', metric: 'marks', target: 500 },
  { id: 'sovereign-signal', rarity: 'mythic', icon: '✺', title: 'SOVEREIGN SIGNAL', description: 'Clasificación restringida.', secret: true, metric: 'sovereignSignal', target: 1 },
]);

const state = {
  open: false,
  profile: null,
  lastMetricKey: '',
  lastRenderKey: '',
  pendingUnlocks: [],
  ceremonyActive: false,
};

function game() { return window.__waeNeonRiderGame; }

function safeJson(key, fallback = {}) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value && typeof value === 'object' ? value : fallback;
  } catch {
    return fallback;
  }
}

function defaultProfile() {
  return { unlocked: {}, featured: '', seen: {} };
}

function loadProfile() {
  const raw = safeJson(VAULT_KEY, {});
  return {
    ...defaultProfile(),
    ...raw,
    unlocked: raw.unlocked && typeof raw.unlocked === 'object' ? raw.unlocked : {},
    seen: raw.seen && typeof raw.seen === 'object' ? raw.seen : {},
  };
}

function saveProfile() {
  try { localStorage.setItem(VAULT_KEY, JSON.stringify(state.profile)); } catch {}
}

function readMetrics() {
  const g = game();
  const live = safeJson(LIVEOPS_KEY, {});
  const raid = safeJson(RAID_KEY, {});
  const squadHistory = safeJson(SQUAD_HISTORY_KEY, []);
  const raidHistory = Array.isArray(raid.history) ? raid.history : [];
  const seasonXp = Math.max(0, Number(live.seasonXp) || 0);
  const seasonLevel = clamp(Math.floor(seasonXp / LEVEL_XP) + 1, 1, 30);
  const raids = Math.max(0, Number(raid.raids) || raidHistory.length || 0);
  const evades = raidHistory.reduce((sum, item) => sum + Math.max(0, Number(item?.perfectEvades) || 0), 0);
  const bestSector = Math.max(1, Number(g?.profile?.bestSector ?? g?.sector) || 1);
  const kills = Math.max(0, Number(g?.profile?.totalKills) || 0);
  const elites = Math.max(0, Number(g?.profile?.eliteKills) || 0);
  const missiles = Math.max(0, Number(g?.profile?.missilesFired) || 0);
  const objectives = Math.max(0, Number(g?.profile?.sideObjectivesCompleted) || 0);
  const marks = Math.max(0, Number(live.marks) || 0);
  const squadRuns = Array.isArray(squadHistory) ? squadHistory.length : 0;
  const sovereignSignal = seasonLevel >= 20 && raids >= 5 && evades >= 12 ? 1 : 0;
  return { bestSector, kills, elites, missiles, objectives, raids, evades, squadRuns, seasonLevel, marks, sovereignSignal };
}

function achievementProgress(item, metrics) {
  return clamp(Number(metrics[item.metric]) || 0, 0, item.target);
}

function achievementUnlocked(item) {
  return Boolean(state.profile?.unlocked?.[item.id]);
}

function evaluate(metrics = readMetrics()) {
  let changed = false;
  for (const item of ACHIEVEMENTS) {
    if (achievementUnlocked(item)) continue;
    if ((Number(metrics[item.metric]) || 0) < item.target) continue;
    const unlockedAt = Date.now();
    state.profile.unlocked[item.id] = unlockedAt;
    if (!state.profile.featured) state.profile.featured = item.id;
    state.pendingUnlocks.push(item.id);
    changed = true;
  }
  if (changed) {
    saveProfile();
    document.dispatchEvent(new CustomEvent('wae:achievement-unlocked', { detail: { ids: [...state.pendingUnlocks] } }));
  }
  return changed;
}

function rarityLabel(rarity) {
  if (rarity === 'mythic') return 'MYTHIC';
  if (rarity === 'epic') return 'EPIC';
  if (rarity === 'rare') return 'RARE';
  return 'CORE';
}

function unlockedCount() {
  return ACHIEVEMENTS.reduce((sum, item) => sum + (achievementUnlocked(item) ? 1 : 0), 0);
}

function ensureLaunchers() {
  const startMeta = $('#start-screen .start-meta');
  if (startMeta && !startMeta.querySelector('[data-v2113-vault-open]')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.v2113VaultOpen = 'true';
    button.className = 'v2113-vault-launch';
    button.innerHTML = `<span>★</span><b>LOGROS</b><small data-v2113-launch-count>${unlockedCount()}/${ACHIEVEMENTS.length}</small>`;
    startMeta.append(button);
  }

  const pausePanel = $('#pause-screen .panel');
  if (pausePanel && !pausePanel.querySelector('[data-v2113-vault-open]')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.v2113VaultOpen = 'true';
    button.className = 'v2113-vault-pause';
    button.textContent = '★  LOGROS DEL PILOTO';
    pausePanel.append(button);
  }

  for (const node of document.querySelectorAll('[data-v2113-launch-count]')) node.textContent = `${unlockedCount()}/${ACHIEVEMENTS.length}`;
}

function ensureVault() {
  let vault = $('#v2113-achievement-vault');
  if (vault) return vault;
  vault = document.createElement('section');
  vault.id = 'v2113-achievement-vault';
  vault.className = 'v2113-vault hidden';
  vault.setAttribute('role', 'dialog');
  vault.setAttribute('aria-modal', 'true');
  vault.setAttribute('aria-label', 'Vitrina de logros del piloto');
  vault.innerHTML = `
    <div class="v2113-vault-backdrop" data-v2113-vault-close></div>
    <div class="v2113-vault-shell">
      <header class="v2113-vault-head">
        <div class="v2113-vault-emblem"><i>★</i><b data-v2113-vault-total>0</b></div>
        <div><span>WAE PILOT ARCHIVE · V21.13</span><h2>ACHIEVEMENT VAULT</h2><p>Medallas, trofeos e insignias obtenidas en combate.</p></div>
        <button type="button" data-v2113-vault-close aria-label="Cerrar">×</button>
      </header>
      <section class="v2113-vault-summary" data-v2113-vault-summary></section>
      <div class="v2113-vault-grid" data-v2113-vault-grid></div>
      <footer><span>Los logros se verifican con la telemetría local del piloto.</span><b>WAE NEON RIDER</b></footer>
    </div>`;
  document.body.append(vault);
  return vault;
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  try { return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(timestamp)).toUpperCase(); }
  catch { return ''; }
}

function renderVault(metrics = readMetrics()) {
  const vault = ensureVault();
  const count = unlockedCount();
  const total = ACHIEVEMENTS.length;
  const percent = Math.round(count / total * 100);
  const byRarity = { core: 0, rare: 0, epic: 0, mythic: 0 };
  for (const item of ACHIEVEMENTS) if (achievementUnlocked(item)) byRarity[item.rarity] += 1;

  $('[data-v2113-vault-total]', vault).textContent = `${count}/${total}`;
  $('[data-v2113-vault-summary]', vault).innerHTML = `
    <article><span>COMPLETADO</span><strong>${percent}%</strong><i><b style="width:${percent}%"></b></i></article>
    <article><span>CORE</span><strong>${byRarity.core}</strong><small>Insignias base</small></article>
    <article><span>RARE / EPIC</span><strong>${byRarity.rare + byRarity.epic}</strong><small>Distinciones avanzadas</small></article>
    <article><span>MYTHIC</span><strong>${byRarity.mythic}</strong><small>Prestigio máximo</small></article>`;

  const sorted = [...ACHIEVEMENTS].sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity]);
  $('[data-v2113-vault-grid]', vault).innerHTML = sorted.map((item) => {
    const unlocked = achievementUnlocked(item);
    const progress = achievementProgress(item, metrics);
    const pct = Math.round(progress / item.target * 100);
    const secretLocked = item.secret && !unlocked;
    const unlockedAt = state.profile.unlocked[item.id];
    const title = secretLocked ? 'CLASSIFIED' : item.title;
    const description = secretLocked ? 'Condición de desbloqueo oculta.' : item.description;
    return `
      <article class="v2113-achievement ${unlocked ? 'is-unlocked' : 'is-locked'} rarity-${item.rarity}" data-achievement-id="${item.id}">
        <div class="v2113-achievement-icon"><i>${secretLocked ? '?' : item.icon}</i><span>${rarityLabel(item.rarity)}</span></div>
        <div class="v2113-achievement-copy"><span>${unlocked ? 'DESBLOQUEADO' : secretLocked ? 'SECRETO' : 'EN PROGRESO'}</span><strong>${title}</strong><p>${description}</p></div>
        <div class="v2113-achievement-progress"><i><b style="width:${unlocked ? 100 : pct}%"></b></i><small>${unlocked ? formatDate(unlockedAt) : secretLocked ? '—' : `${progress}/${item.target}`}</small></div>
        ${unlocked ? `<button type="button" data-v2113-feature="${item.id}" class="${state.profile.featured === item.id ? 'active' : ''}">${state.profile.featured === item.id ? '★ DESTACADO' : 'DESTACAR'}</button>` : ''}
      </article>`;
  }).join('');
}

function featuredAchievement() {
  return ACHIEVEMENTS.find((item) => item.id === state.profile.featured && achievementUnlocked(item)) || ACHIEVEMENTS.find(achievementUnlocked) || null;
}

function renderFeaturedBadge() {
  const strip = $('.v2112-prestige-strip');
  if (!strip) return;
  let badge = $('.v2113-featured-badge', strip);
  if (!badge) {
    badge = document.createElement('button');
    badge.type = 'button';
    badge.dataset.v2113VaultOpen = 'true';
    badge.className = 'v2113-featured-badge';
    strip.append(badge);
  }
  const item = featuredAchievement();
  badge.innerHTML = item
    ? `<i>${item.icon}</i><span>INSIGNIA DESTACADA</span><strong>${item.title}</strong>`
    : '<i>☆</i><span>ACHIEVEMENT VAULT</span><strong>PRIMER LOGRO PENDIENTE</strong>';
}

function ensureCeremony() {
  let ceremony = $('#v2113-achievement-ceremony');
  if (ceremony) return ceremony;
  ceremony = document.createElement('div');
  ceremony.id = 'v2113-achievement-ceremony';
  ceremony.className = 'v2113-ceremony';
  ceremony.setAttribute('role', 'status');
  ceremony.setAttribute('aria-live', 'polite');
  document.body.append(ceremony);
  return ceremony;
}

function playNextCeremony() {
  if (state.ceremonyActive || !state.pendingUnlocks.length) return;
  const id = state.pendingUnlocks.shift();
  const item = ACHIEVEMENTS.find((entry) => entry.id === id);
  if (!item) return playNextCeremony();
  state.ceremonyActive = true;
  const ceremony = ensureCeremony();
  ceremony.className = `v2113-ceremony rarity-${item.rarity} show`;
  ceremony.innerHTML = `
    <div class="v2113-ceremony-rays"></div>
    <div class="v2113-ceremony-medal"><i>${item.icon}</i><span>${rarityLabel(item.rarity)}</span></div>
    <div class="v2113-ceremony-copy"><span>LOGRO DESBLOQUEADO</span><strong>${item.title}</strong><small>${item.description}</small></div>
    <div class="v2113-ceremony-stars">★ ✦ ★</div>`;
  if (!document.body.classList.contains('v21-reduced-fx')) {
    try { navigator.vibrate?.([12, 38, 18]); } catch {}
  }
  setTimeout(() => ceremony.classList.remove('show'), 2500);
  setTimeout(() => {
    state.ceremonyActive = false;
    playNextCeremony();
  }, 2900);
}

function openVault() {
  const g = game();
  if (g?.state === 'playing') g.pause?.();
  evaluate();
  renderVault();
  ensureVault().classList.remove('hidden');
  document.body.classList.add('v2113-vault-open');
  state.open = true;
}

function closeVault() {
  ensureVault().classList.add('hidden');
  document.body.classList.remove('v2113-vault-open');
  state.open = false;
}

function sync() {
  if (!state.profile) state.profile = loadProfile();
  const metrics = readMetrics();
  const metricKey = Object.values(metrics).join('|');
  const changed = metricKey !== state.lastMetricKey ? evaluate(metrics) : false;
  state.lastMetricKey = metricKey;
  const renderKey = `${metricKey}|${Object.keys(state.profile.unlocked).length}|${state.profile.featured}`;
  if (changed || renderKey !== state.lastRenderKey) {
    state.lastRenderKey = renderKey;
    if (state.open) renderVault(metrics);
    ensureLaunchers();
    renderFeaturedBadge();
  }
  playNextCeremony();
}

function installEvents() {
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-v2113-vault-open]')) {
      event.preventDefault();
      openVault();
      return;
    }
    if (event.target.closest('[data-v2113-vault-close]')) {
      event.preventDefault();
      closeVault();
      return;
    }
    const feature = event.target.closest('[data-v2113-feature]');
    if (feature) {
      event.preventDefault();
      const id = feature.dataset.v2113Feature;
      if (!state.profile.unlocked[id]) return;
      state.profile.featured = id;
      saveProfile();
      renderVault();
      renderFeaturedBadge();
      return;
    }
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.open) {
      event.stopImmediatePropagation();
      closeVault();
    }
  }, true);
}

state.profile = loadProfile();
ensureVault();
ensureCeremony();
ensureLaunchers();
installEvents();
sync();

window.setInterval(sync, 900);
window.addEventListener('pageshow', sync);
window.addEventListener('storage', sync);
document.addEventListener('wae:settings-changed', sync);
document.addEventListener('wae:v21-identity-changed', sync);

window.__waeAchievementVault = Object.freeze({
  open: openVault,
  close: closeVault,
  getMetrics: readMetrics,
  getUnlocked: () => ({ ...state.profile.unlocked }),
});
