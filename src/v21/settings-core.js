const $ = (selector, root = document) => root.querySelector(selector);

const SETTINGS_KEY = 'wae_neon_rider_v21_player_settings';
const HUD_KEY = 'wae_neon_rider_v21_hud_mode';

const PRESET_SENSITIVITY = Object.freeze({ precision: 82, balanced: 90, aggressive: 105 });

const DEFAULTS = Object.freeze({
  controls: {
    scheme: 'classic',
    preset: 'balanced',
    sensitivity: 90,
    joystickSize: 100,
    joystickOpacity: 62,
    haptics: true,
    leftHanded: false,
  },
  hud: { mode: 'compact' },
  graphics: { quality: 'balanced', effects: true },
  audio: { enabled: true },
});

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULTS));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalize(raw = {}) {
  const next = cloneDefaults();
  const controls = raw?.controls || {};

  if (controls.scheme === 'classic' || controls.scheme === 'joystick') next.controls.scheme = controls.scheme;
  if (['precision', 'balanced', 'aggressive', 'custom'].includes(controls.preset)) next.controls.preset = controls.preset;

  const sensitivity = Number(controls.sensitivity);
  if (Number.isFinite(sensitivity)) next.controls.sensitivity = clamp(Math.round(sensitivity), 70, 115);
  const joystickSize = Number(controls.joystickSize);
  if (Number.isFinite(joystickSize)) next.controls.joystickSize = clamp(Math.round(joystickSize), 80, 125);
  const joystickOpacity = Number(controls.joystickOpacity);
  if (Number.isFinite(joystickOpacity)) next.controls.joystickOpacity = clamp(Math.round(joystickOpacity), 35, 90);
  if (typeof controls.haptics === 'boolean') next.controls.haptics = controls.haptics;
  if (typeof controls.leftHanded === 'boolean') next.controls.leftHanded = controls.leftHanded;

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

function persist(settings, { announce = false, render = false } = {}) {
  const normalized = normalize(settings);
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized)); } catch {}
  applySettings(normalized);
  document.dispatchEvent(new CustomEvent('wae:settings-changed', { detail: normalized }));
  if (announce) showSettingsToast('CONFIGURACIÓN GUARDADA');
  if (render) renderSettings(normalized);
  return normalized;
}

function writeSettings(next, announce = true) {
  return persist(next, { announce, render: true });
}

function patchSettings(mutator, announce = true) {
  const next = readSettings();
  mutator(next);
  return writeSettings(next, announce);
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
  document.body.dataset.v21ControlPreset = settings.controls.preset;
  document.body.classList.toggle('v21-control-classic', settings.controls.scheme === 'classic');
  document.body.classList.toggle('v21-control-joystick', settings.controls.scheme === 'joystick');
  document.body.classList.toggle('v21-left-handed', settings.controls.leftHanded);
  document.body.dataset.v21Haptics = settings.controls.haptics ? 'on' : 'off';
  document.body.style.setProperty('--v21-control-sensitivity', String(settings.controls.sensitivity / 100));
  document.body.style.setProperty('--v21-joystick-scale', String(settings.controls.joystickSize / 100));
  document.body.style.setProperty('--v21-joystick-opacity', String(settings.controls.joystickOpacity / 100));

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

function previewMarkup(settings) {
  const joystick = settings.controls.scheme === 'joystick';
  const left = settings.controls.leftHanded;
  return `
    <div class="v2111-control-preview ${joystick ? 'is-joystick' : 'is-classic'} ${left ? 'is-left-handed' : ''}" aria-label="Vista previa de controles">
      <div class="v2111-preview-movement">
        ${joystick
          ? '<div class="v2111-preview-stick"><i></i><b></b></div>'
          : '<div class="v2111-preview-dpad"><i>▲</i><i>◀</i><i>▶</i><i>▼</i></div>'}
      </div>
      <div class="v2111-preview-center"><span>CONTROL LAB</span><strong>${joystick ? settings.controls.preset.toUpperCase() : 'CLÁSICO'}</strong><small>${left ? 'ZURDO' : 'ESTÁNDAR'}</small></div>
      <div class="v2111-preview-actions"><i></i><i></i><b></b></div>
    </div>`;
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
        <div><span>WAE NEON RIDER · V21.11</span><h2>CONFIGURACIÓN</h2><p>Control Lab, interfaz y rendimiento. Los cambios se aplican en vivo.</p></div>
        <button type="button" class="v21-settings__close" data-settings-close aria-label="Cerrar configuración">×</button>
      </header>
      <nav class="v21-settings__tabs" aria-label="Secciones de configuración">
        <button type="button" class="active" data-settings-tab="controls">CONTROL LAB</button>
        <button type="button" data-settings-tab="interface">INTERFAZ</button>
        <button type="button" data-settings-tab="system">SISTEMA</button>
      </nav>
      <div class="v21-settings__body" data-settings-body></div>
      <footer class="v21-settings__foot"><button type="button" data-settings-reset>RESTABLECER</button><span>Preferencias guardadas en este dispositivo.</span></footer>
    </div>`;
  document.body.append(panel);
  return panel;
}

function renderControls(body, settings) {
  const joystick = settings.controls.scheme === 'joystick';
  const presetLabel = settings.controls.preset === 'custom' ? 'PERSONALIZADO' : settings.controls.preset.toUpperCase();
  body.innerHTML = `
    ${previewMarkup(settings)}
    <section class="v21-setting-section">
      <div class="v21-setting-title"><div><strong>ESQUEMA DE CONTROL</strong><span>Cambia de sistema sin reiniciar la partida.</span></div><b>${joystick ? 'JOYSTICK' : 'BOTONES'}</b></div>
      <div class="v21-setting-options v21-setting-options--two">
        ${optionButton('classic', 'BOTONES CLÁSICOS', 'Cruceta física de cuatro direcciones.', settings.controls.scheme, 'scheme')}
        ${optionButton('joystick', 'JOYSTICK', 'Analógico con centro fijo y potencia progresiva.', settings.controls.scheme, 'scheme')}
      </div>
    </section>

    <section class="v21-setting-section ${joystick ? '' : 'is-muted'}">
      <div class="v21-setting-title"><div><strong>PERFIL DE PILOTAJE</strong><span>Tres curvas de respuesta listas para jugar.</span></div><b>${presetLabel}</b></div>
      <div class="v21-setting-options v21-setting-options--three">
        ${optionButton('precision', 'PRECISIÓN', 'Suave y estable para correcciones finas.', settings.controls.preset, 'preset')}
        ${optionButton('balanced', 'BALANCEADO', 'Respuesta progresiva recomendada.', settings.controls.preset, 'preset')}
        ${optionButton('aggressive', 'AGRESIVO', 'Mayor aceleración y reacción exterior.', settings.controls.preset, 'preset')}
      </div>
    </section>

    <section class="v21-setting-section ${joystick ? '' : 'is-muted'}">
      <div class="v21-setting-title"><div><strong>SENSIBILIDAD</strong><span>Ajuste fino sobre el perfil seleccionado.</span></div><b data-sensitivity-label>${settings.controls.sensitivity}%</b></div>
      <input type="range" min="70" max="115" step="1" value="${settings.controls.sensitivity}" data-setting-slider="sensitivity" ${joystick ? '' : 'disabled'} />
      <div class="v21-setting-scale"><span>CONTROL</span><span>RESPUESTA</span></div>
    </section>

    <div class="v2111-control-grid">
      <section class="v21-setting-section ${joystick ? '' : 'is-muted'}">
        <div class="v21-setting-title"><div><strong>TAMAÑO JOYSTICK</strong><span>Recorrido físico del pulgar.</span></div><b data-joystick-size-label>${settings.controls.joystickSize}%</b></div>
        <input type="range" min="80" max="125" step="1" value="${settings.controls.joystickSize}" data-setting-slider="joystickSize" ${joystick ? '' : 'disabled'} />
      </section>
      <section class="v21-setting-section ${joystick ? '' : 'is-muted'}">
        <div class="v21-setting-title"><div><strong>OPACIDAD</strong><span>Visibilidad del aro analógico.</span></div><b data-joystick-opacity-label>${settings.controls.joystickOpacity}%</b></div>
        <input type="range" min="35" max="90" step="1" value="${settings.controls.joystickOpacity}" data-setting-slider="joystickOpacity" ${joystick ? '' : 'disabled'} />
      </section>
    </div>

    <section class="v21-setting-row"><div><strong>MODO ZURDO</strong><span>Intercambia el lado de movimiento y los botones de acción.</span></div><button type="button" class="v21-switch ${settings.controls.leftHanded ? 'on' : ''}" data-setting-toggle="leftHanded" aria-pressed="${settings.controls.leftHanded}"><i></i></button></section>
    <section class="v21-setting-row"><div><strong>RESPUESTA HÁPTICA</strong><span>Vibración sutil al pilotar y activar acciones.</span></div><button type="button" class="v21-switch ${settings.controls.haptics ? 'on' : ''}" data-setting-toggle="haptics" aria-pressed="${settings.controls.haptics}"><i></i></button></section>`;
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
    renderControls(body, settings);
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
    <section class="v21-setting-row"><div><strong>AUDIO DEL JUEGO</strong><span>Disparos, impactos y eventos.</span></div><button type="button" class="v21-switch ${settings.audio.enabled ? 'on' : ''}" data-setting-toggle="audio" aria-pressed="${settings.audio.enabled}"><i></i></button></section>`;
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

function applyPreset(next, preset) {
  if (!PRESET_SENSITIVITY[preset]) return;
  next.controls.preset = preset;
  next.controls.sensitivity = PRESET_SENSITIVITY[preset];
}

function updateLiveSlider(slider) {
  const key = slider.dataset.settingSlider;
  const next = readSettings();
  let value = Number(slider.value);

  if (key === 'sensitivity') {
    value = clamp(Math.round(value || 90), 70, 115);
    next.controls.sensitivity = value;
    next.controls.preset = 'custom';
    const label = $('[data-sensitivity-label]', ensureSettingsPanel());
    if (label) label.textContent = `${value}%`;
  }
  if (key === 'joystickSize') {
    value = clamp(Math.round(value || 100), 80, 125);
    next.controls.joystickSize = value;
    const label = $('[data-joystick-size-label]', ensureSettingsPanel());
    if (label) label.textContent = `${value}%`;
  }
  if (key === 'joystickOpacity') {
    value = clamp(Math.round(value || 62), 35, 90);
    next.controls.joystickOpacity = value;
    const label = $('[data-joystick-opacity-label]', ensureSettingsPanel());
    if (label) label.textContent = `${value}%`;
  }

  persist(next, { render: false });
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
        if (group === 'preset' && next.controls.scheme === 'joystick') applyPreset(next, value);
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
        if (key === 'leftHanded') next.controls.leftHanded = !next.controls.leftHanded;
        if (key === 'effects') next.graphics.effects = !next.graphics.effects;
        if (key === 'audio') next.audio.enabled = !next.audio.enabled;
      });
      return;
    }

    if (event.target.closest('[data-settings-reset]')) {
      event.preventDefault();
      writeSettings(cloneDefaults());
      showSettingsToast('CONFIGURACIÓN RESTABLECIDA');
      return;
    }

    if (event.target.closest('#sound-btn')) {
      setTimeout(() => {
        const enabled = window.__waeNeonRiderGame?.audio?.enabled !== false;
        const next = readSettings();
        next.audio.enabled = enabled;
        persist(next, { render: false });
      }, 0);
    }
  });

  document.addEventListener('input', (event) => {
    const slider = event.target.closest('[data-setting-slider]');
    if (!slider) return;
    updateLiveSlider(slider);
  }, true);

  document.addEventListener('change', (event) => {
    const slider = event.target.closest('[data-setting-slider]');
    if (!slider) return;
    renderSettings(readSettings(), 'controls');
    showSettingsToast('CONTROL LAB ACTUALIZADO');
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
  defaults: cloneDefaults,
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
