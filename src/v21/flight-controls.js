import * as THREE from 'three';

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
const EDGE_SOFT_ZONE = 1.15;
const EDGE_CONTACT_ZONE = 0.12;
const ENVELOPE_REFRESH_MS = 160;
const SHIP_FRAME_MARGIN = 0.26;
const SAFE_NDC = Object.freeze({ left: -0.94, right: 0.94, bottom: -0.89, top: 0.88 });

const tmpBox = new THREE.Box3();
const tmpSize = new THREE.Vector3();
const tmpNear = new THREE.Vector3();
const tmpFar = new THREE.Vector3();
const tmpDirection = new THREE.Vector3();

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
  edgeContact: false,
  surface: null,
  stick: null,
  knob: null,
  envelope: {
    ship: null,
    updatedAt: 0,
    halfX: 1.8,
    halfY: 1.2,
  },
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
  return clamp(normalized * 0.72 + Math.pow(normalized, 1.72) * 0.28, 0, 1);
}

function lightHaptic(duration = 7) {
  const now = performance.now();
  if (now - flight.lastHaptic < 55) return;
  flight.lastHaptic = now;
  try { navigator.vibrate?.(duration); } catch {}
}

function setBoundaryFeedback(active) {
  const next = Boolean(active);
  flight.stick?.classList.toggle('is-edge', next);
  if (next && !flight.edgeContact) lightHaptic(2);
  flight.edgeContact = next;
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

function resetSteeringVisual({ hard = false } = {}) {
  flight.pointerId = null;
  flight.targetX = 0;
  flight.targetY = 0;
  flight.power = 0;
  flight.fullThrow = false;
  flight.surface?.classList.remove('engaged');
  setBoundaryFeedback(false);
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
  setBoundaryFeedback(false);
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
    flight.envelope.updatedAt = 0;
  } else if (!playing && premiumApplied) {
    ship.scale.multiplyScalar(1 / PREMIUM_SCALE);
    ship.userData.v21PremiumScaleApplied = false;
    flight.envelope.updatedAt = 0;
  }
}

function refreshShipEnvelope(g) {
  const ship = g?.ship;
  const now = performance.now();
  if (!ship) return flight.envelope;
  if (flight.envelope.ship === ship && now - flight.envelope.updatedAt < ENVELOPE_REFRESH_MS) return flight.envelope;

  try {
    ship.updateWorldMatrix?.(true, true);
    tmpBox.setFromObject(ship);
    tmpBox.getSize(tmpSize);
    const halfX = clamp(tmpSize.x * 0.5 + SHIP_FRAME_MARGIN, 0.8, 5.2);
    const halfY = clamp(tmpSize.y * 0.5 + SHIP_FRAME_MARGIN, 0.62, 3.8);
    if (Number.isFinite(halfX) && Number.isFinite(halfY)) {
      flight.envelope = { ship, updatedAt: now, halfX, halfY };
    }
  } catch {
    flight.envelope.ship = ship;
    flight.envelope.updatedAt = now;
  }
  return flight.envelope;
}

function intersectCameraRayAtZ(camera, ndcX, ndcY, z) {
  tmpNear.set(ndcX, ndcY, -1).unproject(camera);
  tmpFar.set(ndcX, ndcY, 1).unproject(camera);
  tmpDirection.subVectors(tmpFar, tmpNear);
  if (Math.abs(tmpDirection.z) < 1e-5) return null;
  const t = (z - tmpNear.z) / tmpDirection.z;
  if (!Number.isFinite(t) || t < 0) return null;
  return {
    x: tmpNear.x + tmpDirection.x * t,
    y: tmpNear.y + tmpDirection.y * t,
  };
}

function cameraFlightBounds(g) {
  const ship = g?.ship;
  const camera = g?.camera;
  if (!ship?.position || !camera?.isCamera) return WORLD;

  camera.updateMatrixWorld?.(true);
  const z = ship.position.z;
  const corners = [
    intersectCameraRayAtZ(camera, SAFE_NDC.left, SAFE_NDC.bottom, z),
    intersectCameraRayAtZ(camera, SAFE_NDC.left, SAFE_NDC.top, z),
    intersectCameraRayAtZ(camera, SAFE_NDC.right, SAFE_NDC.bottom, z),
    intersectCameraRayAtZ(camera, SAFE_NDC.right, SAFE_NDC.top, z),
  ].filter(Boolean);

  if (corners.length !== 4) return WORLD;

  const envelope = refreshShipEnvelope(g);
  const rawMinX = Math.min(...corners.map((point) => point.x));
  const rawMaxX = Math.max(...corners.map((point) => point.x));
  const rawMinY = Math.min(...corners.map((point) => point.y));
  const rawMaxY = Math.max(...corners.map((point) => point.y));

  let xMin = Math.max(WORLD.xMin, rawMinX + envelope.halfX);
  let xMax = Math.min(WORLD.xMax, rawMaxX - envelope.halfX);
  let yMin = Math.max(WORLD.yMin, rawMinY + envelope.halfY);
  let yMax = Math.min(WORLD.yMax, rawMaxY - envelope.halfY);

  if (xMin > xMax) {
    const center = clamp((rawMinX + rawMaxX) * 0.5, WORLD.xMin, WORLD.xMax);
    xMin = center;
    xMax = center;
  }
  if (yMin > yMax) {
    const center = clamp((rawMinY + rawMaxY) * 0.5, WORLD.yMin, WORLD.yMax);
    yMin = center;
    yMax = center;
  }

  return { xMin, xMax, yMin, yMax };
}

function smoothEdgeFactor(distance) {
  const t = clamp(distance / EDGE_SOFT_ZONE, 0, 1);
  return t * t * (3 - 2 * t);
}

function edgeAwareAxis(position, axis, min, max) {
  if (axis < 0) return axis * smoothEdgeFactor(position - min);
  if (axis > 0) return axis * smoothEdgeFactor(max - position);
  return 0;
}

function enforceVisibleBounds(g, bounds = cameraFlightBounds(g)) {
  const ship = g?.ship;
  if (!ship?.position) return bounds;
  ship.position.x = clamp(ship.position.x, bounds.xMin, bounds.xMax);
  ship.position.y = clamp(ship.position.y, bounds.yMin, bounds.yMax);
  return bounds;
}

function installGameHook() {
  const g = game();
  if (!g || typeof g.updatePlaying !== 'function' || flight.hookedGame === g) return;
  const baseUpdate = g.updatePlaying.bind(g);
  flight.hookedGame = g;
  flight.baseUpdate = baseUpdate;

  const wrapped = (delta, elapsed, ...args) => {
    const activeTouch = touchLayout();
    let bounds = null;

    if (activeTouch) {
      bounds = cameraFlightBounds(g);
      enforceVisibleBounds(g, bounds);

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

          x = edgeAwareAxis(ship.position.x, x, bounds.xMin, bounds.xMax);
          y = edgeAwareAxis(ship.position.y, y, bounds.yMin, bounds.yMax);
          ship.position.x += x * speed * delta;
          ship.position.y += y * speed * delta;
          enforceVisibleBounds(g, bounds);
        }
      }
    }

    const result = baseUpdate(delta, elapsed, ...args);

    if (activeTouch) {
      bounds = enforceVisibleBounds(g, cameraFlightBounds(g));
      const ship = g.ship;
      const touchingEdge = Boolean(ship?.position) && (
        (flight.currentX < -0.04 && ship.position.x <= bounds.xMin + EDGE_CONTACT_ZONE)
        || (flight.currentX > 0.04 && ship.position.x >= bounds.xMax - EDGE_CONTACT_ZONE)
        || (flight.currentY < -0.04 && ship.position.y <= bounds.yMin + EDGE_CONTACT_ZONE)
        || (flight.currentY > 0.04 && ship.position.y >= bounds.yMax - EDGE_CONTACT_ZONE)
      );
      setBoundaryFeedback(touchingEdge && flight.pointerId !== null);
    } else {
      setBoundaryFeedback(false);
    }

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

  if (usable) enforceVisibleBounds(g);
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

function invalidateSafeFrame() {
  flight.envelope.updatedAt = 0;
  const g = game();
  if (g?.state === 'playing' && touchLayout()) enforceVisibleBounds(g);
}

ensureFlightSurface();
installActionHaptics();
installImmersiveLaunch();
syncPremiumState();

window.setInterval(syncPremiumState, 320);
window.addEventListener('resize', () => {
  invalidateSafeFrame();
  syncPremiumState();
});
window.addEventListener('orientationchange', invalidateSafeFrame);
window.addEventListener('pageshow', () => {
  invalidateSafeFrame();
  syncPremiumState();
});
window.addEventListener('blur', () => resetSteeringVisual({ hard: true }));
