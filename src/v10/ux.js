const $ = (selector) => document.querySelector(selector);

const TOUCH_MODE = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
document.body.classList.toggle('v101-touch', TOUCH_MODE);

function isHidden(selector) {
  const element = $(selector);
  return !element || element.classList.contains('hidden');
}

function isPlayingSurface() {
  return isHidden('#start-screen')
    && isHidden('#pause-screen')
    && isHidden('#game-over-screen')
    && isHidden('#perk-screen')
    && isHidden('#route-screen')
    && isHidden('#hangar-screen')
    && isHidden('#galaxy-screen')
    && isHidden('#fatal-screen');
}

function installViewportGuard() {
  const sync = () => {
    const height = window.visualViewport?.height ?? window.innerHeight;
    document.documentElement.style.setProperty('--v101-vh', `${Math.round(height)}px`);
  };
  sync();
  window.addEventListener('resize', sync, { passive: true });
  window.visualViewport?.addEventListener('resize', sync, { passive: true });
}

function installQuickStart() {
  const panel = $('#start-screen .panel');
  const startMeta = $('#start-screen .start-meta');
  if (!panel || !startMeta || $('#v101-quickstart')) return;

  const guide = document.createElement('div');
  guide.id = 'v101-quickstart';
  guide.className = 'v101-quickstart';
  guide.setAttribute('aria-label', 'Cómo jugar');
  guide.innerHTML = [
    '<div><b>1</b><span><strong>ARRASTRA</strong><small>mueve la nave</small></span></div>',
    '<div><b>2</b><span><strong>FUEGO</strong><small>mantén pulsado</small></span></div>',
    '<div><b>3</b><span><strong>PULSO · ESQUIVA · MISIL</strong><small>úsalos cuando estén listos</small></span></div>',
  ].join('');
  panel.insertBefore(guide, startMeta);

  const startButton = $('#start-btn');
  if (startButton) startButton.setAttribute('aria-describedby', 'v101-quickstart');
}

function installAbilityStatus() {
  const bindings = [
    { button: '#secondary-btn', label: '#secondary-label', name: 'Pulso' },
    { button: '#dash-btn', label: '#dash-label', name: 'Esquiva' },
    { button: '#missile-btn', label: '#missile-label', name: 'Misil' },
  ];

  for (const binding of bindings) {
    const button = $(binding.button);
    const label = $(binding.label);
    if (!button || !label) continue;

    const sync = () => {
      const value = (label.textContent || 'LISTO').trim();
      button.dataset.status = value;
      button.dataset.ready = value === 'LISTO' ? 'true' : 'false';
      button.setAttribute('aria-label', value === 'LISTO' ? `${binding.name} listo` : `${binding.name}, disponible en ${value}`);
    };
    sync();
    new MutationObserver(sync).observe(label, { childList: true, subtree: true, characterData: true });
  }
}

function haptic(ms = 10) {
  if (!TOUCH_MODE) return;
  try { navigator.vibrate?.(ms); } catch { /* optional capability */ }
}

function installTouchFeedback() {
  const bindings = [
    ['#fire-btn', 8],
    ['#secondary-btn', 14],
    ['#dash-btn', 16],
    ['#missile-btn', 18],
    ['#pause-btn', 8],
  ];
  for (const [selector, duration] of bindings) {
    $(selector)?.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'touch') haptic(duration);
    }, { passive: true });
  }
}

function dispatchKey(key, down) {
  window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', {
    key,
    bubbles: true,
    cancelable: true,
  }));
}

function installPrecisionDrag() {
  const playfield = $('#game-container');
  if (!playfield || !TOUCH_MODE) return;

  const keys = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' };
  const held = new Set();
  let pointerId = null;
  let originX = 0;
  let originY = 0;
  const deadZone = 8;

  const setDirection = (direction, active) => {
    const has = held.has(direction);
    if (active === has) return;
    if (active) held.add(direction); else held.delete(direction);
    dispatchKey(keys[direction], active);
  };

  const clear = () => {
    for (const direction of [...held]) setDirection(direction, false);
    document.body.classList.remove('v101-dragging');
  };

  const update = (x, y) => {
    const dx = x - originX;
    const dy = y - originY;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    const horizontalOnly = ax > ay * 1.65;
    const verticalOnly = ay > ax * 1.65;

    setDirection('left', !verticalOnly && dx < -deadZone);
    setDirection('right', !verticalOnly && dx > deadZone);
    setDirection('up', !horizontalOnly && dy < -deadZone);
    setDirection('down', !horizontalOnly && dy > deadZone);
  };

  playfield.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch' || pointerId !== null || !isPlayingSurface()) return;
    pointerId = event.pointerId;
    originX = event.clientX;
    originY = event.clientY;
    playfield.setPointerCapture?.(pointerId);
    document.body.classList.add('v101-dragging');
    event.preventDefault();
    event.stopPropagation();
  }, { capture: true, passive: false });

  playfield.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointerId) return;
    update(event.clientX, event.clientY);
    event.preventDefault();
    event.stopPropagation();
  }, { capture: true, passive: false });

  const finish = (event) => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    clear();
    event.preventDefault();
    event.stopPropagation();
  };

  playfield.addEventListener('pointerup', finish, { capture: true, passive: false });
  playfield.addEventListener('pointercancel', finish, { capture: true, passive: false });
  playfield.addEventListener('lostpointercapture', (event) => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    clear();
  }, { capture: true });
  window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });
}

function simplifyCopy() {
  const resume = $('#resume-btn');
  const restart = $('#restart-btn');
  const hangar = $('#gameover-hangar-btn');
  if (resume) resume.textContent = 'CONTINUAR PARTIDA';
  if (restart) restart.textContent = 'VOLVER A JUGAR';
  if (hangar) hangar.textContent = 'MEJORAR NAVE';

  const pauseCopy = $('#pause-screen .panel p');
  if (pauseCopy) pauseCopy.textContent = 'Tu partida está segura.';
}

function installFocusRecovery() {
  document.addEventListener('pointerdown', (event) => {
    const button = event.target.closest?.('button');
    if (button && event.pointerType === 'touch') button.blur?.();
  }, { passive: true });
}

installViewportGuard();
installQuickStart();
installAbilityStatus();
installTouchFeedback();
installPrecisionDrag();
simplifyCopy();
installFocusRecovery();
