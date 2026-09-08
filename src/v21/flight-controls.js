const $ = (selector, root = document) => root.querySelector(selector);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const BASE_SHIP_SPEED = 22;
const WORLD = Object.freeze({ xMin: -16, xMax: 16, yMin: -9.5, yMax: 9.5 });
const STICK_RADIUS = 64;
const DEADZONE = 0.075;
const RESPONSE = 1.22;
const PREMIUM_SCALE = 1.18;

const flight = {
  pointerId: null,
  originX: 0,
  originY: 0,
  targetX: 0,
  targetY: 0,
  currentX: 0,
  currentY: 0,
  hookedGame: null,
  baseUpdate: null,
  lastHaptic: 0,
  surface: null,
  stick: null,
  knob: null,
};

function game() {
  return window.__waeNeonRiderGame;
}

function touchLayout() {
  return window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth <= 900;
}

function shipSpeedMultiplier(g) {
  const selected = g?.getShip?.() || {};
  const value = Number(selected.speed);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function curveAxis(value) {
  const sign = Math.sign(value);
  const magnitude = Math.abs(value);
  if (magnitude <= DEADZONE) return 0;
  const normalized = clamp((magnitude - DEADZONE) / (1 - DEADZONE), 0, 1);
  return sign * Math.pow(normalized, RESPONSE);
}

function setStickVisual(dx = 0, dy = 0) {
  if (!flight.knob) return;
  flight.knob.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
}

function setStickOrigin(x, y) {
  if (!flight.stick) return;
  flight.stick.style.left = `${x}px`;
  flight.stick.style.top = `${y}px`;
}

function updateTarget(clientX, clientY) {
  const rawX = clientX - flight.originX;
  const rawY = clientY - flight.originY;
  const distance = Math.hypot(rawX, rawY);
  const scale = distance > STICK_RADIUS ? STICK_RADIUS / distance : 1;
  const dx = rawX * scale;
  const dy = rawY * scale;
  flight.targetX = curveAxis(dx / STICK_RADIUS);
  flight.targetY = curveAxis(-dy / STICK_RADIUS);
  setStickVisual(dx, dy);
}

function lightHaptic(duration = 7) {
  const now = performance.now();
  if (now - flight.lastHaptic < 55) return;
  flight.lastHaptic = now;
  try { navigator.vibrate?.(duration); } catch {}
}

function ensureFlightSurface() {
  if (flight.surface?.isConnected) return flight.surface;
  const surface = document.createElement('div');
  surface.id = 'v21-flight-surface';
  surface.className = 'v21-flight-surface hidden';
  surface.setAttribute('aria-hidden', 'true');
  surface.innerHTML = `
    <div class="v21-flight-stick" aria-hidden="true">
      <span class="v21-flight-ring"></span>
      <i class="v21-flight-knob"><b></b></i>
      <small>VECTOR</small>
    </div>`;
  document.body.append(surface);
  flight.surface = surface;
  flight.stick = $('.v21-flight-stick', surface);
  flight.knob = $('.v21-flight-knob', surface);

  surface.addEventListener('pointerdown', (event) => {
    const g = game();
    if (event.pointerType !== 'touch' || g?.state !== 'playing' || flight.pointerId !== null) return;
    flight.pointerId = event.pointerId;
    flight.originX = event.clientX;
    flight.originY = event.clientY;
    flight.targetX = 0;
    flight.targetY = 0;
    setStickOrigin(event.clientX, event.clientY);
    setStickVisual(0, 0);
    surface.classList.add('engaged');
    surface.setPointerCapture?.(event.pointerId);
    lightHaptic(8);
    event.preventDefault();
  }, { passive: false });

  surface.addEventListener('pointermove', (event) => {
    if (event.pointerId !== flight.pointerId) return;
    updateTarget(event.clientX, event.clientY);
    event.preventDefault();
  }, { passive: false });

  const end = (event) => {
    if (event.pointerId !== flight.pointerId) return;
    flight.pointerId = null;
    flight.targetX = 0;
    flight.targetY = 0;
    surface.classList.remove('engaged');
    setStickVisual(0, 0);
    event.preventDefault();
  };
  surface.addEventListener('pointerup', end, { passive: false });
  surface.addEventListener('pointercancel', end, { passive: false });
  surface.addEventListener('lostpointercapture', (event) => {
    if (event.pointerId !== flight.pointerId) return;
    flight.pointerId = null;
    flight.targetX = 0;
    flight.targetY = 0;
    surface.classList.remove('engaged');
    setStickVisual(0, 0);
  });

  return surface;
}

function applyPremiumShipScale(playing) {
  const ship = game()?.ship;
  if (!ship?.scale || !ship.userData) return;
  const shellScaleReady = Boolean(ship.userData.v21HudScaleApplied);
  const premiumApplied = Boolean(ship.userData.v21PremiumScaleApplied);
  if (playing && shellScaleReady && !premiumApplied) {
    ship.scale.multiplyScalar(PREMIUM_SCALE);
    ship.userData.v21PremiumScaleApplied = true;
  } else if (!playing && premiumApplied) {
    ship.scale.multiplyScalar(1 / PREMIUM_SCALE);
    ship.userData.v21PremiumScaleApplied = false;
  }
}

function installGameHook() {
  const g = game();
  if (!g || typeof g.updatePlaying !== 'function' || flight.hookedGame === g) return;
  const baseUpdate = g.updatePlaying.bind(g);
  flight.hookedGame = g;
  flight.baseUpdate = baseUpdate;

  const wrapped = (delta, elapsed, ...args) => {
    const activeTouch = touchLayout();
    if (activeTouch) {
      const responsiveness = 1 - Math.exp(-18 * Math.min(delta, 0.05));
      flight.currentX += (flight.targetX - flight.currentX) * responsiveness;
      flight.currentY += (flight.targetY - flight.currentY) * responsiveness;

      if (Math.abs(flight.currentX) < 0.003) flight.currentX = 0;
      if (Math.abs(flight.currentY) < 0.003) flight.currentY = 0;

      if (flight.pointerId !== null || Math.abs(flight.currentX) + Math.abs(flight.currentY) > 0.01) {
        for (const direction of ['left', 'right', 'up', 'down']) g.setInput?.(direction, false);
        const ship = g.ship;
        if (ship?.position) {
          const speed = BASE_SHIP_SPEED * shipSpeedMultiplier(g);
          let x = flight.currentX;
          let y = flight.currentY;
          const length = Math.hypot(x, y);
          if (length > 1) { x /= length; y /= length; }
          ship.position.x = clamp(ship.position.x + x * speed * delta, WORLD.xMin, WORLD.xMax);
          ship.position.y = clamp(ship.position.y + y * speed * delta, WORLD.yMin, WORLD.yMax);
        }
      }
    }

    const result = baseUpdate(delta, elapsed, ...args);

    if (activeTouch && g.ship?.rotation && (flight.pointerId !== null || Math.abs(flight.currentX) + Math.abs(flight.currentY) > 0.01)) {
      const rollTarget = -flight.currentX * 0.48;
      const pitchTarget = flight.currentY * 0.24;
      g.ship.rotation.z += (rollTarget - g.ship.rotation.z) * (1 - Math.exp(-14 * delta));
      g.ship.rotation.x += (pitchTarget - g.ship.rotation.x) * (1 - Math.exp(-14 * delta));
    }
    return result;
  };
  Object.defineProperty(wrapped, '__waeV21Analog', { value: true });
  g.updatePlaying = wrapped;
}

function syncPremiumState() {
  const g = game();
  const state = String(g?.state || 'idle');
  const playing = state === 'playing';
  const surface = ensureFlightSurface();
  const usable = playing && touchLayout();
  surface.classList.toggle('hidden', !usable);
  document.body.classList.toggle('v21-playing', playing);
  document.body.classList.toggle('v21-touch-flight', usable);
  applyPremiumShipScale(playing);
  installGameHook();

  if (!usable && flight.pointerId !== null) {
    flight.pointerId = null;
    flight.targetX = 0;
    flight.targetY = 0;
    surface.classList.remove('engaged');
    setStickVisual(0, 0);
  }
}

function installActionHaptics() {
  document.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch') return;
    const action = event.target.closest('#fire-btn, #dash-btn, #missile-btn, #secondary-btn, #pause-btn, [data-v21-hud-toggle]');
    if (!action) return;
    lightHaptic(action.id === 'fire-btn' ? 5 : 9);
  }, true);
}

function installImmersiveLaunch() {
  document.addEventListener('click', (event) => {
    if (!touchLayout() || document.fullscreenElement) return;
    const launch = event.target.closest('#start-btn, #restart-btn');
    if (!launch || !document.fullscreenEnabled) return;
    try {
      const request = document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
      request?.catch?.(() => {});
    } catch {}
  }, true);
}

ensureFlightSurface();
installActionHaptics();
installImmersiveLaunch();
syncPremiumState();

window.setInterval(syncPremiumState, 320);
window.addEventListener('resize', syncPremiumState);
window.addEventListener('pageshow', syncPremiumState);
window.addEventListener('blur', () => {
  flight.pointerId = null;
  flight.targetX = 0;
  flight.targetY = 0;
  flight.currentX = 0;
  flight.currentY = 0;
  flight.surface?.classList.remove('engaged');
  setStickVisual(0, 0);
});
