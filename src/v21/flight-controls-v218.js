const $ = (selector, root = document) => root.querySelector(selector);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const BASE_SHIP_SPEED = 22;
const WORLD = Object.freeze({ xMin: -16, xMax: 16, yMin: -9.5, yMax: 9.5 });
const PREMIUM_SCALE = 0.94;
const DEADZONE = 0.055;
const FULL_THROW_ENTER = 0.94;
const FULL_THROW_EXIT = 0.82;
const STEERING_ZONE_RATIO = 0.62;
const STEERING_RIGHT_GUTTER = 154;
const RESPONSE_ENGAGED = 27;
const RESPONSE_REVERSAL = 44;
const RESPONSE_RELEASE = 38;

const flight = {
  pointerId: null,
  originX: 0,
  originY: 0,
  targetX: 0,
  targetY: 0,
  currentX: 0,
  currentY: 0,
  power: 0,
  fullThrow: false,
  hookedGame: null,
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

function steeringZoneLimit() {
  const ratioLimit = window.innerWidth * STEERING_ZONE_RATIO;
  const actionClearance = window.innerWidth - STEERING_RIGHT_GUTTER;
  return Math.max(148, Math.min(ratioLimit, actionClearance));
}

function stickRadius() {
  // More physical travel on larger phones improves precision without making
  // compact devices feel sluggish.
  return clamp(Math.min(window.innerWidth, window.innerHeight) * 0.175, 62, 74);
}

function shipSpeedMultiplier(g) {
  const selected = g?.getShip?.() || {};
  const value = Number(selected.speed);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function radialResponse(magnitude) {
  if (magnitude <= DEADZONE) return 0;
  const normalized = clamp((magnitude - DEADZONE) / (1 - DEADZONE), 0, 1);
  // Fine control around center, increasingly assertive response in the outer
  // half, then a clean full-speed plateau.
  const curved = Math.pow(normalized, 1.22);
  return clamp(curved * 0.82 + normalized * 0.18, 0, 1);
}

function lightHaptic(duration = 5) {
  const now = performance.now();
  if (now - flight.lastHaptic < 65) return;
  flight.lastHaptic = now;
  try { navigator.vibrate?.(duration); } catch {}
}

function setStickOrigin(x, y) {
  if (!flight.stick) return;
  flight.stick.style.left = `${x}px`;
  flight.stick.style.top = `${y}px`;
}

function setStickVisual(dx = 0, dy = 0, power = 0) {
  if (!flight.knob || !flight.stick) return;
  flight.knob.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
  flight.stick.style.setProperty('--v21-stick-power', String(clamp(power, 0, 1)));
  const full = power >= FULL_THROW_ENTER || (flight.fullThrow && power > FULL_THROW_EXIT);
  flight.stick.classList.toggle('is-full', full);
  if (full && !flight.fullThrow) lightHaptic(2);
  flight.fullThrow = full;
}

function updateTarget(clientX, clientY) {
  const rawX = clientX - flight.originX;
  const rawY = clientY - flight.originY;
  const distance = Math.hypot(rawX, rawY);
  const radius = stickRadius();
  const visualScale = distance > radius && distance > 0 ? radius / distance : 1;
  const dx = rawX * visualScale;
  const dy = rawY * visualScale;
  const magnitude = clamp(distance / radius, 0, 1);
  const power = radialResponse(magnitude);

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

function resetSteering({ hard = false } = {}) {
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
  // Critical V21.8 behavior: the mathematical origin NEVER moves during the
  // gesture. The player's thumb always has one stable reference point.
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
    <div class="v21-flight-stick v218-stick" aria-hidden="true">
      <span class="v21-flight-ring"></span>
      <i class="v21-flight-knob"><b></b></i>
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
    resetSteering();
    event.preventDefault();
  };
  surface.addEventListener('pointerup', end, { passive: false });
  surface.addEventListener('pointercancel', end, { passive: false });
  surface.addEventListener('lostpointercapture', (event) => {
    if (event.pointerId === flight.pointerId) resetSteering();
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

  const wrapped = (delta, elapsed, ...args) => {
    const activeTouch = touchLayout();
    if (activeTouch) {
      const reversingX = flight.targetX && flight.currentX && Math.sign(flight.targetX) !== Math.sign(flight.currentX);
      const reversingY = flight.targetY && flight.currentY && Math.sign(flight.targetY) !== Math.sign(flight.currentY);
      const responseRate = flight.pointerId === null
        ? RESPONSE_RELEASE
        : reversingX || reversingY
          ? RESPONSE_REVERSAL
          : RESPONSE_ENGAGED;
      const blend = 1 - Math.exp(-responseRate * Math.min(delta, 0.05));
      flight.currentX += (flight.targetX - flight.currentX) * blend;
      flight.currentY += (flight.targetY - flight.currentY) * blend;

      if (Math.abs(flight.currentX) < 0.0012) flight.currentX = 0;
      if (Math.abs(flight.currentY) < 0.0012) flight.currentY = 0;

      if (flight.pointerId !== null || Math.abs(flight.currentX) + Math.abs(flight.currentY) > 0.004) {
        for (const direction of ['left', 'right', 'up', 'down']) g.setInput?.(direction, false);
        const ship = g.ship;
        if (ship?.position) {
          const speed = BASE_SHIP_SPEED * shipSpeedMultiplier(g);
          let x = flight.currentX;
          let y = flight.currentY;
          const length = Math.hypot(x, y);
          if (length > 1) { x /= length; y /= length; }

          // Original world limits are intentional. On portrait devices this
          // allows the ship to travel beyond the current camera framing and
          // preserves the sensation of a larger battlefield.
          ship.position.x = clamp(ship.position.x + x * speed * delta, WORLD.xMin, WORLD.xMax);
          ship.position.y = clamp(ship.position.y + y * speed * delta, WORLD.yMin, WORLD.yMax);
        }
      }
    }

    const result = baseUpdate(delta, elapsed, ...args);

    if (activeTouch && g.ship?.rotation && (flight.pointerId !== null || Math.abs(flight.currentX) + Math.abs(flight.currentY) > 0.004)) {
      const magnitude = clamp(Math.hypot(flight.currentX, flight.currentY), 0, 1);
      const rollTarget = -flight.currentX * (0.30 + magnitude * 0.10);
      const pitchTarget = flight.currentY * (0.14 + magnitude * 0.05);
      const attitudeBlend = 1 - Math.exp(-18 * Math.min(delta, 0.05));
      g.ship.rotation.z += (rollTarget - g.ship.rotation.z) * attitudeBlend;
      g.ship.rotation.x += (pitchTarget - g.ship.rotation.x) * attitudeBlend;
    }
    return result;
  };

  Object.defineProperty(wrapped, '__waeV218Analog', { value: true });
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
  if (!usable && flight.pointerId !== null) resetSteering({ hard: true });
}

function installActionHaptics() {
  document.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch') return;
    const action = event.target.closest('#fire-btn, #dash-btn, #missile-btn, #secondary-btn, #pause-btn, [data-v21-hud-toggle]');
    if (!action) return;
    lightHaptic(action.id === 'fire-btn' ? 3 : 7);
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
window.addEventListener('orientationchange', syncPremiumState);
window.addEventListener('pageshow', syncPremiumState);
window.addEventListener('blur', () => resetSteering({ hard: true }));
