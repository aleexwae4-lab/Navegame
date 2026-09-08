import * as THREE from 'three';

const $ = (selector, root = document) => root.querySelector(selector);
const PROFILE_KEY = 'wae_neon_rider_v23_world_profile';
const EVENT_GAP = 22;
const EVENT_SLOT_A = 10;
const EVENT_SLOT_B = 29;
const UI_TICK_MS = 120;

const EVENTS = Object.freeze([
  {
    id: 'solar', name: 'SOLAR TEMPEST', sigil: '☼', accent: '#fb923c', color: 0xfb923c,
    duration: 12, rarity: 'UNCOMMON', rewardCores: 1, rewardScore: 260,
    description: 'Una onda solar atraviesa el sector. La energía térmica aumenta y acelera el acceso a Overdrive.',
    mode: 'THERMAL SURGE',
  },
  {
    id: 'aurora', name: 'NEON AURORA', sigil: '◌', accent: '#34d399', color: 0x34d399,
    duration: 11, rarity: 'RARE', rewardCores: 1, rewardScore: 300,
    description: 'Partículas ionizadas estabilizan el casco. El escudo recupera energía mientras permanezcas operativo.',
    mode: 'SHIELD REGEN',
  },
  {
    id: 'ambush', name: 'WRAITH AMBUSH', sigil: '✦', accent: '#fb7185', color: 0xfb7185,
    duration: 14, rarity: 'ELITE', rewardCores: 2, rewardScore: 520,
    description: 'Firmas hostiles emergen sin aviso. El sector genera una oleada de élites sincronizada con la simulación host.',
    mode: 'ELITE CONTACT',
  },
  {
    id: 'rift', name: 'QUANTUM RIFT', sigil: '◎', accent: '#c084fc', color: 0xc084fc,
    duration: 12, rarity: 'LEGENDARY', rewardCores: 2, rewardScore: 650,
    description: 'Una fractura cuántica distorsiona el espacio. Mantener el vector estable concede una recompensa de exploración.',
    mode: 'RIFT STABILITY',
  },
  {
    id: 'salvage', name: 'SALVAGE CORRIDOR', sigil: '◇', accent: '#fde68a', color: 0xfde68a,
    duration: 10, rarity: 'UNCOMMON', rewardCores: 2, rewardScore: 420,
    description: 'Restos de tecnología WAE cruzan la ruta. Sobrevive al corredor para recuperar núcleos y datos de navegación.',
    mode: 'RECOVERY WINDOW',
  },
  {
    id: 'convoy', name: 'GHOST CONVOY', sigil: '△', accent: '#60a5fa', color: 0x60a5fa,
    duration: 13, rarity: 'RARE', rewardCores: 2, rewardScore: 560,
    description: 'Un convoy desconocido entra en tu vector perseguido por hostiles. Eliminar amenazas mejora la recompensa.',
    mode: 'ESCORT SIGNAL',
  },
]);

const state = {
  installed: false,
  raf: 0,
  lastFrame: performance.now(),
  uiTimer: 0,
  active: null,
  currentSector: 0,
  processed: new Set(),
  rig: null,
  atlasOpen: false,
  lastGameState: '',
  runElapsed: 0,
  hudTick: 0,
};

function game() { return window.__waeNeonRiderGame; }

function safeJson(key, fallback = {}) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch { return fallback; }
}

function defaultProfile() {
  return { discovered: [], totalEvents: 0, survived: 0, rareEvents: 0, bestSectorSeen: 1, lastEvent: '', updatedAt: 0 };
}

function loadProfile() {
  const raw = safeJson(PROFILE_KEY, {});
  return {
    ...defaultProfile(),
    ...raw,
    discovered: Array.isArray(raw.discovered) ? raw.discovered.filter((id) => EVENTS.some((event) => event.id === id)) : [],
  };
}

function saveProfile(profile) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch {}
}

function hashSeed(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function eventFor(sector, slot) {
  let pool = EVENTS;
  if (sector < 3) pool = EVENTS.filter((event) => event.id !== 'rift');
  const seed = hashSeed(`wae-v23|${sector}|${slot}`);
  let index = seed % pool.length;
  if (slot > 0) {
    const previous = eventFor(sector, slot - 1);
    if (pool[index].id === previous.id) index = (index + 1) % pool.length;
  }
  return pool[index];
}

function slotTime(sector, slot) {
  const seed = hashSeed(`wae-v23-time|${sector}|${slot}`);
  if (slot === 0) return EVENT_SLOT_A + (seed % 5);
  return EVENT_SLOT_B + (seed % 5);
}

function ensureUi() {
  let layer = $('#v23-world-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'v23-world-layer';
    layer.className = 'v23-world-layer';
    document.body.append(layer);
  }

  let card = $('#v23-event-card');
  if (!card) {
    card = document.createElement('aside');
    card.id = 'v23-event-card';
    card.className = 'v23-event-card';
    card.innerHTML = `
      <div class="v23-event-card__head">
        <div class="v23-event-card__sigil" data-v23-event-sigil>◎</div>
        <div class="v23-event-card__copy"><span data-v23-event-rarity>WORLD EVENT</span><strong data-v23-event-name>PHENOMENON</strong></div>
        <b class="v23-event-card__timer" data-v23-event-timer>0.0s</b>
      </div>
      <p data-v23-event-copy>Living universe signal.</p>
      <div class="v23-event-card__meter"><b data-v23-event-fill></b></div>`;
    document.body.append(card);
  }

  let flash = $('#v23-discovery-flash');
  if (!flash) {
    flash = document.createElement('div');
    flash.id = 'v23-discovery-flash';
    flash.className = 'v23-discovery-flash';
    flash.innerHTML = '<span>NEW PHENOMENON INDEXED</span><strong data-v23-discovery-name>DISCOVERY</strong><small data-v23-discovery-meta>WORLD ATLAS UPDATED</small>';
    document.body.append(flash);
  }
  return { layer, card, flash };
}

function ensureAtlas() {
  let atlas = $('#v23-world-atlas');
  if (atlas) return atlas;
  atlas = document.createElement('section');
  atlas.id = 'v23-world-atlas';
  atlas.className = 'v23-atlas hidden';
  atlas.setAttribute('aria-hidden', 'true');
  atlas.innerHTML = `
    <div class="v23-atlas-shell" role="dialog" aria-modal="true" aria-label="World Atlas">
      <header class="v23-atlas-head">
        <div class="v23-atlas-emblem">◎</div>
        <div><span>WAE LIVING UNIVERSE SYSTEM</span><strong>WORLD ATLAS</strong><small>PHENOMENA · EVENTS · EXPLORATION INTELLIGENCE</small></div>
        <button class="v23-atlas-close" type="button" data-v23-atlas-close aria-label="Cerrar">×</button>
      </header>
      <div class="v23-atlas-stats" data-v23-atlas-stats></div>
      <div class="v23-atlas-grid" data-v23-atlas-grid></div>
    </div>`;
  document.body.append(atlas);
  atlas.addEventListener('click', (event) => {
    if (event.target.closest('[data-v23-atlas-close]')) closeWorldAtlas();
  });
  return atlas;
}

function renderAtlas() {
  const atlas = ensureAtlas();
  const profile = loadProfile();
  const discovered = new Set(profile.discovered);
  const stats = $('[data-v23-atlas-stats]', atlas);
  const grid = $('[data-v23-atlas-grid]', atlas);
  if (stats) {
    stats.innerHTML = `
      <div><span>DISCOVERED</span><strong>${discovered.size}/${EVENTS.length}</strong></div>
      <div><span>EVENTS SEEN</span><strong>${profile.totalEvents}</strong></div>
      <div><span>SURVIVED</span><strong>${profile.survived}</strong></div>
      <div><span>DEEPEST SIGNAL</span><strong>S${profile.bestSectorSeen}</strong></div>`;
  }
  if (grid) {
    grid.replaceChildren(...EVENTS.map((event) => {
      const article = document.createElement('article');
      const unlocked = discovered.has(event.id);
      article.className = `v23-atlas-card${unlocked ? '' : ' locked'}`;
      article.style.setProperty('--phenomenon', event.accent);
      const name = unlocked ? event.name : 'UNKNOWN PHENOMENON';
      const copy = unlocked ? event.description : 'Continúa explorando sectores para indexar esta señal.';
      article.innerHTML = `<i>${unlocked ? event.sigil : '?'}</i><span>${unlocked ? event.rarity : 'UNINDEXED'}</span><strong>${name}</strong><p>${copy}</p><b>${unlocked ? event.mode : 'SIGNAL ENCRYPTED'}</b>`;
      return article;
    }));
  }
}

export function openWorldAtlas() {
  renderAtlas();
  const atlas = ensureAtlas();
  atlas.classList.remove('hidden');
  atlas.setAttribute('aria-hidden', 'false');
  state.atlasOpen = true;
}

export function closeWorldAtlas() {
  const atlas = $('#v23-world-atlas');
  atlas?.classList.add('hidden');
  atlas?.setAttribute('aria-hidden', 'true');
  state.atlasOpen = false;
}

function disposeObject(root) {
  root?.traverse?.((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((material) => material?.dispose?.());
    else child.material?.dispose?.();
  });
  root?.parent?.remove?.(root);
}

function createParticleField(group, color, count = 58) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = THREE.MathUtils.randFloatSpread(46);
    positions[i * 3 + 1] = THREE.MathUtils.randFloatSpread(28);
    positions[i * 3 + 2] = THREE.MathUtils.randFloat(-110, -18);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color, size: .22, transparent: true, opacity: .68, depthWrite: false, blending: THREE.AdditiveBlending });
  const points = new THREE.Points(geometry, material);
  points.userData.v23Points = true;
  group.add(points);
}

function createEventRig(event) {
  const g = game();
  if (!g?.scene) return null;
  const group = new THREE.Group();
  group.name = `WAE_V23_${event.id.toUpperCase()}`;
  const glow = new THREE.MeshBasicMaterial({ color: event.color, transparent: true, opacity: .36, depthWrite: false, blending: THREE.AdditiveBlending });
  const solid = new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: event.color, emissiveIntensity: .45, metalness: .7, roughness: .26, transparent: true, opacity: .82 });

  createParticleField(group, event.color, event.id === 'solar' ? 78 : 58);

  if (event.id === 'rift') {
    for (let i = 0; i < 3; i += 1) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(5.2 + i * 1.1, .12, 8, 54), glow.clone());
      ring.position.z = -58 - i * 2;
      ring.rotation.y = Math.PI / 2;
      ring.userData.spin = .3 + i * .12;
      group.add(ring);
    }
  } else if (event.id === 'solar') {
    for (let i = 0; i < 4; i += 1) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(8 + i * 2.2, .08, 6, 64), glow.clone());
      ring.position.z = -76 - i * 6;
      ring.rotation.x = Math.PI / 2;
      ring.userData.spin = .18 + i * .04;
      group.add(ring);
    }
    const light = new THREE.PointLight(event.color, 1.3, 85, 2);
    light.position.set(10, 8, -46);
    group.add(light);
  } else if (event.id === 'salvage') {
    for (let i = 0; i < 6; i += 1) {
      const cache = new THREE.Mesh(new THREE.OctahedronGeometry(.55 + (i % 2) * .18, 0), solid.clone());
      cache.position.set((i - 2.5) * 4.2, Math.sin(i * 1.8) * 3.2, -38 - i * 8);
      cache.userData.floatSeed = i;
      group.add(cache);
    }
  } else if (event.id === 'convoy') {
    for (let i = 0; i < 3; i += 1) {
      const ship = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.OctahedronGeometry(.8, 0), solid.clone());
      hull.scale.set(1.6, .6, 2.2);
      const wing = new THREE.Mesh(new THREE.BoxGeometry(3.6, .08, .8), glow.clone());
      ship.add(hull, wing);
      ship.position.set((i - 1) * 5.2, -5 + i * 2.1, -46 - i * 11);
      ship.userData.convoy = true;
      ship.userData.floatSeed = i;
      group.add(ship);
    }
  } else {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(event.id === 'ambush' ? 6.8 : 8.4, .1, 8, 54), glow.clone());
    ring.position.z = -62;
    ring.rotation.x = Math.PI / 2;
    ring.userData.spin = event.id === 'ambush' ? .62 : .26;
    group.add(ring);
    if (event.id === 'aurora') {
      const ringB = new THREE.Mesh(new THREE.TorusGeometry(11.2, .08, 6, 64), glow.clone());
      ringB.position.z = -84;
      ringB.rotation.x = Math.PI / 2;
      ringB.rotation.z = .7;
      ringB.userData.spin = -.18;
      group.add(ringB);
    }
  }

  g.scene.add(group);
  state.rig = group;
  return group;
}

function showDiscovery(event) {
  const { flash } = ensureUi();
  flash.style.setProperty('--v23-event-accent', event.accent);
  $('[data-v23-discovery-name]', flash).textContent = event.name;
  $('[data-v23-discovery-meta]', flash).textContent = `${event.rarity} · WORLD ATLAS UPDATED`;
  flash.classList.add('show');
  window.setTimeout(() => flash.classList.remove('show'), 1800);
}

function setEventUi(event, remaining, progress) {
  const { layer, card } = ensureUi();
  layer.style.setProperty('--v23-event-accent', event.accent);
  card.style.setProperty('--v23-event-accent', event.accent);
  $('[data-v23-event-sigil]', card).textContent = event.sigil;
  $('[data-v23-event-rarity]', card).textContent = `${event.rarity} · ${event.mode}`;
  $('[data-v23-event-name]', card).textContent = event.name;
  $('[data-v23-event-copy]', card).textContent = event.description;
  $('[data-v23-event-timer]', card).textContent = `${Math.max(0, remaining).toFixed(1)}s`;
  const fill = $('[data-v23-event-fill]', card);
  if (fill) fill.style.transform = `scaleX(${Math.max(0, Math.min(1, progress))})`;
}

function hideEventUi() {
  const { layer, card } = ensureUi();
  layer.classList.remove('show');
  card.classList.remove('show');
  document.body.removeAttribute('data-v23-event');
}

function announce(text) {
  game()?.callbacks?.onAnnounce?.(text);
}

function haptic(pattern) {
  try { navigator.vibrate?.(pattern); } catch {}
}

function beginEvent(event, sector, slot) {
  const g = game();
  if (!g || state.active || g.state !== 'playing') return;
  const profile = loadProfile();
  const firstDiscovery = !profile.discovered.includes(event.id);
  if (firstDiscovery) profile.discovered.push(event.id);
  profile.totalEvents += 1;
  profile.bestSectorSeen = Math.max(profile.bestSectorSeen, sector);
  profile.lastEvent = event.id;
  profile.updatedAt = Date.now();
  if (['rift', 'aurora', 'convoy'].includes(event.id)) profile.rareEvents += 1;
  saveProfile(profile);

  const now = performance.now();
  state.active = {
    event,
    sector,
    slot,
    startedAt: now,
    lastSpawnAt: now - 2600,
    spawns: 0,
    killsBefore: Math.max(0, Number(g.profile?.totalKills) || 0),
    hudAt: 0,
  };
  document.body.dataset.v23Event = event.id;
  const { layer, card } = ensureUi();
  layer.classList.add('show');
  card.classList.add('show');
  createEventRig(event);
  setEventUi(event, event.duration, 1);
  announce(`WORLD EVENT · ${event.name}`);
  g.audio?.play?.(event.id === 'ambush' ? 'boss' : 'mission');
  haptic(event.id === 'ambush' ? [45, 40, 70] : 28);
  if (firstDiscovery) showDiscovery(event);
  if (state.atlasOpen) renderAtlas();
}

function grantEventReward(active) {
  const g = game();
  const event = active.event;
  if (!g || g.state !== 'playing') return false;
  const killsNow = Math.max(0, Number(g.profile?.totalKills) || 0);
  const killsDuring = Math.max(0, killsNow - active.killsBefore);
  let cores = event.rewardCores;
  let score = event.rewardScore + Math.max(1, active.sector) * 18;
  if (event.id === 'convoy' && killsDuring >= 2) { cores += 1; score += 240; }
  if (event.id === 'ambush' && killsDuring >= 3) { cores += 1; score += 320; }

  if (g.profile && Number.isFinite(g.profile.cores)) {
    g.profile.cores += cores;
    g.saveProfile?.();
    g.callbacks?.onMeta?.(g.metaSnapshot?.());
  }
  if (Number.isFinite(g.score)) g.score += score;
  g.callbacks?.onHud?.(g.snapshot?.());
  announce(`${event.name} · COMPLETE · +${cores} CORE${cores === 1 ? '' : 'S'}`);
  g.audio?.play?.('powerup');
  haptic([30, 28, 50]);

  const profile = loadProfile();
  profile.survived += 1;
  profile.updatedAt = Date.now();
  saveProfile(profile);
  return true;
}

function endEvent(reward = true) {
  if (!state.active) return;
  const active = state.active;
  if (reward) grantEventReward(active);
  hideEventUi();
  disposeObject(state.rig);
  state.rig = null;
  state.active = null;
  if (state.atlasOpen) renderAtlas();
}

function updateRig(delta, elapsed) {
  const rig = state.rig;
  if (!rig) return;
  for (const child of rig.children) {
    if (child.userData?.spin) child.rotation.z += child.userData.spin * delta;
    if (child.userData?.v23Points) {
      child.rotation.z += delta * .018;
      child.position.z += delta * 3.4;
      if (child.position.z > 18) child.position.z = -14;
    }
    if (child.userData?.convoy) {
      const seed = Number(child.userData.floatSeed) || 0;
      child.position.y += Math.sin(elapsed * .0018 + seed) * delta * .45;
      child.rotation.z = Math.sin(elapsed * .0014 + seed) * .08;
    }
    if (Number.isFinite(child.userData?.floatSeed) && !child.userData?.convoy) {
      const seed = child.userData.floatSeed;
      child.rotation.x += delta * (.3 + seed * .03);
      child.rotation.y += delta * (.45 + seed * .02);
      child.position.y += Math.sin(elapsed * .002 + seed) * delta * .3;
    }
  }
}

function applyEventEffects(active, delta, elapsed) {
  const g = game();
  if (!g || g.state !== 'playing') return;
  const event = active.event;

  if (event.id === 'solar') {
    g.addHeat?.(delta * .78);
  } else if (event.id === 'aurora') {
    const maxShield = Math.max(1, Number(g.getMaxShield?.() ?? g.maxShield ?? 100) || 100);
    if (Number.isFinite(g.shield) && g.shield < maxShield) {
      g.shield = Math.min(maxShield, g.shield + delta * maxShield * .017);
      active.hudAt += delta;
      if (active.hudAt > .45) { active.hudAt = 0; g.callbacks?.onHud?.(g.snapshot?.()); }
    }
  } else if (event.id === 'ambush' || event.id === 'convoy') {
    const interval = event.id === 'ambush' ? 3.2 : 4.4;
    const maxSpawns = event.id === 'ambush' ? 4 : 3;
    if (active.spawns < maxSpawns && elapsed - active.lastSpawnAt >= interval * 1000) {
      active.lastSpawnAt = elapsed;
      active.spawns += 1;
      g.spawnDrone?.(event.id === 'ambush');
      if (event.id === 'ambush' && active.spawns === 3) g.spawnDrone?.(true);
    }
  } else if (event.id === 'rift') {
    if (Number.isFinite(g.heat)) g.heat = Math.max(0, g.heat - delta * .55);
  }
}

function syncSector(g) {
  const sector = Math.max(1, Math.floor(Number(g.sector) || 1));
  if (state.currentSector === sector) return;
  if (state.active) endEvent(false);
  state.currentSector = sector;
  state.processed.clear();
  const profile = loadProfile();
  if (sector > profile.bestSectorSeen) { profile.bestSectorSeen = sector; saveProfile(profile); }
}

function maybeStartScheduledEvent(g) {
  if (state.active || g.boss || g.state !== 'playing') return;
  const sector = Math.max(1, Math.floor(Number(g.sector) || 1));
  const sectorTime = Number.isFinite(Number(g.sectorTime)) ? Number(g.sectorTime) : state.runElapsed;
  for (let slot = 0; slot < 2; slot += 1) {
    const key = `${sector}:${slot}`;
    if (state.processed.has(key)) continue;
    const at = slotTime(sector, slot);
    if (sectorTime < at) continue;
    if (sectorTime > at + EVENT_GAP) { state.processed.add(key); continue; }
    state.processed.add(key);
    beginEvent(eventFor(sector, slot), sector, slot);
    break;
  }
}

function loop(now) {
  const delta = Math.min(.05, Math.max(0, (now - state.lastFrame) / 1000));
  state.lastFrame = now;
  const g = game();

  if (g) {
    if (g.state === 'playing') {
      if (state.lastGameState !== 'playing') state.runElapsed = 0;
      state.runElapsed += delta;
      syncSector(g);
      maybeStartScheduledEvent(g);
      if (state.active) {
        const elapsedMs = now - state.active.startedAt;
        const remaining = state.active.event.duration - elapsedMs / 1000;
        updateRig(delta, now);
        applyEventEffects(state.active, delta, now);
        state.uiTimer += delta * 1000;
        if (state.uiTimer >= UI_TICK_MS) {
          state.uiTimer = 0;
          setEventUi(state.active.event, remaining, remaining / state.active.event.duration);
        }
        if (remaining <= 0) endEvent(true);
      }
    } else if (state.active) {
      endEvent(false);
    }
    state.lastGameState = String(g.state || '');
  }

  state.raf = requestAnimationFrame(loop);
}

function cleanOnUnload() {
  cancelAnimationFrame(state.raf);
  state.raf = 0;
  disposeObject(state.rig);
  state.rig = null;
  state.active = null;
}

export function installWorldDirector() {
  if (state.installed) return;
  state.installed = true;
  ensureUi();
  ensureAtlas();
  state.lastFrame = performance.now();
  state.raf = requestAnimationFrame(loop);
  window.addEventListener('beforeunload', cleanOnUnload, { once: true });
  window.__waeV23World = {
    version: '23.0.0',
    openAtlas: openWorldAtlas,
    closeAtlas: closeWorldAtlas,
    getProfile: () => loadProfile(),
  };
}
