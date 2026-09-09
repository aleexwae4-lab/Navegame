import * as THREE from 'three';

const $ = (selector, root = document) => root.querySelector(selector);

const THEMES = Object.freeze({
  'frame-standard': { name: 'GRAPHITE', tint: 0x334155, accent: 0x67e8f9, emissive: 0x0891b2, mix: 0.10, metalness: 0.88, roughness: 0.22 },
  'frame-cobalt': { name: 'COBALT', tint: 0x1d4ed8, accent: 0x60a5fa, emissive: 0x2563eb, mix: 0.20, metalness: 0.93, roughness: 0.17 },
  'frame-imperium': { name: 'IMPERIUM', tint: 0x6d28d9, accent: 0xc084fc, emissive: 0x7c3aed, mix: 0.24, metalness: 0.95, roughness: 0.14 },
  'frame-sovereign': { name: 'SOVEREIGN', tint: 0xb45309, accent: 0xfbbf24, emissive: 0xf59e0b, mix: 0.28, metalness: 0.97, roughness: 0.12 },
});

const state = { ship: null, group: null, key: '', texture: null };

function game() { return window.__waeNeonRiderGame; }

function forge() {
  try { return window.__waeRewardForge?.get?.() || null; }
  catch { return null; }
}

function currentSignature() {
  const data = forge();
  const equipped = data?.equipped || {};
  const identity = data?.identity || {};
  const theme = THEMES[equipped.frame] || THEMES['frame-standard'];
  return {
    frameId: equipped.frame || 'frame-standard',
    badgeId: equipped.badge || 'badge-none',
    badgeIcon: identity.badgeIcon || '◇',
    title: identity.title || 'PILOT',
    frame: identity.frame || 'STANDARD FRAME',
    theme,
  };
}

function isThrusterObject(object, g) {
  return (g?.thrusters || []).some((flame) => flame === object || flame?.children?.includes?.(object));
}

function materialSnapshot(material) {
  if (!material?.userData) return null;
  if (!material.userData.v2115Original) {
    material.userData.v2115Original = {
      color: material.color?.getHex?.(),
      emissive: material.emissive?.getHex?.(),
      emissiveIntensity: Number(material.emissiveIntensity) || 0,
      metalness: Number(material.metalness),
      roughness: Number(material.roughness),
    };
  }
  return material.userData.v2115Original;
}

function applyMaterial(material, theme) {
  if (!material || (!material.isMeshStandardMaterial && !material.isMeshPhysicalMaterial)) return;
  const original = materialSnapshot(material);
  if (!original) return;
  if (material.color && Number.isFinite(original.color)) {
    material.color.setHex(original.color).lerp(new THREE.Color(theme.tint), theme.mix);
  }
  if (material.emissive && Number.isFinite(original.emissive)) {
    material.emissive.setHex(original.emissive).lerp(new THREE.Color(theme.emissive), theme.mix * 0.42);
    material.emissiveIntensity = Math.max(original.emissiveIntensity || 0, theme.frameId === 'frame-standard' ? 0 : 0.08);
  }
  if (Number.isFinite(original.metalness)) material.metalness = Math.max(original.metalness, theme.metalness);
  if (Number.isFinite(original.roughness)) material.roughness = Math.min(original.roughness, theme.roughness);
  material.needsUpdate = true;
}

function applyHullFinish(ship, theme) {
  const g = game();
  ship?.traverse?.((object) => {
    if (!object?.isMesh || object.userData?.v2115Signature || isThrusterObject(object, g)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) applyMaterial(material, theme);
  });
}

function makeBadgeTexture(icon, accent) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, 128, 128);
  ctx.translate(64, 64);
  ctx.strokeStyle = '#ffffff';
  ctx.globalAlpha = 0.92;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 43, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.46;
  ctx.beginPath();
  ctx.arc(0, 0, 51, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 50px system-ui, sans-serif';
  ctx.fillText(icon || '◇', 0, 3);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.userData.v2115Accent = accent;
  return texture;
}

function disposeSignature() {
  if (state.group) {
    state.group.parent?.remove(state.group);
    state.group.traverse?.((object) => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
      else object.material?.dispose?.();
    });
  }
  state.texture?.dispose?.();
  state.group = null;
  state.texture = null;
}

function signatureMaterial(theme, opacity = 0.9) {
  return new THREE.MeshBasicMaterial({
    color: theme.accent,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

function buildSignature(ship, signature) {
  disposeSignature();
  if (!ship) return;
  const { theme, badgeIcon } = signature;
  const group = new THREE.Group();
  group.name = 'WAE_SHIP_SIGNATURE_V2115';
  group.userData.v2115Signature = true;

  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 3.7), signatureMaterial(theme, 0.78));
  spine.position.set(0, 0.48, 0.25);
  spine.userData.v2115Signature = true;
  group.add(spine);

  for (const x of [-2.65, 2.65]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.07, 0.12), signatureMaterial(theme, 0.82));
    edge.position.set(x, 0.12, 0.5);
    edge.userData.v2115Signature = true;
    group.add(edge);
  }

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.035, 7, 36), signatureMaterial(theme, 0.68));
  ring.position.set(0, 0.08, 1.45);
  ring.userData.v2115Signature = true;
  group.add(ring);

  state.texture = makeBadgeTexture(badgeIcon, theme.accent);
  if (state.texture) {
    for (const x of [-2.15, 2.15]) {
      const decal = new THREE.Mesh(
        new THREE.PlaneGeometry(0.62, 0.62),
        new THREE.MeshBasicMaterial({ map: state.texture, color: theme.accent, transparent: true, opacity: 0.82, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
      );
      decal.position.set(x, 0.34, -0.25);
      decal.userData.v2115Signature = true;
      group.add(decal);
    }
  }

  const light = new THREE.PointLight(theme.accent, signature.frameId === 'frame-sovereign' ? 3.6 : 2.1, 10, 2);
  light.position.set(0, 0.25, 1.2);
  light.userData.v2115Signature = true;
  group.add(light);

  ship.add(group);
  state.group = group;
}

function renderForgeSignature(signature) {
  const forgePanel = $('#v2114-reward-forge .v2114-forge-shell');
  if (!forgePanel) return;
  let chip = $('.v2115-signature-chip', forgePanel);
  if (!chip) {
    chip = document.createElement('div');
    chip.className = 'v2115-signature-chip';
    const equipped = $('[data-v2114-equipped]', forgePanel);
    equipped?.insertAdjacentElement('afterend', chip);
  }
  chip.innerHTML = `<span>SHIP SIGNATURE</span><strong>${signature.theme.name}</strong><small>${signature.badgeIcon} ${signature.title}</small>`;
  chip.dataset.theme = signature.frameId;
}

function sync() {
  const g = game();
  const ship = g?.ship;
  if (!ship) return;
  const signature = currentSignature();
  const key = `${signature.frameId}|${signature.badgeId}|${signature.badgeIcon}|${signature.title}`;
  if (state.ship !== ship) {
    state.ship = ship;
    state.key = '';
    disposeSignature();
  }
  if (key !== state.key) {
    state.key = key;
    applyHullFinish(ship, signature.theme);
    buildSignature(ship, signature);
    renderForgeSignature(signature);
    document.body.dataset.v2115ShipSignature = signature.frameId;
    document.dispatchEvent(new CustomEvent('wae:ship-signature-changed', { detail: { ...signature, theme: signature.theme.name } }));
  }
  if (state.group) {
    const playing = g.state === 'playing' || g.state === 'paused';
    state.group.visible = playing;
    const ring = state.group.children.find((child) => child.geometry?.type === 'TorusGeometry');
    if (ring && g.state === 'playing') ring.rotation.z += signature.frameId === 'frame-sovereign' ? 0.018 : 0.009;
  }
}

window.setInterval(sync, 650);
window.addEventListener('pageshow', sync);
document.addEventListener('wae:rewards-changed', sync);
document.addEventListener('wae:v21-identity-changed', sync);
requestAnimationFrame(sync);

window.__waeShipSignature = Object.freeze({ get: currentSignature, refresh: sync });
