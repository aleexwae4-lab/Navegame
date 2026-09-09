const $ = (selector, root = document) => root.querySelector(selector);

const SETTINGS_KEY = 'wae_neon_rider_v21_player_settings';
const HUD_KEY = 'wae_neon_rider_v21_hud_mode';

const DEFAULTS = Object.freeze({
  controls: {
    scheme: 'classic',
    sensitivity: 90,
    haptics: true,
  },
  hud: {
    mode: 'compact',
  },
  graphics: {
    quality: 'balanced',
    effects: true,
  },
  audio: {
    enabled: true,
  },
});

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULTS));
}

function normalize(raw = {}) {
  const next = cloneDefaults();
  const scheme = raw?.controls?.scheme;
  if (scheme === 'classic' || scheme === 'joystick') next.controls.scheme = scheme;
  const sensitivity = Number(raw?.controls?.sensitivity);
  if (Number.isFinite(sensitivity)) next.controls.sensitivity = Math.max(70, Math.min(115, Math.round(sensitivity)));
  if (typeof raw?.controls?.haptics === 'boolean') next.controls.haptics = raw.controls.haptics;

  const hud = raw?.hud?.mode;
  if (['compact', 'off', 'full'].includes(hud)) next.hud.mode = hud;

  const quality = raw?.graphics?.quality;
  if (['eco', 'balanced', 'high'].includes(quality)) next.graphics.quality = quality;
  if (typeof raw?.graphics?.effects === 'boolean') next.graphics.effects = raw.graphics.effects;
  if (typeof raw?.audio?.enabled === 'boolean') next.audio.enabled = raw.audio.enabled;
  return next;
}

function readSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    return normalize(parsed || {});
  } catch {
    return cloneDefaults();
  }
}

function writeSettings(next, announce = true) {
  const normalized = normalize(next);
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized)); } catch {}
  applySettings(normalized);
  document.dispatchEvent(new CustomEvent('wae:settings-changed', { detail: normalized }));
  if (announce) showSettingsToast('CONFIGURACIÓN GUARDADA');
  renderSettings(normalized);
  return normalized;
}

function patchSettings(mutator) {
  const next = readSettings();
  mutator(next);
  return writeSettings(next);
}

function graphicsPixelRatio(quality) {
  const dpr = window.devicePixelRatio || 1;
  if (quality === 'eco') return Math.min(dpr, 1);
  if (quality === 'high') return Math.min(dpr, 2);
  return Math.min(dpr, 1.45);
}

function applyGraphics(settings) {
  document.body.dataset.v21Graphics = settings.graphics.quality;
  document.body.classList.toggle('v21-reduced-fx', !settings.graphics.effects);
  const renderer = window.__waeNeonRiderGame?.renderer;
  if (!renderer?.setPixelRatio) return;
  const target = graphicsPixelRatio(settings.graphics.quality);
  const current = Number(renderer.getPixelRatio?.());
  if (!Number.isFinite(current) || Math.abs(current - target) > 0.02) {
    renderer.setPixelRatio(target);
    renderer.setSize?.(window.innerWidth, window.innerHeight, false);
  }
}

function applyAudio(settings) {
  const game = window.__waeNeonRiderGame;
  game?.audio?.setEnabled?.(settings.audio.enabled);
  const button = $('#sound-btn');
  if (button) {
    button.textContent = settings.audio.enabled ? '♪' : '×';
    button.classList.toggle('muted', !settings.audio.enabled);
    button.setAttribute('aria-label', settings.audio.enabled ? 'Silenciar audio' : 'Activar audio');
  }
}

function applySettings(settings = readSettings()) {
  document.body.dataset.v21ControlScheme = settings.controls.scheme;
  document.body.classList.toggle('v21-control-classic', settings.controls.scheme === 'classic');
  document.body.classList.toggle('v21-control-joystick', settings.controls.scheme === 'joystick');
  document.body.dataset.v21Haptics = settings.controls.haptics ? 'on' : 'off';
  document.body.style.setProperty('--v21-control-sensitivity', String(settings.controls.sensitivity / 100));

  try { localStorage.setItem(HUD_KEY, settings.hud.mode); } catch {}
  document.body.dataset.v21HudMode = settings.hud.mode;

  applyGraphics(settings);
  applyAudio(settings);
  return settings;
}

function showSettingsToast(message) {
  let toast = $('#v21-settings-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'v21-settings-toast';
    toast.className = 'v21-settings-toast';
    toast.setAttribute('role', 'status');
    document.body.append(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showSettingsToast.timer);
  showSettingsToast.timer = setTimeout(() => toast.classList.remove('show'), 1700);
}

function optionButton(value, label, description, current, group) {
  const active = value === current ? ' active' : '';
  return `<button type="button" class="v21-setting-option${active}" data-setting-group="${group}" data-setting-value="${value}"><strong>${label}</strong><span>${description}</span></button>`;
}

function ensureSettingsPanel() {
  let panel = $('#v21-settings');
  if (panel) return panel;
  panel = document.createElement('section');
  panel.id = 'v21-settings';
  panel.className = 'v21-settings hidden';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Configuración de juego');
  panel.innerHTML = `
    <div class="v21-settings__panel">
      <header class="v21-settings__head">
        <div><span>WAE NEON RIDER</span><h2>CONFIGURACIÓN</h2><p>Personaliza controles y experiencia sin reiniciar la partida.</p></div>
        <button type="button" class="v21-settings__close" data-settings-close aria-label="Cerrar configuración">×</button>
      </header>
      <nav class="v21-settings__tabs" aria-label="Secciones de configuración">
        <button type="button" class="active" data-settings-tab="controls">CONTROLES</button>
        <button type="button" data-settings-tab="interface">INTERFAZ</button>
        <button type="button" data-settings-tab="system">SISTEMA</button>
      </nav>
      <div class="v21-settings__body" data-settings-body></div>
      <footer class="v21-settings__foot"><button type="button" data-settings-reset>RESTABLECER</button><span>Los cambios se guardan en este dispositivo.</span></footer>
    </div>`;
  document.body.append(panel);
  return panel;
}

function renderSettings(settings = readSettings(), tab = null) {
  const panel = ensureSettingsPanel();
  const activeTab = tab || panel.dataset.tab || 'controls';
  panel.dataset.tab = activeTab;
  for (const button of panel.querySelectorAll('[data-settings-tab]')) {
    button.classList.toggle('active', button.dataset.settingsTab === activeTab);
  }
  const body = $('[data-settings-body]', panel);
  if (!body) return;

  if (activeTab === 'controls') {
    body.innerHTML = `
      <section class="v21-setting-section">
        <div class="v21-setting-title"><div><strong>ESQUEMA DE CONTROL</strong><span>Elige cómo pilotar en dispositivos táctiles.</span></div><b>${settings.controls.scheme === 'classic' ? 'BOTONES' : 'JOYSTICK'}</b></div>
        <div class="v21-setting-options v21-setting-options--two">
          ${optionButton('classic', 'BOTONES CLÁSICOS', 'Cruceta de cuatro direcciones. Estable y directo.', settings.controls.scheme, 'scheme')}
          ${optionButton('joystick', 'JOYSTICK', 'Control analógico progresivo con centro fijo.', settings.controls.scheme, 'scheme')}
        </div>
      </section>
      <section class="v21-setting-section ${settings.controls.scheme === 'classic' ? 'is-muted' : ''}">
        <div class="v21-setting-title"><div><strong>SENSIBILIDAD DEL JOYSTICK</strong><span>Más baja = mayor precisión. Sólo afecta al joystick.</span></div><b data-sensitivity-label>${settings.controls.sensitivity}%</b></div>
        <input type="range" min="70" max="115" step="1" value="${settings.controls.sensitivity}" data-setting-sensitivity ${settings.controls.scheme === 'classic' ? 'disabled' : ''} />
        <div class="v21-setting-scale"><span>PRECISIÓN</span><span>RÁPIDO</span></div>
      </section>
      <section class="v21-setting-row"><div><strong>RESPUESTA HÁPTICA</strong><span>Vibración sutil en controles y acciones.</span></div><button type="button" class="v21-switch ${settings.controls.haptics ? 'on' : ''}" data-setting-toggle="haptics" aria-pressed="${settings.controls.haptics}"><i></i></button></section>`;
    return;
  }

  if (activeTab === 'interface') {
    body.innerHTML = `
      <section class="v21-setting-section">
        <div class="v21-setting-title"><div><strong>HUD DE COMBATE</strong><span>Controla cuánta información aparece durante la partida.</span></div><b>${settings.hud.mode === 'off' ? 'OCULTO' : settings.hud.mode === 'full' ? 'COMPLETO' : 'COMPACTO'}</b></div>
        <div class="v21-setting-options v21-setting-options--three">
          ${optionButton('compact', 'COMPACTO', 'Información esencial.', settings.hud.mode, 'hud')}
          ${optionButton('off', 'OCULTO', 'Máxima limpieza visual.', settings.hud.mode, 'hud')}
          ${optionButton('full', 'COMPLETO', 'Toda la telemetría.', settings.hud.mode, 'hud')}
        </div>
      </section>
      <section class="v21-setting-row"><div><strong>EFECTOS DE INTERFAZ</strong><span>Glow, blur y capas cinematográficas.</span></div><button type="button" class="v21-switch ${settings.graphics.effects ? 'on' : ''}" data-setting-toggle="effects" aria-pressed="${settings.graphics.effects}"><i></i></button></section>`;
    return;
  }

  body.innerHTML = `
    <section class="v21-setting-section">
      <div class="v21-setting-title"><div><strong>CALIDAD GRÁFICA</strong><span>Ajusta resolución interna para rendimiento o nitidez.</span></div><b>${settings.graphics.quality.toUpperCase()}</b></div>
      <div class="v21-setting-options v21-setting-options--three">
        ${optionButton('eco', 'ECO', 'Más FPS y batería.', settings.graphics.quality, 'quality')}
        ${optionButton('balanced', 'BALANCEADO', 'Recomendado.', settings.graphics.quality, 'quality')}
        ${optionButton('high', 'ALTA', 'Mayor nitidez.', settings.graphics.quality, 'quality')}
      </div>
    </section>
    <section class="v21-setting-row"><div><strong>AUDIO DEL JUEGO</strong><span>Efectos de disparos, impactos y eventos.</span></div><button type="button" class="v21-switch ${settings.audio.enabled ? 'on' : ''}" data-setting-toggle="audio" aria-pressed="${settings.audio.enabled}"><i></i></button></section>`;
}

function installLaunchButtons() {
  const startMeta = $('#start-screen .start-meta');
  if (startMeta && !startMeta.querySelector('[data-settings-open]')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.settingsOpen = 'true';
    button.className = 'v21-settings-launch';
    button.innerHTML = '<span>⚙</span> CONFIGURACIÓN';
    startMeta.append(button);
  }

  const pausePanel = $('#pause-screen .panel');
  if (pausePanel && !pausePanel.querySelector('[data-settings-open]')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.settingsOpen = 'true';
    button.className = 'v21-settings-pause';
    button.textContent = 'CONFIGURACIÓN';
    pausePanel.append(button);
  }

  const utilities = $('.utility-controls');
  if (utilities && !utilities.querySelector('[data-settings-open]')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'icon-btn v21-settings-gear';
    button.dataset.settingsOpen = 'true';
    button.setAttribute('aria-label', 'Abrir configuración');
    button.title = 'Configuración';
    button.textContent = '⚙';
    utilities.append(button);
  }
}

function openSettings() {
  const game = window.__waeNeonRiderGame;
  if (game?.state === 'playing') game.pause?.();
  const panel = ensureSettingsPanel();
  renderSettings(readSettings());
  panel.classList.remove('hidden');
  document.body.classList.add('v21-settings-open');
}

function closeSettings() {
  ensureSettingsPanel().classList.add('hidden');
  document.body.classList.remove('v21-settings-open');
}

function installEvents() {
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-settings-open]')) {
      event.preventDefault();
      openSettings();
      return;
    }
    if (event.target.closest('[data-settings-close]')) {
      event.preventDefault();
      closeSettings();
      return;
    }
    const tab = event.target.closest('[data-settings-tab]');
    if (tab) {
      event.preventDefault();
      renderSettings(readSettings(), tab.dataset.settingsTab);
      return;
    }
    const option = event.target.closest('[data-setting-group][data-setting-value]');
    if (option) {
      event.preventDefault();
      const group = option.dataset.settingGroup;
      const value = option.dataset.settingValue;
      patchSettings((next) => {
        if (group === 'scheme') next.controls.scheme = value;
        if (group === 'hud') next.hud.mode = value;
        if (group === 'quality') next.graphics.quality = value;
      });
      return;
    }
    const toggle = event.target.closest('[data-setting-toggle]');
    if (toggle) {
      event.preventDefault();
      const key = toggle.dataset.settingToggle;
      patchSettings((next) => {
        if (key === 'haptics') next.controls.haptics = !next.controls.haptics;
        if (key === 'effects') next.graphics.effects = !next.graphics.effects;
        if (key === 'audio') next.audio.enabled = !next.audio.enabled;
      });
      return;
    }
    if (event.target.closest('[data-settings-reset]')) {
      event.preventDefault();
      writeSettings(cloneDefaults());
    }
  }, true);

  document.addEventListener('input', (event) => {
    const slider = event.target.closest('[data-setting-sensitivity]');
    if (!slider) return;
    const value = Math.max(70, Math.min(115, Number(slider.value) || 90));
    const label = $('[data-sensitivity-label]', ensureSettingsPanel());
    if (label) label.textContent = `${Math.round(value)}%`;
    const next = readSettings();
    next.controls.sensitivity = value;
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalize(next))); } catch {}
    applySettings(next);
    document.dispatchEvent(new CustomEvent('wae:settings-changed', { detail: normalize(next) }));
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target.closest('[data-setting-sensitivity]')) showSettingsToast('SENSIBILIDAD GUARDADA');
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !ensureSettingsPanel().classList.contains('hidden')) {
      event.stopImmediatePropagation();
      closeSettings();
    }
  }, true);
}

const initial = readSettings();
try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(initial)); } catch {}
applySettings(initial);
ensureSettingsPanel();
installLaunchButtons();
renderSettings(initial);
installEvents();

window.__waeNeonSettings = Object.freeze({
  key: SETTINGS_KEY,
  get: readSettings,
  apply: applySettings,
  open: openSettings,
  close: closeSettings,
});

window.setInterval(() => {
  installLaunchButtons();
  applyGraphics(readSettings());
}, 900);

window.addEventListener('pageshow', () => {
  installLaunchButtons();
  applySettings(readSettings());
});
