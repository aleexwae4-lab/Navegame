import './styles.css';
import { NeonRiderGame } from './game.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const ui = {
  score: $('#score'),
  highScore: $('#high-score'),
  level: $('#level'),
  shield: $('#shield-value'),
  shieldBar: $('#shield-bar'),
  announcer: $('#announcer'),
  powerStatus: $('#power-status'),
  startScreen: $('#start-screen'),
  pauseScreen: $('#pause-screen'),
  gameOverScreen: $('#game-over-screen'),
  fatalScreen: $('#fatal-screen'),
  fatalMessage: $('#fatal-message'),
  pauseButton: $('#pause-btn'),
  soundButton: $('#sound-btn'),
  finalScore: $('#final-score'),
  finalLevel: $('#final-level'),
  finalHighScore: $('#final-high-score'),
};

let announceTimer = 0;

function setVisible(element, visible) {
  element.classList.toggle('hidden', !visible);
}

function renderHud(state) {
  ui.score.textContent = state.score.toLocaleString('es-MX');
  ui.highScore.textContent = state.highScore.toLocaleString('es-MX');
  ui.level.textContent = String(state.level);
  ui.shield.textContent = `${state.shield}%`;
  ui.shieldBar.style.width = `${state.shield}%`;
  ui.shieldBar.dataset.zone = state.shield > 50 ? 'safe' : state.shield > 25 ? 'warn' : 'danger';

  if (state.rapidFire) {
    ui.powerStatus.textContent = `RÁFAGA NEÓN · ${state.rapidFireSeconds}s`;
    setVisible(ui.powerStatus, true);
  } else {
    setVisible(ui.powerStatus, false);
  }
}

function announce(message) {
  window.clearTimeout(announceTimer);
  ui.announcer.textContent = message;
  ui.announcer.classList.add('show');
  announceTimer = window.setTimeout(() => ui.announcer.classList.remove('show'), 1050);
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
    ui.finalLevel.textContent = String(snapshot.level);
    ui.finalHighScore.textContent = snapshot.highScore.toLocaleString('es-MX');
  }
}

const game = new NeonRiderGame($('#game-container'), {
  onReady: (snapshot) => {
    renderHud(snapshot);
    handleState('idle', snapshot);
  },
  onHud: renderHud,
  onState: handleState,
  onAnnounce: announce,
  onFatal: (message) => {
    ui.fatalMessage.textContent = message || 'Este navegador no pudo inicializar WebGL.';
    setVisible(ui.fatalScreen, true);
  },
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

const keyMap = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  W: 'up',
  s: 'down',
  S: 'down',
  a: 'left',
  A: 'left',
  d: 'right',
  D: 'right',
  ' ': 'shoot',
};

window.addEventListener('keydown', (event) => {
  if (keyMap[event.key]) {
    event.preventDefault();
    game.setInput(keyMap[event.key], true);
  }
  if (!event.repeat && (event.key === 'p' || event.key === 'P' || event.key === 'Escape')) game.togglePause();
  if (!event.repeat && (event.key === 'm' || event.key === 'M')) ui.soundButton.click();
});

window.addEventListener('keyup', (event) => {
  if (keyMap[event.key]) {
    event.preventDefault();
    game.setInput(keyMap[event.key], false);
  }
});

for (const button of $$('[data-control]')) {
  const control = button.dataset.control;
  const activate = (event) => {
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    game.setInput(control, true);
  };
  const deactivate = (event) => {
    event.preventDefault();
    game.setInput(control, false);
  };
  button.addEventListener('pointerdown', activate);
  button.addEventListener('pointerup', deactivate);
  button.addEventListener('pointercancel', deactivate);
  button.addEventListener('lostpointercapture', () => game.setInput(control, false));
  button.addEventListener('contextmenu', (event) => event.preventDefault());
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'playing') game.pause();
});

window.addEventListener('blur', () => {
  game.clearInput();
});
