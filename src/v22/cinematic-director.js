const $ = (selector, root = document) => root.querySelector(selector);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const RAID_KEY = 'wae_neon_rider_v19_raid_profile';
const CALLSIGN_KEY = 'wae_neon_rider_callsign';
const LIVEOPS_KEY = 'wae_neon_rider_v20_liveops_profile';

const reducedMotion = matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

function safeJson(key, fallback = {}) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch { return fallback; }
}

function game() { return window.__waeNeonRiderGame; }

function haptic(pattern) {
  try { navigator.vibrate?.(pattern); } catch {}
}

function pilotIdentity() {
  const live = safeJson(LIVEOPS_KEY, {});
  const cosmetic = live.cosmetic && typeof live.cosmetic === 'object' ? live.cosmetic : {};
  return {
    callsign: String(localStorage.getItem(CALLSIGN_KEY) || 'PILOTO').slice(0, 18),
    title: String(cosmetic.title || 'PILOT').slice(0, 24),
    frame: String(cosmetic.frame || 'STANDARD').slice(0, 24),
  };
}

function latestRelic() {
  const raid = safeJson(RAID_KEY, {});
  const item = Array.isArray(raid.history) ? raid.history[0] : null;
  if (!item || Date.now() - Number(item.at || 0) > 12000) return null;
  return {
    relic: String(item.relic || 'RAID RELIC'),
    rarity: String(item.rarityName || item.rarity || 'RARE').toUpperCase(),
  };
}

function ensureCinematicLayer() {
  let layer = $('#v22-cinematic');
  if (layer) return layer;
  layer = document.createElement('div');
  layer.id = 'v22-cinematic';
  layer.className = 'v22-cinematic';
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = '<div class="v22-cine-copy"><span data-v22-kicker>WAE FLIGHT SYSTEM</span><strong data-v22-title>LAUNCH</strong><small data-v22-subtitle>VECTOR LOCKED</small><div class="v22-cine-line"></div></div>';
  document.body.append(layer);
  return layer;
}

async function showSequence({ kicker, title, subtitle, duration = 900 }) {
  const layer = ensureCinematicLayer();
  $('[data-v22-kicker]', layer).textContent = kicker;
  $('[data-v22-title]', layer).textContent = title;
  $('[data-v22-subtitle]', layer).textContent = subtitle;
  layer.classList.add('show');
  layer.setAttribute('aria-hidden', 'false');
  const actual = reducedMotion ? Math.min(180, duration) : duration;
  await new Promise((resolve) => setTimeout(resolve, actual));
  layer.classList.remove('show');
  layer.setAttribute('aria-hidden', 'true');
  if (!reducedMotion) await new Promise((resolve) => setTimeout(resolve, 170));
}

function ensureFlightId() {
  let card = $('#v22-flight-id');
  if (card) return card;
  card = document.createElement('div');
  card.id = 'v22-flight-id';
  card.className = 'v22-flight-id';
  card.innerHTML = '<strong data-v22-flight-name>PILOTO</strong><span data-v22-flight-meta>CINEMATIC FLIGHT LINK</span>';
  document.body.append(card);
  return card;
}

function showFlightId() {
  const id = pilotIdentity();
  const card = ensureFlightId();
  $('[data-v22-flight-name]', card).textContent = id.callsign;
  $('[data-v22-flight-meta]', card).textContent = `${id.title} · ${id.frame} · FLIGHT LINK`;
  card.classList.add('show');
  clearTimeout(showFlightId.timer);
  showFlightId.timer = setTimeout(() => card.classList.remove('show'), reducedMotion ? 700 : 1800);
}

function ensureAudioBadge() {
  let badge = $('#v22-audio-badge');
  if (badge) return badge;
  badge = document.createElement('div');
  badge.id = 'v22-audio-badge';
  badge.className = 'v22-audio-badge';
  badge.innerHTML = '<b>ADAPTIVE AUDIO</b> · <span data-v22-audio-state>CRUISE</span>';
  document.body.append(badge);
  return badge;
}

function updateAudioBadge(label, visible = true) {
  const badge = ensureAudioBadge();
  $('[data-v22-audio-state]', badge).textContent = label;
  badge.classList.toggle('show', visible);
}

function ensureVictoryCard() {
  let card = $('#v22-victory');
  if (card) return card;
  card = document.createElement('div');
  card.id = 'v22-victory';
  card.className = 'v22-victory';
  card.innerHTML = '<span data-v22-v-kicker>GUARDIAN ELIMINATED</span><strong data-v22-v-title>SECTOR SECURED</strong><small data-v22-v-sub>COMBAT DIRECTOR CONFIRMED</small><i></i>';
  document.body.append(card);
  return card;
}

function showVictory() {
  const card = ensureVictoryCard();
  const relic = latestRelic();
  $('[data-v22-v-kicker]', card).textContent = relic ? `${relic.rarity} RELIC ACQUIRED` : 'GUARDIAN ELIMINATED';
  $('[data-v22-v-title]', card).textContent = relic?.relic || 'SECTOR SECURED';
  $('[data-v22-v-sub]', card).textContent = relic ? 'RAID VAULT UPDATED · CINEMATIC CONFIRMATION' : 'COMBAT DIRECTOR CONFIRMED';
  card.classList.add('show');
  clearTimeout(showVictory.timer);
  showVictory.timer = setTimeout(() => card.classList.remove('show'), reducedMotion ? 850 : 2100);
}

function installHangarLaunch() {
  const foot = $('#v21-identity-hangar .v21-foot');
  if (!foot || foot.querySelector('[data-v22-launch]')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'v22-hangar-launch';
  button.dataset.v22Launch = 'true';
  button.innerHTML = '<span>◆</span> CINEMATIC LAUNCH';
  foot.prepend(button);
}

class AdaptiveScore {
  constructor(targetGame) {
    this.game = targetGame;
    this.context = null;
    this.master = null;
    this.layers = [];
    this.ready = false;
    this.lastBeat = 0;
    this.scene = 'CRUISE';
    this.intensity = 0;
  }

  async ensure() {
    if (this.ready) return true;
    await this.game?.audio?.unlock?.();
    const ctx = this.game?.audio?.context;
    if (!ctx) return false;
    this.context = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.0001;
    this.master.connect(ctx.destination);

    const definitions = [
      { type: 'sine', freq: 44, gain: 0.016, filter: 180 },
      { type: 'triangle', freq: 88, gain: 0.011, filter: 420 },
      { type: 'sine', freq: 176, gain: 0.006, filter: 1200 },
    ];

    for (const def of definitions) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      oscillator.type = def.type;
      oscillator.frequency.value = def.freq;
      gain.gain.value = 0.0001;
      filter.type = 'lowpass';
      filter.frequency.value = def.filter;
      oscillator.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      oscillator.start();
      this.layers.push({ oscillator, gain, filter, baseFreq: def.freq, baseGain: def.gain });
    }
    this.ready = true;
    return true;
  }

  pulse(kind = 'beat', amount = 1) {
    if (!this.ready || !this.context || !this.game?.audio?.enabled) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    const isVictory = kind === 'victory';
    osc.type = isVictory ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isVictory ? 220 : 58, now);
    osc.frequency.exponentialRampToValueAtTime(isVictory ? 660 : 38, now + (isVictory ? .34 : .12));
    filter.type = 'lowpass';
    filter.frequency.value = isVictory ? 1800 : 220;
    gain.gain.setValueAtTime((isVictory ? .05 : .022) * clamp(amount, .4, 1.8), now);
    gain.gain.exponentialRampToValueAtTime(.0001, now + (isVictory ? .38 : .16));
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + (isVictory ? .4 : .18));
  }

  async start() {
    if (!(await this.ensure())) return;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(this.game?.audio?.enabled ? .72 : .0001, now, .18);
  }

  setMix(intensity, scene) {
    if (!this.ready || !this.context) return;
    this.intensity = clamp(intensity, 0, 1);
    this.scene = scene;
    const now = this.context.currentTime;
    const enabled = Boolean(this.game?.audio?.enabled);
    this.master.gain.setTargetAtTime(enabled ? .72 : .0001, now, .14);
    const sceneBoost = scene === 'GUARDIAN' ? 1.22 : scene === 'OVERDRIVE' ? 1.35 : 1;
    this.layers.forEach((layer, index) => {
      const targetGain = enabled ? layer.baseGain * (0.52 + this.intensity * sceneBoost) * (1 + index * this.intensity * .18) : .0001;
      layer.gain.gain.setTargetAtTime(Math.max(.0001, targetGain), now, .18);
      const pitch = layer.baseFreq * (1 + this.intensity * .18 + (scene === 'GUARDIAN' ? .08 : 0));
      layer.oscillator.frequency.setTargetAtTime(pitch, now, .22);
      layer.filter.frequency.setTargetAtTime(220 + index * 420 + this.intensity * 900, now, .22);
    });

    const beatGap = 920 - this.intensity * 470;
    const stamp = performance.now();
    if (enabled && this.intensity > .24 && stamp - this.lastBeat >= beatGap) {
      this.lastBeat = stamp;
      this.pulse('beat', .65 + this.intensity * .65);
    }
  }

  quiet() {
    if (!this.ready || !this.context) return;
    const now = this.context.currentTime;
    this.master.gain.setTargetAtTime(.0001, now, .18);
  }

  victory() {
    if (!this.ready) return;
    this.pulse('victory', 1.2);
    setTimeout(() => this.pulse('victory', .75), 180);
  }
}

const director = {
  installed: false,
  target: null,
  score: null,
  baseFov: null,
  baseRoll: null,
  lastSync: 0,
  guardianActive: false,
  observer: null,
};

function currentScene(g) {
  if ((g?.overdriveTimer || 0) > 0) return 'OVERDRIVE';
  if (g?.boss || g?.currentGuardian || $('#v19-raid-hud:not(.hidden)')) return 'GUARDIAN';
  return 'CRUISE';
}

function intensityFor(g) {
  const drones = Array.isArray(g?.drones) ? g.drones.length : 0;
  const bullets = Array.isArray(g?.enemyBullets) ? g.enemyBullets.length : 0;
  const heat = clamp(Number(g?.heat) || 0, 0, 100) / 100;
  const shieldMax = Math.max(1, Number(g?.getMaxShield?.() || g?.maxShield || 100));
  const shield = clamp(Number(g?.shield) || shieldMax, 0, shieldMax) / shieldMax;
  const danger = 1 - shield;
  const boss = currentScene(g) === 'GUARDIAN' ? .28 : 0;
  return clamp(.12 + drones * .055 + bullets * .012 + heat * .3 + danger * .18 + boss, .08, 1);
}

function syncCamera(g, intensity) {
  const camera = g?.camera;
  if (!camera?.isPerspectiveCamera) return;
  if (director.baseFov == null) director.baseFov = Number(camera.fov) || 58;
  if (director.baseRoll == null) director.baseRoll = Number(camera.rotation?.z) || 0;
  const xInput = Number(g?.input?.right) - Number(g?.input?.left);
  const targetFov = reducedMotion ? director.baseFov : director.baseFov + intensity * 2.15 + ((g?.overdriveTimer || 0) > 0 ? 1.35 : 0);
  camera.fov += (targetFov - camera.fov) * .055;
  if (camera.rotation) {
    const targetRoll = director.baseRoll + (reducedMotion ? 0 : -xInput * .012);
    camera.rotation.z += (targetRoll - camera.rotation.z) * .08;
  }
  camera.updateProjectionMatrix?.();
}

function syncDirector(g) {
  const stamp = performance.now();
  const intensity = intensityFor(g);
  syncCamera(g, intensity);
  if (stamp - director.lastSync < 180) return;
  director.lastSync = stamp;
  const scene = currentScene(g);
  director.score?.setMix(intensity, scene);
  updateAudioBadge(`${scene} · ${Math.round(intensity * 100)}%`, g?.state === 'playing');

  const guardianNow = scene === 'GUARDIAN';
  if (guardianNow && !director.guardianActive) {
    director.guardianActive = true;
    haptic([22, 30, 45]);
    director.score?.pulse('beat', 1.35);
  }
  if (!guardianNow) director.guardianActive = false;
}

function installWrappers(g) {
  if (!g || g.__waeV22CinematicInstalled) return;
  g.__waeV22CinematicInstalled = true;
  director.target = g;
  director.score = new AdaptiveScore(g);

  const baseStart = g.start?.bind(g);
  if (baseStart) g.start = async (...args) => {
    const id = pilotIdentity();
    await director.score.start();
    haptic([18, 36, 24]);
    await showSequence({ kicker: `${id.callsign} · FLIGHT AUTHORIZED`, title: 'LAUNCH', subtitle: 'VECTOR LOCKED · CINEMATIC DRIVE ONLINE', duration: 780 });
    const result = await baseStart(...args);
    director.baseFov = Number(g.camera?.fov) || director.baseFov;
    director.baseRoll = Number(g.camera?.rotation?.z) || 0;
    showFlightId();
    updateAudioBadge('CRUISE · 12%', true);
    return result;
  };

  const baseUpdate = g.updatePlaying?.bind(g);
  if (baseUpdate) g.updatePlaying = (delta, elapsed) => {
    const result = baseUpdate(delta, elapsed);
    if (g.state === 'playing') syncDirector(g);
    return result;
  };

  const baseDamage = g.damageShip?.bind(g);
  if (baseDamage) g.damageShip = (damage, position) => {
    const before = Number(g.shield) || 0;
    const result = baseDamage(damage, position);
    const taken = Math.max(0, before - (Number(g.shield) || 0));
    if (taken > 0) {
      haptic(taken > 24 ? [18, 24, 24] : 12);
      director.score?.pulse('beat', .55 + Math.min(1, taken / 30));
    }
    return result;
  };

  const baseDefeatBoss = g.defeatBoss?.bind(g);
  if (baseDefeatBoss) g.defeatBoss = (...args) => {
    const result = baseDefeatBoss(...args);
    haptic([36, 34, 70, 45, 100]);
    director.score?.victory();
    setTimeout(showVictory, 280);
    return result;
  };

  const baseEnd = g.endGame?.bind(g);
  if (baseEnd) g.endGame = (...args) => {
    const result = baseEnd(...args);
    director.score?.quiet();
    updateAudioBadge('SIGNAL CLOSED', false);
    if (g.camera?.isPerspectiveCamera && director.baseFov != null) {
      g.camera.fov = director.baseFov;
      if (g.camera.rotation && director.baseRoll != null) g.camera.rotation.z = director.baseRoll;
      g.camera.updateProjectionMatrix?.();
    }
    return result;
  };

  window.addEventListener('pagehide', () => director.score?.quiet(), { once: true });
}

function watchHangar() {
  if (director.observer) return;
  director.observer = new MutationObserver(() => installHangarLaunch());
  director.observer.observe(document.body, { childList: true, subtree: true });
  installHangarLaunch();
}

function waitForGame(attempt = 0) {
  const g = game();
  if (g) {
    installWrappers(g);
    watchHangar();
    return;
  }
  if (attempt < 120) requestAnimationFrame(() => waitForGame(attempt + 1));
}

export function installCinematicDirector() {
  if (director.installed) return;
  director.installed = true;
  ensureCinematicLayer();
  ensureFlightId();
  ensureAudioBadge();
  ensureVictoryCard();
  waitForGame();
}

installCinematicDirector();
