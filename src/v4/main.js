import './styles.css';
import { NeonRiderGame } from './game.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const ui = {
  score: $('#score'), highScore: $('#high-score'), level: $('#level'), sector: $('#sector'),
  shield: $('#shield-value'), shieldBar: $('#shield-bar'), announcer: $('#announcer'), powerStatus: $('#power-status'),
  missionCard: $('#mission-card'), missionTitle: $('#mission-title'), missionReward: $('#mission-reward'), missionBar: $('#mission-bar'), missionProgress: $('#mission-progress-text'),
  heatBar: $('#heat-bar'), comboLabel: $('#combo-label'), bossCard: $('#boss-card'), bossBar: $('#boss-bar'), bossHp: $('#boss-hp-text'),
  startScreen: $('#start-screen'), pauseScreen: $('#pause-screen'), gameOverScreen: $('#game-over-screen'), fatalScreen: $('#fatal-screen'), fatalMessage: $('#fatal-message'),
  pauseButton: $('#pause-btn'), soundButton: $('#sound-btn'), finalScore: $('#final-score'), finalSector: $('#final-sector'), finalHighScore: $('#final-high-score'), finalCores: $('#final-cores'),
};

let announceTimer = 0;
const setVisible = (element, visible) => element.classList.toggle('hidden', !visible);

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
    setVisible(ui.bossCard, true);
  } else setVisible(ui.bossCard, false);

  const status = state.overdrive ? `OVERDRIVE · ${state.overdriveSeconds}s` : state.rapidFire ? `RÁFAGA NEÓN · ${state.rapidFireSeconds}s` : '';
  ui.powerStatus.textContent = status;
  setVisible(ui.powerStatus, Boolean(status));
}

function announce(message) {
  window.clearTimeout(announceTimer);
  ui.announcer.textContent = message;
  ui.announcer.classList.add('show');
  announceTimer = window.setTimeout(() => ui.announcer.classList.remove('show'), 1200);
}

function handleState(state, snapshot) {
  setVisible(ui.startScreen, state === 'idle');
  setVisible(ui.pauseScreen, state === 'paused');
  setVisible(ui.gameOverScreen, state === 'gameover');
  ui.pauseButton.disabled = state === 'idle' || state === 'gameover';
  ui.pauseButton.textContent = state === 'paused' ? '▶' : 'Ⅱ';
  ui.pauseButton.setAttribute('aria-label', state === 'paused' ? 'Continuar juego' : 'Pausar juego');
  if (state === 'gameover') {
    ui.finalScore.textContent = `Puntuación alcanzada: ${snapshot.score.toLocaleString('es-MX')}`;
    ui.finalSector.textContent = String(snapshot.sector);
    ui.finalHighScore.textContent = snapshot.highScore.toLocaleString('es-MX');
    ui.finalCores.textContent = snapshot.cores.toLocaleString('es-MX');
  }
}

const game = new NeonRiderGame($('#game-container'), {
  onReady: (snapshot) => { renderHud(snapshot); handleState('idle', snapshot); },
  onHud: renderHud,
  onState: handleState,
  onAnnounce: announce,
  onFatal: (message) => { ui.fatalMessage.textContent = message || 'Este navegador no pudo inicializar WebGL.'; setVisible(ui.fatalScreen, true); },
});

game.init();
$('#start-btn').addEventListener('click', () => game.start());
$('#restart-btn').addEventListener('click', () => game.start());
$('#resume-btn').addEventListener('click', () => game.resume());
ui.pauseButton.addEventListener('click', () => game.togglePause());
ui.soundButton.addEventListener('click', async () => {
  await game.audio.unlock();
  const enabled = game.toggleAudio();
  ui.soundButton.textContent = enabled ? '♪' : '×';
  ui.soundButton.classList.toggle('muted', !enabled);
  ui.soundButton.setAttribute('aria-label', enabled ? 'Silenciar audio' : 'Activar audio');
});

const keyMap = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', W: 'up', s: 'down', S: 'down', a: 'left', A: 'left', d: 'right', D: 'right', ' ': 'shoot' };
window.addEventListener('keydown', (event) => {
  if (keyMap[event.key]) { event.preventDefault(); game.setInput(keyMap[event.key], true); }
  if (!event.repeat && (event.key === 'p' || event.key === 'P' || event.key === 'Escape')) game.togglePause();
  if (!event.repeat && (event.key === 'm' || event.key === 'M')) ui.soundButton.click();
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
