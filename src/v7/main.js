import './styles.css';
import { NeonRiderGame } from './game.js';
import { CONTRACTS, PERKS } from './config.js';
import { SHIPS, WEAPONS } from '../v5/config.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const setVisible = (element, visible) => { if (element) element.classList.toggle('hidden', !visible); };

const ui = {
  score: $('#score'), highScore: $('#high-score'), level: $('#level'), sector: $('#sector'),
  shield: $('#shield-value'), shieldBar: $('#shield-bar'), announcer: $('#announcer'), powerStatus: $('#power-status'),
  missionCard: $('#mission-card'), missionTitle: $('#mission-title'), missionReward: $('#mission-reward'), missionBar: $('#mission-bar'), missionProgress: $('#mission-progress-text'),
  heatBar: $('#heat-bar'), comboLabel: $('#combo-label'), bossCard: $('#boss-card'), bossBar: $('#boss-bar'), bossHp: $('#boss-hp-text'), bossPhase: $('#boss-phase'), bossName: $('#boss-name'),
  secondaryBar: $('#secondary-bar'), secondaryLabel: $('#secondary-label'), secondaryButton: $('#secondary-btn'),
  dashBar: $('#dash-bar'), dashLabel: $('#dash-label'), dashButton: $('#dash-btn'),
  biomeLabel: $('#biome-label'), contractLabel: $('#contract-label'), activePerks: $('#active-perks'),
  startScreen: $('#start-screen'), pauseScreen: $('#pause-screen'), perkScreen: $('#perk-screen'), perkGrid: $('#perk-grid'),
  routeScreen: $('#route-screen'), routeGrid: $('#route-grid'), routeSector: $('#route-sector'),
  gameOverScreen: $('#game-over-screen'), fatalScreen: $('#fatal-screen'), fatalMessage: $('#fatal-message'),
  hangarScreen: $('#hangar-screen'), galaxyScreen: $('#galaxy-screen'),
  pauseButton: $('#pause-btn'), soundButton: $('#sound-btn'), finalScore: $('#final-score'), finalSector: $('#final-sector'), finalHighScore: $('#final-high-score'), finalCores: $('#final-cores'),
  loadoutLabel: $('#loadout-label'), profileCores: $('#profile-cores'), selectedSectorLabel: $('#selected-sector-label'), startButton: $('#start-btn'),
  hangarCores: $('#hangar-cores'), shipGrid: $('#ship-grid'), weaponGrid: $('#weapon-grid'), galaxyGrid: $('#galaxy-grid'), galaxyBest: $('#galaxy-best-sector'),
  eliteKills: $('#elite-kills'), guardiansDefeated: $('#guardians-defeated'),
};

let announceTimer = 0;

function announce(message) {
  window.clearTimeout(announceTimer);
  ui.announcer.textContent = message;
  ui.announcer.classList.add('show');
  announceTimer = window.setTimeout(() => ui.announcer.classList.remove('show'), 1500);
}

function renderActivePerks(ids = []) {
  if (!ui.activePerks) return;
  ui.activePerks.innerHTML = ids.map((id) => `<span>${PERKS[id]?.name ?? id}</span>`).join('');
  setVisible(ui.activePerks, ids.length > 0);
}

function renderHud(state) {
  ui.score.textContent = state.score.toLocaleString('es-MX');
  ui.highScore.textContent = state.highScore.toLocaleString('es-MX');
  ui.level.textContent = String(state.level);
  ui.sector.textContent = String(state.sector);
  ui.shield.textContent = `${state.shield}%`;
  ui.shieldBar.style.width = `${state.shield}%`;
  ui.shieldBar.dataset.zone = state.shield > 50 ? 'safe' : state.shield > 25 ? 'warn' : 'danger';

  const missionPercent = Math.min(100, (state.mission.progress / state.mission.target) * 100 || 0);
  ui.missionTitle.textContent = state.mission.complete ? 'COMPLETADA' : state.mission.title;
  ui.missionReward.textContent = state.mission.complete ? '+1 CORE' : `+${state.mission.reward}`;
  ui.missionProgress.textContent = `${state.mission.progress} / ${state.mission.target}`;
  ui.missionBar.style.width = `${missionPercent}%`;
  ui.missionCard.classList.toggle('complete', state.mission.complete);

  ui.heatBar.style.width = `${state.overdrive ? 100 : state.heat}%`;
  ui.heatBar.classList.toggle('overdrive', state.overdrive);
  ui.comboLabel.textContent = state.overdrive ? `OVERDRIVE ${state.overdriveSeconds}s · x${state.comboMultiplier}` : `x${state.comboMultiplier}`;

  if (state.boss) {
    const bossPercent = Math.max(0, (state.boss.hp / state.boss.maxHp) * 100);
    ui.bossBar.style.width = `${bossPercent}%`;
    ui.bossHp.textContent = `${Math.ceil(bossPercent)}%`;
    if (ui.bossPhase) ui.bossPhase.textContent = `FASE ${state.boss.phase ?? 1}`;
    if (ui.bossName) ui.bossName.textContent = state.guardian?.name ?? 'GUARDIÁN';
    setVisible(ui.bossCard, true);
  } else setVisible(ui.bossCard, false);

  if (state.secondary) {
    ui.secondaryBar.style.width = `${state.secondary.percent}%`;
    ui.secondaryLabel.textContent = state.secondary.ready ? 'LISTO' : `${Math.ceil(state.secondary.cooldown)}s`;
    ui.secondaryButton?.classList.toggle('ready', state.secondary.ready);
    ui.secondaryButton?.toggleAttribute('disabled', !state.secondary.ready && game.state === 'playing');
  }

  if (state.dash) {
    ui.dashBar.style.width = `${state.dash.percent}%`;
    ui.dashLabel.textContent = state.dash.ready ? 'LISTO' : `${Math.ceil(state.dash.cooldown)}s`;
    ui.dashButton?.classList.toggle('ready', state.dash.ready);
    ui.dashButton?.toggleAttribute('disabled', !state.dash.ready && game.state === 'playing');
  }

  if (state.biome && ui.biomeLabel) ui.biomeLabel.textContent = state.biome.name;
  if (state.contract && ui.contractLabel) ui.contractLabel.textContent = state.contract.name;
  renderActivePerks(state.run?.perks ?? []);

  const status = state.overdrive ? `OVERDRIVE · ${state.overdriveSeconds}s` : state.rapidFire ? `RÁFAGA NEÓN · ${state.rapidFireSeconds}s` : '';
  ui.powerStatus.textContent = status;
  setVisible(ui.powerStatus, Boolean(status));

  if (state.loadout) ui.loadoutLabel.textContent = `${state.loadout.shipName} · ${state.loadout.weaponName}`;
  if (state.meta) renderMeta(state.meta);
}

function itemCard(kind, item, unlocked, equipped, cores) {
  const locked = !unlocked;
  const affordable = cores >= item.cost;
  const stats = kind === 'ship'
    ? `<div class="loadout-stats"><span>VEL ${(item.speed * 100).toFixed(0)}</span><span>ESC ${(item.shield * 100).toFixed(0)}</span><span>CAD ${(100 / item.fireRate).toFixed(0)}</span></div>`
    : `<div class="loadout-stats"><span>${item.lanes.length} HACES</span><span>CAD ${(100 / item.cooldown).toFixed(0)}</span></div>`;

  let action = `<button class="loadout-action equipped" disabled>EQUIPADO</button>`;
  if (!equipped && unlocked) action = `<button class="loadout-action" data-meta-action="equip" data-kind="${kind}" data-id="${item.id}">EQUIPAR</button>`;
  if (locked) action = `<button class="loadout-action ${affordable ? '' : 'insufficient'}" data-meta-action="buy" data-kind="${kind}" data-id="${item.id}">${item.cost} CORES</button>`;

  return `<article class="loadout-card ${equipped ? 'is-equipped' : ''} ${locked ? 'is-locked' : ''}">
    <div class="loadout-card-top"><span>${item.className}</span><b>${locked ? 'BLOQUEADO' : equipped ? 'ACTIVO' : 'DISPONIBLE'}</b></div>
    <h3>${item.name}</h3><p>${item.description}</p>${stats}${action}
  </article>`;
}

function renderCatalog(meta) {
  if (!ui.shipGrid || !ui.weaponGrid) return;
  ui.shipGrid.innerHTML = Object.values(SHIPS).map((item) => itemCard('ship', item, meta.unlockedShips.includes(item.id), meta.equippedShip === item.id, meta.cores)).join('');
  ui.weaponGrid.innerHTML = Object.values(WEAPONS).map((item) => itemCard('weapon', item, meta.unlockedWeapons.includes(item.id), meta.equippedWeapon === item.id, meta.cores)).join('');
}

function renderGalaxy(meta) {
  if (!ui.galaxyGrid) return;
  const maxNode = Math.max(7, meta.bestSector + 2);
  const start = Math.max(1, Math.min(meta.selectedSector - 2, Math.max(1, maxNode - 6)));
  const nodes = [];
  for (let sector = start; sector < start + 7; sector += 1) {
    const unlocked = sector <= meta.bestSector;
    const selected = sector === meta.selectedSector;
    nodes.push(`<button class="sector-node ${selected ? 'selected' : ''} ${unlocked ? '' : 'locked'}" ${unlocked ? `data-sector="${sector}"` : 'disabled'}>
      <span>${unlocked ? `SECTOR ${sector}` : 'BLOQUEADO'}</span><strong>${sector}</strong><small>${selected ? 'PUNTO DE SALTO' : unlocked ? 'DISPONIBLE' : `SUPERA ${sector - 1}`}</small>
    </button>`);
  }
  ui.galaxyGrid.innerHTML = nodes.join('');
}

function renderMeta(meta) {
  if (ui.profileCores) ui.profileCores.textContent = meta.cores.toLocaleString('es-MX');
  if (ui.hangarCores) ui.hangarCores.textContent = meta.cores.toLocaleString('es-MX');
  if (ui.galaxyBest) ui.galaxyBest.textContent = String(meta.bestSector);
  if (ui.selectedSectorLabel) ui.selectedSectorLabel.textContent = `SECTOR ${meta.selectedSector}`;
  if (ui.eliteKills) ui.eliteKills.textContent = (meta.eliteKills ?? 0).toLocaleString('es-MX');
  if (ui.guardiansDefeated) ui.guardiansDefeated.textContent = (meta.guardiansDefeated ?? 0).toLocaleString('es-MX');
  if (ui.startButton && (game?.state === 'idle' || game?.state === 'gameover')) ui.startButton.textContent = `INICIAR · SECTOR ${meta.selectedSector}`;
  renderCatalog(meta);
  renderGalaxy(meta);
}

function renderPerkSelection(payload) {
  const choices = payload?.choices ?? [];
  if (!ui.perkGrid) return;
  ui.perkGrid.innerHTML = choices.map((id) => {
    const perk = PERKS[id];
    return `<button class="perk-card" data-perk-id="${id}" type="button"><span>MEJORA DE RUN</span><strong>${perk.name}</strong><p>${perk.description}</p><b>ELEGIR</b></button>`;
  }).join('');
  renderActivePerks(payload?.active ?? []);
}

function renderRouteSelection(payload) {
  const choices = payload?.choices ?? [];
  if (!ui.routeGrid) return;
  if (ui.routeSector) ui.routeSector.textContent = `SECTOR ${payload?.sector ?? ''}`;
  ui.routeGrid.innerHTML = choices.map((id) => {
    const route = CONTRACTS[id];
    const risk = route.damageMultiplier > 1.15 ? 'RIESGO EXTREMO' : route.eliteChance > 0.2 ? 'RIESGO ALTO' : 'RIESGO CONTROLADO';
    const reward = route.scoreMultiplier > 1.3 ? `PUNTOS x${route.scoreMultiplier.toFixed(2)}` : route.eliteReward > 1.2 ? 'ÉLITES PREMIUM' : 'REPARACIÓN';
    return `<button class="route-card route-card--${id}" data-route-id="${id}" type="button">
      <span>${route.tag}</span><strong>${route.name}</strong><p>${route.description}</p>
      <div><b>${risk}</b><em>${reward}</em></div>
    </button>`;
  }).join('');
}

function closeMetaScreens() {
  setVisible(ui.hangarScreen, false);
  setVisible(ui.galaxyScreen, false);
}

function restoreBaseOverlay() {
  closeMetaScreens();
  setVisible(ui.startScreen, game.state === 'idle');
  setVisible(ui.gameOverScreen, game.state === 'gameover');
}

function openMetaScreen(screen) {
  if (game.state !== 'idle' && game.state !== 'gameover') return;
  setVisible(ui.startScreen, false);
  setVisible(ui.gameOverScreen, false);
  setVisible(ui.hangarScreen, screen === 'hangar');
  setVisible(ui.galaxyScreen, screen === 'galaxy');
  renderMeta(game.metaSnapshot());
}

function handleState(state, snapshot) {
  if (state === 'playing' || state === 'paused' || state === 'perk' || state === 'route') closeMetaScreens();
  setVisible(ui.startScreen, state === 'idle');
  setVisible(ui.pauseScreen, state === 'paused');
  setVisible(ui.perkScreen, state === 'perk');
  setVisible(ui.routeScreen, state === 'route');
  setVisible(ui.gameOverScreen, state === 'gameover');
  ui.pauseButton.disabled = state === 'idle' || state === 'gameover' || state === 'perk' || state === 'route';
  ui.pauseButton.textContent = state === 'paused' ? '▶' : 'Ⅱ';
  ui.pauseButton.setAttribute('aria-label', state === 'paused' ? 'Continuar juego' : 'Pausar juego');

  if (state === 'gameover') {
    ui.finalScore.textContent = `Puntuación alcanzada: ${snapshot.score.toLocaleString('es-MX')}`;
    ui.finalSector.textContent = String(snapshot.sector);
    ui.finalHighScore.textContent = snapshot.highScore.toLocaleString('es-MX');
    ui.finalCores.textContent = snapshot.cores.toLocaleString('es-MX');
  }
  renderMeta(snapshot.meta ?? game.metaSnapshot());
}

const game = new NeonRiderGame($('#game-container'), {
  onReady: (snapshot) => { renderHud(snapshot); handleState('idle', snapshot); },
  onHud: renderHud,
  onMeta: renderMeta,
  onPerk: renderPerkSelection,
  onRoute: renderRouteSelection,
  onBiome: (biome) => { if (ui.biomeLabel) ui.biomeLabel.textContent = biome.name; },
  onGuardian: (guardian) => { if (ui.bossName && guardian) ui.bossName.textContent = guardian.name; },
  onEvent: (event) => announce(`${event.name} · ${event.description}`),
  onState: handleState,
  onAnnounce: announce,
  onFatal: (message) => { ui.fatalMessage.textContent = message || 'Este navegador no pudo inicializar WebGL.'; setVisible(ui.fatalScreen, true); },
});

game.init();

ui.startButton.addEventListener('click', () => game.start());
$('#restart-btn').addEventListener('click', () => game.start());
$('#resume-btn').addEventListener('click', () => game.resume());
$('#open-hangar-btn').addEventListener('click', () => openMetaScreen('hangar'));
$('#open-galaxy-btn').addEventListener('click', () => openMetaScreen('galaxy'));
$('#gameover-hangar-btn').addEventListener('click', () => openMetaScreen('hangar'));
$('#close-hangar-btn').addEventListener('click', restoreBaseOverlay);
$('#close-galaxy-btn').addEventListener('click', restoreBaseOverlay);
ui.secondaryButton?.addEventListener('click', () => game.activateSecondary());
ui.dashButton?.addEventListener('click', () => game.activateDash());

ui.pauseButton.addEventListener('click', () => game.togglePause());
ui.soundButton.addEventListener('click', async () => {
  await game.audio.unlock();
  const enabled = game.toggleAudio();
  ui.soundButton.textContent = enabled ? '♪' : '×';
  ui.soundButton.classList.toggle('muted', !enabled);
  ui.soundButton.setAttribute('aria-label', enabled ? 'Silenciar audio' : 'Activar audio');
});

document.addEventListener('click', (event) => {
  const perkButton = event.target.closest('[data-perk-id]');
  if (perkButton) { game.choosePerk(perkButton.dataset.perkId); return; }

  const routeButton = event.target.closest('[data-route-id]');
  if (routeButton) { game.chooseRoute(routeButton.dataset.routeId); return; }

  const actionButton = event.target.closest('[data-meta-action]');
  if (actionButton) {
    const { metaAction, kind, id } = actionButton.dataset;
    if (metaAction === 'buy') {
      const result = game.purchase(kind, id);
      if (!result.ok) { announce('CORES INSUFICIENTES'); return; }
      game.equip(kind, id);
      announce('DESBLOQUEADO · EQUIPADO');
    } else if (metaAction === 'equip') {
      game.equip(kind, id);
      announce('LOADOUT ACTUALIZADO');
    }
    renderMeta(game.metaSnapshot());
    return;
  }

  const sectorButton = event.target.closest('[data-sector]');
  if (sectorButton && game.selectSector(Number(sectorButton.dataset.sector))) {
    announce(`SALTO CONFIGURADO · SECTOR ${sectorButton.dataset.sector}`);
    renderMeta(game.metaSnapshot());
  }
});

const keyMap = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', W: 'up', s: 'down', S: 'down', a: 'left', A: 'left', d: 'right', D: 'right', ' ': 'shoot' };
window.addEventListener('keydown', (event) => {
  if (keyMap[event.key]) { event.preventDefault(); game.setInput(keyMap[event.key], true); }
  if (!event.repeat && (event.key === 'q' || event.key === 'Q' || event.key === 'e' || event.key === 'E')) game.activateSecondary();
  if (!event.repeat && (event.key === 'Shift' || event.key === 'x' || event.key === 'X')) game.activateDash();
  if (!event.repeat && (event.key === 'p' || event.key === 'P' || event.key === 'Escape')) {
    if (game.state === 'perk' || game.state === 'route') return;
    if (!ui.hangarScreen.classList.contains('hidden') || !ui.galaxyScreen.classList.contains('hidden')) restoreBaseOverlay();
    else game.togglePause();
  }
  if (!event.repeat && (event.key === 'm' || event.key === 'M')) ui.soundButton.click();
  if (!event.repeat && (event.key === 'h' || event.key === 'H')) openMetaScreen('hangar');
  if (!event.repeat && (event.key === 'g' || event.key === 'G')) openMetaScreen('galaxy');
});
window.addEventListener('keyup', (event) => {
  if (keyMap[event.key]) { event.preventDefault(); game.setInput(keyMap[event.key], false); }
});

for (const button of $$('[data-control]')) {
  const control = button.dataset.control;
  const activate = (event) => { event.preventDefault(); button.setPointerCapture?.(event.pointerId); button.classList.add('is-active'); game.setInput(control, true); };
  const deactivate = (event) => { event.preventDefault(); button.classList.remove('is-active'); game.setInput(control, false); };
  button.addEventListener('pointerdown', activate);
  button.addEventListener('pointerup', deactivate);
  button.addEventListener('pointercancel', deactivate);
  button.addEventListener('lostpointercapture', () => { button.classList.remove('is-active'); game.setInput(control, false); });
  button.addEventListener('contextmenu', (event) => event.preventDefault());
}

document.addEventListener('visibilitychange', () => { if (document.hidden && game.state === 'playing') game.pause(); });
window.addEventListener('blur', () => game.clearInput());
renderMeta(game.metaSnapshot());
