import * as THREE from 'three';

function installCinematicPass() {
  const game = window.__waeNeonRiderGame;
  if (!game?.scene || !game?.renderer || game.__waeV14Cinematic) return;
  game.__waeV14Cinematic = true;

  game.renderer.toneMappingExposure = 1.16;
  if (game.scene.fog?.isFogExp2) game.scene.fog.density = Math.max(0.0075, game.scene.fog.density * 0.88);

  const hemi = new THREE.HemisphereLight(0x9ee7ff, 0x090314, 0.75);
  hemi.position.set(0, 22, 0);
  game.scene.add(hemi);

  const rim = new THREE.PointLight(0x8b5cf6, 7, 36, 2);
  rim.position.set(0, 8, 6);
  game.scene.add(rim);

  const isCompact = window.matchMedia('(max-width: 720px)').matches;
  const count = isCompact ? 220 : 520;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 95;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 58;
    positions[i * 3 + 2] = -8 - Math.random() * 180;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const dustMat = new THREE.PointsMaterial({ color: 0xc4f1ff, size: isCompact ? 0.11 : 0.15, transparent: true, opacity: 0.36, sizeAttenuation: true, depthWrite: false });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.name = 'WAE_V14_CINEMATIC_DUST';
  game.scene.add(dust);

  if (game.resources?.asteroidMaterial) {
    game.resources.asteroidMaterial.roughness = 0.72;
    game.resources.asteroidMaterial.metalness = 0.28;
  }

  if (game.ship) {
    const auraMaterial = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false });
    const aura = new THREE.Mesh(new THREE.TorusGeometry(3.25, 0.035, 8, 54), auraMaterial);
    aura.rotation.x = Math.PI / 2;
    aura.position.z = 1.35;
    aura.name = 'WAE_V14_ENGINE_AURA';
    game.ship.add(aura);

    const engineGlow = new THREE.PointLight(0x38bdf8, 3.2, 11, 2.1);
    engineGlow.position.set(0, -0.15, 2.9);
    game.ship.add(engineGlow);
  }

  const baseLoop = game.loop?.bind(game);
  if (baseLoop) {
    game.loop = function waeV14Loop(...args) {
      if (dust) {
        dust.rotation.z += 0.00018;
        dust.position.z += 0.012;
        if (dust.position.z > 12) dust.position.z = 0;
      }
      const aura = game.ship?.getObjectByName?.('WAE_V14_ENGINE_AURA');
      if (aura) aura.rotation.z += 0.006;
      return baseLoop(...args);
    };
    game.renderer.setAnimationLoop(game.loop);
  }
}

installCinematicPass();
