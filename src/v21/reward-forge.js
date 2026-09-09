import * as THREE from 'three';

const $ = (selector, root = document) => root.querySelector(selector);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const REWARD_KEY = 'wae_neon_rider_v21_reward_forge';
const VAULT_KEY = 'wae_neon_rider_v21_achievement_vault';

const CATEGORIES = Object.freeze([
  { id: 'thruster', label: 'PROPULSOR' },
  { id: 'trail', label: 'TRAIL' },
  { id: 'frame', label: 'FRAME' },
  { id: 'title', label: 'TÍTULO' },
  { id: 'badge', label: 'INSIGNIA' },
]);

const REWARDS = Object.freeze([
  { id: 'thruster-standard', category: 'thruster', name: 'ORANGE CORE', rarity: 'core', icon: '◉', default: true, color: 0xfb923c, description: 'Firma térmica estándar WAE.' },
  { id: 'thruster-ion', category: 'thruster', name: 'ION CYAN', rarity: 'rare', icon: '✦', requires: 'first-vector', color: 0x22d3ee, description: 'Propulsión cian de alta energía.' },
  { id: 'thruster-violet', category: 'thruster', name: 'VOID VIOLET', rarity: 'epic', icon: '◆', requires: 'deep-sector', color: 0xa855f7, description: 'Firma violeta de incursión profunda.' },
  { id: 'thruster-gold', category: 'thruster', name: 'SOLAR GOLD', rarity: 'mythic', icon: '✺', requires: 'gold-reserve', color: 0xfbbf24, description: 'Propulsor dorado de reserva élite.' },

  { id: 'trail-none', category: 'trail', name: 'SIN TRAIL', rarity: 'core', icon: '·', default: true, color: 0x22d3ee, description: 'Configuración limpia de fábrica.' },
  { id: 'trail-neon', category: 'trail', name: 'NEON STREAM', rarity: 'rare', icon: '≈', requires: 'neon-hunter', color: 0x67e8f9, description: 'Estela cian persistente de combate.' },
  { id: 'trail-prism', category: 'trail', name: 'PRISM VECTOR', rarity: 'epic', icon: '✶', requires: 'perfect-vector', color: 0xc084fc, description: 'Estela prismática para maniobras perfectas.' },
  { id: 'trail-sovereign', category: 'trail', name: 'SOVEREIGN COMET', rarity: 'mythic', icon: '♛', requires: 'sovereign-signal', color: 0xfbbf24, description: 'Estela clasificada de máximo prestigio.' },

  { id: 'frame-standard', category: 'frame', name: 'STANDARD FRAME', rarity: 'core', icon: '□', default: true, description: 'Marco de identidad estándar.' },
  { id: 'frame-cobalt', category: 'frame', name: 'COBALT GUARD', rarity: 'rare', icon: '◇', requires: 'elite-breaker', description: 'Marco de cazador élite.' },
  { id: 'frame-imperium', category: 'frame', name: 'IMPERIUM FRAME', rarity: 'mythic', icon: '⬢', requires: 'command-elite', description: 'Marco de comando de temporada.' },
  { id: 'frame-sovereign', category: 'frame', name: 'SOVEREIGN FRAME', rarity: 'mythic', icon: '♛', requires: 'sovereign-signal', description: 'Marco reservado al Sovereign Signal.' },

  { id: 'title-pilot', category: 'title', name: 'PILOT', rarity: 'core', icon: '—', default: true, description: 'Identidad operativa estándar.' },
  { id: 'title-arsenal', category: 'title', name: 'ARSENAL SPECIALIST', rarity: 'rare', icon: '⌁', requires: 'arsenal-doctrine', description: 'Especialista certificado en armamento.' },
  { id: 'title-guardian', category: 'title', name: 'GUARDIAN BREAKER', rarity: 'epic', icon: '♜', requires: 'guardian-breaker', description: 'Título de asalto contra Guardianes.' },
  { id: 'title-sovereign', category: 'title', name: 'SOVEREIGN', rarity: 'mythic', icon: '♛', requires: 'sovereign-signal', description: 'Título máximo del archivo WAE.' },

  { id: 'badge-none', category: 'badge', name: 'SIN INSIGNIA', rarity: 'core', icon: '·', default: true, description: 'Perfil sin marca adicional.' },
  { id: 'badge-command', category: 'badge', name: 'COMMAND MARK', rarity: 'rare', icon: '◇', requires: 'mission-control', description: 'Insignia de control de misión.' },
  { id: 'badge-wing', category: 'badge', name: 'WINGMARK', rarity: 'epic', icon: '⋈', requires: 'squadron-born', description: 'Distintivo de operación cooperativa.' },
  { id: 'badge-crown', category: 'badge', name: 'CROWN SIGNAL', rarity: 'mythic', icon: '♛', requires: 'sovereign-signal', description: 'Insignia clasificada de prestigio máximo.' },
]);

const DEFAULT_EQUIPPED = Object.freeze({
  thruster: 'thruster-standard',
  trail: 'trail-none',
  frame: 'frame-standard',
  title: 'title-pilot',
  badge: 'badge-none',
});

const state = {
  open: false,
  tab: 'thruster',
  profile: null,
  trailObject: null,
  trailPositions: [],
  trailFrame: 0,
  lastShip: null,
  lastSyncKey: '',
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

function unlockedAchievements() {
  const vault = safeJson(VAULT_KEY, {});
  return vault.unlocked && typeof vault.unlocked === 'object' ? vault.unlocked : {};
}

function isUnlocked(reward) {
  if (reward.default) return true;
  return Boolean(unlockedAchievements()[reward.requires]);
}

function defaultProfile() {
  return { equipped: { ...DEFAULT_EQUIPPED }, seenUnlocks: {} };
}

function normalizeProfile(raw = {}) {
  const next = defaultProfile();
  const equipped = raw.equipped && typeof raw.equipped === 'object' ? raw.equipped : {};
  for (const category of CATEGORIES) {
    const candidate = REWARDS.find((reward) => reward.id === equipped[category.id] && reward.category === category.id);
    if (candidate && isUnlocked(candidate)) next.equipped[category.id] = candidate.id;
  }
  next.seenUnlocks = raw.seenUnlocks && typeof raw.seenUnlocks === 'object' ? raw.seenUnlocks : {};
  return next;
}

function loadProfile() { return normalizeProfile(safeJson(REWARD_KEY, {})); }
function saveProfile() {
  try { localStorage.setItem(REWARD_KEY, JSON.stringify(state.profile)); } catch {}
  document.dispatchEvent(new CustomEvent('wae:rewards-changed', { detail: identityPayload() }));
}

function rewardById(id) { return REWARDS.find((reward) => reward.id === id) || null; }
function equippedReward(category) { return rewardById(state.profile?.equipped?.[category]) || rewardById(DEFAULT_EQUIPPED[category]); }

function identityPayload() {
  const frame = equippedReward('frame');
  const title = equippedReward('title');
  const badge = equippedReward('badge');
  return {
    frame: frame?.name || 'STANDARD FRAME',
    title: title?.name || 'PILOT',
    badge: badge?.name || 'SIN INSIGNIA',
    badgeIcon: badge?.icon || '',
  };
}

function unlockedCount() { return REWARDS.reduce((sum, reward) => sum + (isUnlocked(reward) ? 1 : 0), 0); }

function ensureLauncher() {
  const startMeta = $('#start-screen .start-meta');
  if (startMeta && !startMeta.querySelector('[data-v2114-forge-open]')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.v2114ForgeOpen = 'true';
    button.className = 'v2114-forge-launch';
    button.innerHTML = `<span>✦</span><b>RECOMPENSAS</b><small data-v2114-count></small>`;
    startMeta.append(button);
  }
  const pausePanel = $('#pause-screen .panel');
  if (pausePanel && !pausePanel.querySelector('[data-v2114-forge-open]')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.v2114ForgeOpen = 'true';
    button.className = 'v2114-forge-pause';
    button.textContent = '✦  REWARD FORGE';
    pausePanel.append(button);
  }
  for (const node of document.querySelectorAll('[data-v2114-count]')) node.textContent = `${unlockedCount()}/${REWARDS.length}`;
}

function ensureForge() {
  let forge = $('#v2114-reward-forge');
  if (forge) return forge;
  forge = document.createElement('section');
  forge.id = 'v2114-reward-forge';
  forge.className = 'v2114-forge hidden';
  forge.setAttribute('role', 'dialog');
  forge.setAttribute('aria-modal', 'true');
  forge.setAttribute('aria-label', 'Reward Forge');
  forge.innerHTML = `
    <div class="v2114-forge-backdrop" data-v2114-forge-close></div>
    <div class="v2114-forge-shell">
      <header class="v2114-forge-head">
        <div class="v2114-forge-emblem">✦</div>
        <div><span>WAE PILOT ARMORY · V21.14</span><h2>REWARD FORGE</h2><p>Equipa recompensas obtenidas jugando. Sin ventajas competitivas.</p></div>
        <button type="button" data-v2114-forge-close aria-label="Cerrar">×</button>
      </header>
      <section class="v2114-equipped" data-v2114-equipped></section>
      <nav class="v2114-tabs" data-v2114-tabs></nav>
      <div class="v2114-grid" data-v2114-grid></div>
      <footer><span>Cosméticos · 0 pay-to-win · progreso persistente</span><b>WAE NEON RIDER</b></footer>
    </div>`;
  document.body.append(forge);
  return forge;
}

function rarityLabel(rarity) {
  if (rarity === 'mythic') return 'MYTHIC';
  if (rarity === 'epic') return 'EPIC';
  if (rarity === 'rare') return 'RARE';
  return 'CORE';
}

function renderForge() {
  const forge = ensureForge();
  const identity = identityPayload();
  $('[data-v2114-equipped]', forge).innerHTML = `
    <article><span>FRAME</span><strong>${identity.frame}</strong></article>
    <article><span>TÍTULO</span><strong>${identity.title}</strong></article>
    <article><span>INSIGNIA</span><strong>${identity.badgeIcon} ${identity.badge}</strong></article>
    <article><span>COLECCIÓN</span><strong>${unlockedCount()}/${REWARDS.length}</strong></article>`;

  $('[data-v2114-tabs]', forge).innerHTML = CATEGORIES.map((category) =>
    `<button type="button" data-v2114-tab="${category.id}" class="${state.tab === category.id ? 'active' : ''}">${category.label}</button>`
  ).join('');

  const rewards = REWARDS.filter((reward) => reward.category === state.tab);
  $('[data-v2114-grid]', forge).innerHTML = rewards.map((reward) => {
    const unlocked = isUnlocked(reward);
    const equipped = state.profile.equipped[state.tab] === reward.id;
    return `<article class="v2114-reward rarity-${reward.rarity} ${unlocked ? 'is-unlocked' : 'is-locked'} ${equipped ? 'is-equipped' : ''}">
      <div class="v2114-reward-icon">${unlocked ? reward.icon : '◇'}</div>
      <div class="v2114-reward-copy"><span>${rarityLabel(reward.rarity)} · ${unlocked ? equipped ? 'EQUIPADO' : 'DISPONIBLE' : 'BLOQUEADO'}</span><strong>${reward.name}</strong><p>${unlocked ? reward.description : 'Desbloquea el logro requerido en Achievement Vault.'}</p></div>
      <button type="button" data-v2114-equip="${reward.id}" ${unlocked ? '' : 'disabled'}>${equipped ? '✓ EQUIPADO' : unlocked ? 'EQUIPAR' : 'BLOQUEADO'}</button>
    </article>`;
  }).join('');
}

function openForge() {
  const g = game();
  if (g?.state === 'playing') g.pause?.();
  renderForge();
  ensureForge().classList.remove('hidden');
  document.body.classList.add('v2114-forge-open');
  state.open = true;
}

function closeForge() {
  ensureForge().classList.add('hidden');
  document.body.classList.remove('v2114-forge-open');
  state.open = false;
}

function restoreThrusterColors() {
  const g = game();
  for (const flame of g?.thrusters || []) {
    const material = flame?.material;
    if (!material?.color) continue;
    if (flame.userData?.v2114OriginalColor !== undefined) material.color.setHex(flame.userData.v2114OriginalColor);
  }
}

function applyThruster() {
  const g = game();
  const reward = equippedReward('thruster');
  if (!g?.thrusters?.length || !reward) return;
  for (const flame of g.thrusters) {
    const material = flame?.material;
    if (!material?.color) continue;
    if (flame.userData.v2114OriginalColor === undefined) flame.userData.v2114OriginalColor = material.color.getHex();
    material.color.setHex(reward.color ?? flame.userData.v2114OriginalColor);
    if ('opacity' in material) material.opacity = reward.id === 'thruster-gold' ? 1 : 0.94;
  }
}

function disposeTrail() {
  if (!state.trailObject) return;
  const g = game();
  g?.scene?.remove(state.trailObject);
  state.trailObject.geometry?.dispose?.();
  state.trailObject.material?.dispose?.();
  state.trailObject = null;
  state.trailPositions = [];
}

function ensureTrail() {
  const g = game();
  const reward = equippedReward('trail');
  if (!g?.scene || !g?.ship || !reward || reward.id === 'trail-none') {
    disposeTrail();
    return null;
  }
  if (state.trailObject?.userData?.rewardId === reward.id && state.trailObject.parent === g.scene) return state.trailObject;
  disposeTrail();
  const count = 20;
  const positions = new Float32Array(count * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: reward.color || 0x67e8f9,
    size: reward.id === 'trail-sovereign' ? 0.34 : 0.25,
    transparent: true,
    opacity: reward.id === 'trail-sovereign' ? 0.82 : 0.62,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'WAE_REWARD_TRAIL';
  points.userData.rewardId = reward.id;
  points.frustumCulled = false;
  g.scene.add(points);
  state.trailObject = points;
  state.trailPositions = Array.from({ length: count }, () => new THREE.Vector3(g.ship.position.x, g.ship.position.y, g.ship.position.z + 3.4));
  return points;
}

function updateTrail() {
  const g = game();
  const trail = ensureTrail();
  if (!trail || !g?.ship || g.state !== 'playing') {
    if (trail) trail.visible = false;
    return;
  }
  trail.visible = true;
  state.trailFrame += 1;
  if (state.trailFrame % 2 === 0) {
    state.trailPositions.unshift(new THREE.Vector3(g.ship.position.x, g.ship.position.y, g.ship.position.z + 3.25));
    state.trailPositions.length = 20;
  }
  const array = trail.geometry.attributes.position.array;
  for (let i = 0; i < state.trailPositions.length; i += 1) {
    const point = state.trailPositions[i];
    const depth = i * 0.36;
    array[i * 3] = point.x;
    array[i * 3 + 1] = point.y;
    array[i * 3 + 2] = point.z + depth;
  }
  trail.geometry.attributes.position.needsUpdate = true;
}

function applyIdentity() {
  const identity = identityPayload();
  document.body.dataset.v2114Frame = state.profile.equipped.frame;
  document.body.dataset.v2114Badge = state.profile.equipped.badge;
  document.body.dataset.v2114Title = state.profile.equipped.title;
  const rankCard = $('.v2112-prestige-card--crown');
  if (rankCard) {
    const strong = $('strong', rankCard);
    const small = $('small', rankCard);
    if (strong) strong.textContent = identity.title;
    if (small) small.textContent = identity.frame;
  }
}

function equipReward(id) {
  const reward = rewardById(id);
  if (!reward || !isUnlocked(reward)) return;
  state.profile.equipped[reward.category] = reward.id;
  saveProfile();
  if (reward.category === 'thruster') applyThruster();
  if (reward.category === 'trail') ensureTrail();
  applyIdentity();
  renderForge();
  showToast(`${reward.name} EQUIPADO`);
}

function showToast(message) {
  let toast = $('#v2114-reward-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'v2114-reward-toast';
    toast.className = 'v2114-reward-toast';
    document.body.append(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 1700);
}

function detectNewRewards() {
  let changed = false;
  for (const reward of REWARDS) {
    if (reward.default || !isUnlocked(reward) || state.profile.seenUnlocks[reward.id]) continue;
    state.profile.seenUnlocks[reward.id] = Date.now();
    changed = true;
    showToast(`NUEVA RECOMPENSA · ${reward.name}`);
  }
  if (changed) saveProfile();
}

function sync() {
  if (!state.profile) state.profile = loadProfile();
  const g = game();
  if (state.lastShip && g?.ship && state.lastShip !== g.ship) {
    restoreThrusterColors();
    disposeTrail();
  }
  if (g?.ship) state.lastShip = g.ship;
  const unlockKey = Object.keys(unlockedAchievements()).sort().join('|');
  const equipKey = Object.values(state.profile.equipped).join('|');
  const key = `${unlockKey}|${equipKey}|${g?.state || ''}`;
  if (key !== state.lastSyncKey) {
    state.lastSyncKey = key;
    state.profile = normalizeProfile(state.profile);
    detectNewRewards();
    ensureLauncher();
    applyThruster();
    applyIdentity();
    if (state.open) renderForge();
  }
  updateTrail();
}

function installEvents() {
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-v2114-forge-open]')) {
      event.preventDefault();
      openForge();
      return;
    }
    if (event.target.closest('[data-v2114-forge-close]')) {
      event.preventDefault();
      closeForge();
      return;
    }
    const tab = event.target.closest('[data-v2114-tab]');
    if (tab) {
      event.preventDefault();
      state.tab = CATEGORIES.some((entry) => entry.id === tab.dataset.v2114Tab) ? tab.dataset.v2114Tab : 'thruster';
      renderForge();
      return;
    }
    const equip = event.target.closest('[data-v2114-equip]');
    if (equip) {
      event.preventDefault();
      equipReward(equip.dataset.v2114Equip);
    }
  }, true);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.open) {
      event.stopImmediatePropagation();
      closeForge();
    }
  }, true);
}

state.profile = loadProfile();
ensureForge();
ensureLauncher();
installEvents();
sync();

function frameLoop() {
  updateTrail();
  requestAnimationFrame(frameLoop);
}
requestAnimationFrame(frameLoop);
window.setInterval(sync, 900);
window.addEventListener('pageshow', sync);
window.addEventListener('storage', sync);
document.addEventListener('wae:achievement-unlocked', sync);
document.addEventListener('wae:v21-identity-changed', sync);

window.__waeRewardForge = Object.freeze({
  open: openForge,
  close: closeForge,
  get: () => ({ ...state.profile, identity: identityPayload() }),
  getIdentity: identityPayload,
  getRewards: () => REWARDS.map((reward) => ({ ...reward, unlocked: isUnlocked(reward) })),
});
