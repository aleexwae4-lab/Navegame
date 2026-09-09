const $ = (selector, root = document) => root.querySelector(selector);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const BASE_SHIP_SPEED = 22;
const WORLD = Object.freeze({ xMin: -16, xMax: 16, yMin: -9.5, yMax: 9.5 });
const STICK_RADIUS = 52;
const DEADZONE = 0.045;
const STEERING_ZONE_RATIO = 0.60;
const STEERING_RIGHT_GUTTER = 164;
const RELEASE_RESPONSE = 24;
const ELASTIC_START = 1.08;
const ELASTIC_GAIN = 0.38;
const ELASTIC_MAX_SHIFT = 14;
const FULL_THROW_ENTER = 0.93;
const FULL_THROW_EXIT = 0.78;
const PREMIUM_SCALE = 0.94;

const flight = {
  pointerId: null,
  originX: 0,
  originY: 0,
  targetX: 0,
  targetY: 0,
  currentX: 0,
  currentY: 0,
  power: 0,
  hookedGame: null,
  baseUpdate: null,
  lastHaptic: 0,
  fullThrow: false,
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

function steeringZoneLimit() {
  const ratioLimit = window.innerWidth * STEERING_ZONE_RATIO;
  const actionClearance = window.innerWidth - STEERING_RIGHT_GUTTER;
  return Math.max(136, Math.min(ratioLimit, actionClearance));
}

function shipSpeedMultiplier(g) {
  const selected = g?.getShip?.() || {};
  const value = Number(selected.speed);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function radialResponse(magnitude) {
  if (magnitude <= DEADZONE) return 0;
  const normalized = clamp((magnitude - DEADZONE) / (1 - DEADZONE), 0, 1);
  // Low throw stays precise while the outer half ramps decisively to full speed.
  return clamp(normalized * 0.72 + Math.pow(normalized, 1.72) * 0.28, 0, 1);
}

function setStickVisual(dx = 0, dy = 0, power = 0) {
  if (!flight.knob || !flight.stick) return;
  flight.knob.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
  flight.stick.style.setProperty('--v21-stick-power', String(clamp(power, 0, 1)));
  const full = power >= FULL_THROW_ENTER || (flight.fullThrow && power > FULL_THROW_EXIT);
  flight.stick.classList.toggle('is-full', full);
  if (full && !flight.fullThrow) lightHaptic(3);
  flight.fullThrow = full;
}

function setStickOrigin(x, y) {
  if (!flight.stick) return;
  flight.stick.style.left = `${x}px`;
  flight.stick.style.top = `${y}px`;
}

function shiftOriginTowardFinger(rawX, rawY, distance) {
  const threshold = STICK_RADIUS * ELASTIC_START;
  if (distance <= threshold || distance <= 0) return;
  const excess = distance - threshold;
  const shift = Math.min(ELASTIC_MAX_SHIFT, excess * ELASTIC_GAIN);
  const dirX = rawX / distance;
  const dirY = rawY / distance;
  flight.originX = clamp(flight.originX + dirX * shift, 0, steeringZoneLimit());
  flight.originY = clamp(flight.originY + dirY * shift, 112, window.innerHeight);
  setStickOrigin(flight.originX, flight.originY);
}

function updateTarget(clientX, clientY) {
  let rawX = clientX - flight.originX;
  let rawY = clientY - flight.originY;
  let distance = Math.hypot(rawX, rawY);

  shiftOriginTowardFinger(rawX, rawY, distance);
  rawX = clientX - flight.originX;
  rawY = clientY - flight.originY;
  distance = Math.hypot(rawX, rawY);

  const visualScale = distance > STICK_RADIUS ? STICK_RADIUS / distance : 1;
  const dx = rawX * visualScale;
  const dy = rawY * visualScale;
  const physicalMagnitude = clamp(distance / STICK_RADIUS, 0, 1);
  const power = radialResponse(physicalMagnitude);

  if (distance <= 0 || power <= 0) {
    flight.targetX = 0;
    flight.targetY = 0;
    flight.power = 0;
    setStickVisual(0, 0, 0);
    return;
  }

  flight.targetX = (rawX / distance) * power;
  flight.targetY = (-rawY / distance) * power;
  flight.power = power;
  setStickVisual(dx, dy, power);
}

function latestPointerSample(event) {
  const samples = event.getCoalescedEvents?.();
  return samples?.length ? samples[samples.length - 1] : event;
}

function lightHaptic(duration = 7) {
  const now = performance.now();
  if (now - flight.lastHaptic < 55) return;
  flight.lastHaptic = now;
  try { navigator.vibrate?.(duration); } catch {}
}

function resetSteeringVisual({ hard = false } = {}) {
  flight.pointerId = null;
  flight.targetX = 0;
  flight.targetY = 0;
  flight.power = 0;
  flight.fullThrow = false;
  flight.surface?.classList.remove('engaged');
  setStickVisual(0, 0, 0);
  if (hard) {
    flight.currentX = 0;
    flight.currentY = 0;
  }
}

function beginSteering(event) {
  const g = game();
  if (event.pointerType !== 'touch' || g?.state !== 'playing' || flight.pointerId !== null) return;
  if (event.clientX > steeringZoneLimit()) return;

  flight.pointerId = event.pointerId;
  flight.originX = event.clientX;
  flight.originY = event.clientY;
  flight.targetX = 0;
  flight.targetY = 0;
  flight.power = 0;
  flight.fullThrow = false;
  setStickOrigin(flight.originX, flight.originY);
  setStickVisual(0, 0, 0);
  flight.surface.classList.add('engaged');
  flight.surface.setPointerCapture?.(event.pointerId);
  lightHaptic(4);
  event.preventDefault();
}

function moveSteering(event) {
  if (event.pointerId !== flight.pointerId) return;
  const sample = latestPointerSample(event);
  updateTarget(sample.clientX, sample.clientY);
  event.preventDefault();
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

  surface.addEventListener('pointerdown', beginSteering, { passive: false });
  surface.addEventListener('pointermove', moveSteering, { passive: false });
  if ('onpointerrawupdate' in window) surface.addEventListener('pointerrawupdate', moveSteering, { passive: false });

  const end = (event) => {
    if (event.pointerId !== flight.pointerId) return;
    resetSteeringVisual();
    event.preventDefault();
  };
  surface.addEventListener('pointerup', end, { passive: false });
  surface.addEventListener('pointercancel', end, { passive: false });
  surface.addEventListener('lostpointercapture', (event) => {
    if (event.pointerId === flight.pointerId) resetSteeringVisual();
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
      const targetMagnitude = Math.hypot(flight.targetX, flight.targetY);
      const reversingX = flight.targetX && flight.currentX && Math.sign(flight.targetX) !== Math.sign(flight.currentX);
      const reversingY = flight.targetY && flight.currentY && Math.sign(flight.targetY) !== Math.sign(flight.currentY);
      const responseRate = flight.pointerId === null
        ? RELEASE_RESPONSE
        : reversingX || reversingY
          ? 39
          : 34 - targetMagnitude * 6;
      const responsiveness = 1 - Math.exp(-responseRate * Math.min(delta, 0.05));
      flight.currentX += (flight.targetX - flight.currentX) * responsiveness;
      flight.currentY += (flight.targetY - flight.currentY) * responsiveness;

      if (Math.abs(flight.currentX) < 0.0015) flight.currentX = 0;
      if (Math.abs(flight.currentY) < 0.0015) flight.currentY = 0;

      if (flight.pointerId !== null || Math.abs(flight.currentX) + Math.abs(flight.currentY) > 0.005) {
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

    if (activeTouch && g.ship?.rotation && (flight.pointerId !== null || Math.abs(flight.currentX) + Math.abs(flight.currentY) > 0.005)) {
      const magnitude = clamp(Math.hypot(flight.currentX, flight.currentY), 0, 1);
      const rollTarget = -flight.currentX * (0.32 + magnitude * 0.07);
      const pitchTarget = flight.currentY * (0.15 + magnitude * 0.035);
      const attitudeResponse = 1 - Math.exp(-17 * delta);
      g.ship.rotation.z += (rollTarget - g.ship.rotation.z) * attitudeResponse;
      g.ship.rotation.x += (pitchTarget - g.ship.rotation.x) * attitudeResponse;
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

  if (!usable && flight.pointerId !== null) resetSteeringVisual({ hard: true });
}

function installActionHaptics() {
  document.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch') return;
    const action = event.target.closest('#fire-btn, #dash-btn, #missile-btn, #secondary-btn, #pause-btn, [data-v21-hud-toggle]');
    if (!action) return;
    lightHaptic(action.id === 'fire-btn' ? 4 : 8);
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
window.addEventListener('blur', () => resetSteeringVisual({ hard: true }));
