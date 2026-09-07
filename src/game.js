import * as THREE from 'three';
import { CONFIG } from './config.js';
import { AudioEngine } from './audio.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function safeHighScore() {
  const value = Number.parseInt(localStorage.getItem(CONFIG.storageKey) ?? '0', 10);
  return Number.isFinite(value) ? value : 0;
}

export class NeonRiderGame {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.audio = new AudioEngine();
    this.clock = new THREE.Clock(false);
    this.state = 'idle';
    this.input = { up: false, down: false, left: false, right: false, shoot: false };

    this.score = 0;
    this.highScore = safeHighScore();
    this.shield = CONFIG.ship.shield;
    this.level = 1;
    this.combo = 0;
    this.comboTimer = 0;
    this.fireCooldown = 0;
    this.rapidFireTimer = 0;
    this.spawnTimer = 0;
    this.cameraKick = 0;
    this.hudTimer = 0;

    this.asteroids = [];
    this.lasers = [];
    this.particles = [];
    this.powerups = [];
    this.thrusters = [];

    this.loop = this.loop.bind(this);
    this.handleResize = this.handleResize.bind(this);
  }

  init() {
    try {
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x030712);
      this.scene.fog = new THREE.FogExp2(0x030712, 0.0115);

      this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 1000);
      this.camera.position.set(0, 4, 24);

      this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.rendering.maxPixelRatio));
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.08;
      this.container.replaceChildren(this.renderer.domElement);

      this.createLights();
      this.createReusableResources();
      this.createShip();
      this.createStarfield();
      this.createNebulae();

      window.addEventListener('resize', this.handleResize);
      this.callbacks.onReady?.(this.snapshot());
      this.renderer.setAnimationLoop(this.loop);
    } catch (error) {
      console.error('[WAE Neon Rider] WebGL initialization failed', error);
      this.callbacks.onFatal?.(error instanceof Error ? error.message : String(error));
    }
  }

  createLights() {
    const ambient = new THREE.AmbientLight(0x26364c, 2.2);
    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    const cyan = new THREE.PointLight(0x00f2fe, 6, 55, 1.8);
    const magenta = new THREE.PointLight(0xf43f8e, 5, 50, 1.8);
    key.position.set(16, 30, 22);
    cyan.position.set(-12, -5, 10);
    magenta.position.set(12, 6, -12);
    this.scene.add(ambient, key, cyan, magenta);
  }

  createReusableResources() {
    this.resources = {
      laserGeometry: new THREE.CylinderGeometry(0.1, 0.1, 2.7, 8),
      laserMaterial: new THREE.MeshBasicMaterial({ color: 0x22d3ee }),
      asteroidMaterial: new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.84, metalness: 0.18, flatShading: true }),
      shieldGeometry: new THREE.OctahedronGeometry(0.75, 0),
      shieldMaterial: new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.94 }),
      rapidGeometry: new THREE.TorusGeometry(0.65, 0.18, 8, 18),
      rapidMaterial: new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.94 }),
    };
    this.resources.laserGeometry.rotateX(Math.PI / 2);
  }

  createShip() {
    this.ship = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.92, roughness: 0.18 });
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.86, roughness: 0.3 });
    const cyan = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    const cyanSoft = new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.72 });
    const orange = new THREE.MeshBasicMaterial({ color: 0xfb923c, transparent: true, opacity: 0.94 });

    const bodyGeometry = new THREE.ConeGeometry(1.25, 4.9, 7);
    bodyGeometry.rotateX(Math.PI / 2);
    const body = new THREE.Mesh(bodyGeometry, metal);
    this.ship.add(body);

    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, 4.6), darkMetal);
    spine.position.set(0, -0.35, 0.35);
    this.ship.add(spine);

    const cockpitGeometry = new THREE.SphereGeometry(0.72, 18, 18);
    cockpitGeometry.scale(0.82, 0.52, 1.75);
    const cockpit = new THREE.Mesh(cockpitGeometry, cyanSoft);
    cockpit.position.set(0, 0.68, -0.35);
    this.ship.add(cockpit);

    const wing = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.16, 2.25), metal);
    wing.position.set(0, -0.12, 0.85);
    this.ship.add(wing);

    const wingTipGeometry = new THREE.BoxGeometry(0.32, 0.34, 2.9);
    for (const x of [-3.22, 3.22]) {
      const tip = new THREE.Mesh(wingTipGeometry, darkMetal);
      tip.position.set(x, -0.12, 0.75);
      this.ship.add(tip);

      const cannonGeometry = new THREE.CylinderGeometry(0.1, 0.1, 1.45, 10);
      cannonGeometry.rotateX(Math.PI / 2);
      const cannon = new THREE.Mesh(cannonGeometry, cyan);
      cannon.position.set(x, -0.08, -0.28);
      this.ship.add(cannon);
    }

    const thrusterBodyGeometry = new THREE.CylinderGeometry(0.42, 0.54, 1.1, 12);
    thrusterBodyGeometry.rotateX(Math.PI / 2);
    const flameGeometry = new THREE.ConeGeometry(0.38, 2.25, 10);
    flameGeometry.rotateX(-Math.PI / 2);

    for (const x of [-1.18, 1.18]) {
      const engine = new THREE.Mesh(thrusterBodyGeometry, darkMetal);
      engine.position.set(x, 0, 2.25);
      this.ship.add(engine);

      const flame = new THREE.Mesh(flameGeometry, orange.clone());
      flame.position.set(x, 0, 3.55);
      flame.userData.baseY = 1;
      this.thrusters.push(flame);
      this.ship.add(flame);
    }

    const glow = new THREE.PointLight(0x22d3ee, 4.5, 12, 2);
    glow.position.set(0, 0, 1.5);
    this.ship.add(glow);

    this.ship.position.set(0, 0, CONFIG.world.shipZ);
    this.scene.add(this.ship);
  }

  createStarfield() {
    const count = CONFIG.rendering.stars;
    this.starPositions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const index = i * 3;
      this.starPositions[index] = (Math.random() - 0.5) * 240;
      this.starPositions[index + 1] = (Math.random() - 0.5) * 180;
      this.starPositions[index + 2] = Math.random() * 300 - 210;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.starPositions, 3));
    const material = new THREE.PointsMaterial({ color: 0x7dd3fc, size: 0.72, transparent: true, opacity: 0.78, sizeAttenuation: true });
    this.starfield = new THREE.Points(geometry, material);
    this.scene.add(this.starfield);
  }

  createNebulae() {
    const geometry = new THREE.SphereGeometry(1, 20, 20);
    const nebulae = [
      { color: 0x0ea5e9, position: [-38, 22, -105], scale: [25, 13, 6], opacity: 0.055 },
      { color: 0xdb2777, position: [34, -18, -155], scale: [29, 17, 7], opacity: 0.045 },
    ];
    for (const item of nebulae) {
      const material = new THREE.MeshBasicMaterial({ color: item.color, transparent: true, opacity: item.opacity, depthWrite: false, blending: THREE.AdditiveBlending });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...item.position);
      mesh.scale.set(...item.scale);
      this.scene.add(mesh);
    }
  }

  snapshot() {
    return {
      state: this.state,
      score: this.score,
      highScore: this.highScore,
      shield: Math.max(0, Math.round(this.shield)),
      level: this.level,
      combo: this.combo,
      rapidFire: this.rapidFireTimer > 0,
      rapidFireSeconds: Math.max(0, Math.ceil(this.rapidFireTimer)),
    };
  }

  setInput(name, active) {
    if (Object.hasOwn(this.input, name)) this.input[name] = Boolean(active);
  }

  clearInput() {
    for (const key of Object.keys(this.input)) this.input[key] = false;
  }

  async start() {
    await this.audio.unlock();
    this.clearEntities();
    this.score = 0;
    this.shield = CONFIG.ship.shield;
    this.level = 1;
    this.combo = 0;
    this.comboTimer = 0;
    this.fireCooldown = 0;
    this.rapidFireTimer = 0;
    this.spawnTimer = 0.45;
    this.cameraKick = 0;
    this.hudTimer = 0;
    this.clearInput();
    this.ship.visible = true;
    this.ship.position.set(0, 0, CONFIG.world.shipZ);
    this.ship.rotation.set(0, 0, 0);
    this.camera.position.set(0, 4, 24);
    this.camera.rotation.set(0, 0, 0);
    this.state = 'playing';
    this.clock.start();
    this.clock.getDelta();
    this.callbacks.onState?.(this.state, this.snapshot());
    this.callbacks.onHud?.(this.snapshot());
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.clock.stop();
    this.clearInput();
    this.callbacks.onState?.(this.state, this.snapshot());
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.clock.start();
    this.clock.getDelta();
    this.callbacks.onState?.(this.state, this.snapshot());
  }

  togglePause() {
    if (this.state === 'playing') this.pause();
    else if (this.state === 'paused') this.resume();
  }

  toggleAudio() {
    return this.audio.toggle();
  }

  clearEntities() {
    for (const asteroid of this.asteroids) {
      this.scene.remove(asteroid);
      asteroid.geometry.dispose();
    }
    for (const laser of this.lasers) this.scene.remove(laser);
    for (const powerup of this.powerups) this.scene.remove(powerup);
    for (const particle of this.particles) {
      this.scene.remove(particle);
      particle.geometry.dispose();
      particle.material.dispose();
    }
    this.asteroids.length = 0;
    this.lasers.length = 0;
    this.powerups.length = 0;
    this.particles.length = 0;
  }

  spawnAsteroid() {
    const radius = THREE.MathUtils.lerp(CONFIG.asteroid.minRadius, CONFIG.asteroid.maxRadius, Math.random());
    const geometry = new THREE.DodecahedronGeometry(radius, 1);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i += 1) {
      const jitter = radius * 0.12;
      positions.setXYZ(
        i,
        positions.getX(i) + (Math.random() - 0.5) * jitter,
        positions.getY(i) + (Math.random() - 0.5) * jitter,
        positions.getZ(i) + (Math.random() - 0.5) * jitter,
      );
    }
    geometry.computeVertexNormals();
    const asteroid = new THREE.Mesh(geometry, this.resources.asteroidMaterial);
    asteroid.position.set(
      THREE.MathUtils.randFloat(CONFIG.world.xMin, CONFIG.world.xMax),
      THREE.MathUtils.randFloat(CONFIG.world.yMin, CONFIG.world.yMax),
      CONFIG.world.asteroidSpawnZ,
    );
    asteroid.userData = {
      radius,
      rotX: THREE.MathUtils.randFloatSpread(1.1),
      rotY: THREE.MathUtils.randFloatSpread(1.1),
      rotZ: THREE.MathUtils.randFloatSpread(0.8),
    };
    this.scene.add(asteroid);
    this.asteroids.push(asteroid);
  }

  fire() {
    if (this.fireCooldown > 0 || this.state !== 'playing') return;
    for (const offsetX of [-3.2, 3.2]) {
      const laser = new THREE.Mesh(this.resources.laserGeometry, this.resources.laserMaterial);
      laser.position.set(this.ship.position.x + offsetX, this.ship.position.y - 0.06, this.ship.position.z - 1.05);
      laser.userData.radius = CONFIG.laser.radius;
      this.scene.add(laser);
      this.lasers.push(laser);
    }
    this.fireCooldown = this.rapidFireTimer > 0 ? CONFIG.laser.rapidCooldown : CONFIG.laser.cooldown;
    this.audio.play('laser');
  }

  createExplosion(position, color = 0xfb923c, amount = 16) {
    const count = Math.min(amount, 30);
    for (let i = 0; i < count; i += 1) {
      const size = THREE.MathUtils.randFloat(0.08, 0.25);
      const mesh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(size, 0),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }),
      );
      mesh.position.copy(position);
      mesh.userData = {
        velocity: new THREE.Vector3(
          THREE.MathUtils.randFloatSpread(12),
          THREE.MathUtils.randFloatSpread(12),
          THREE.MathUtils.randFloatSpread(12),
        ),
        life: THREE.MathUtils.randFloat(0.34, 0.62),
        maxLife: 0,
      };
      mesh.userData.maxLife = mesh.userData.life;
      this.scene.add(mesh);
      this.particles.push(mesh);
    }
  }

  maybeDropPowerup(position) {
    if (Math.random() > CONFIG.powerups.dropChance) return;
    const type = Math.random() < 0.55 ? 'shield' : 'rapid';
    const geometry = type === 'shield' ? this.resources.shieldGeometry : this.resources.rapidGeometry;
    const material = type === 'shield' ? this.resources.shieldMaterial : this.resources.rapidMaterial;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.userData = { type, radius: 1.0, age: 0 };
    this.scene.add(mesh);
    this.powerups.push(mesh);
  }

  collectPowerup(powerup) {
    const { type } = powerup.userData;
    if (type === 'shield') {
      this.shield = Math.min(100, this.shield + CONFIG.powerups.shieldRestore);
      this.callbacks.onAnnounce?.('+ ESCUDO');
    } else {
      this.rapidFireTimer = CONFIG.powerups.rapidDuration;
      this.callbacks.onAnnounce?.('RÁFAGA NEÓN');
    }
    this.audio.play('powerup');
    navigator.vibrate?.(35);
    this.callbacks.onHud?.(this.snapshot());
  }

  hitShip(asteroid) {
    this.createExplosion(asteroid.position, 0xef4444, 24);
    this.audio.play('hit');
    navigator.vibrate?.([40, 30, 60]);
    this.shield -= CONFIG.ship.hitDamage;
    this.cameraKick = 1;
    this.combo = 0;
    this.comboTimer = 0;

    if (this.shield <= 0) {
      this.shield = 0;
      this.endGame();
    } else {
      this.callbacks.onAnnounce?.('IMPACTO · ESCUDO DAÑADO');
      this.callbacks.onHud?.(this.snapshot());
    }
  }

  registerKill(position) {
    this.combo = this.comboTimer > 0 ? this.combo + 1 : 1;
    this.comboTimer = CONFIG.progression.comboWindow;
    const multiplier = Math.min(5, 1 + Math.floor((this.combo - 1) / 3));
    this.score += 25 * multiplier;
    this.maybeDropPowerup(position);

    const previousLevel = this.level;
    this.level = Math.floor(this.score / CONFIG.progression.levelEvery) + 1;
    if (this.level > previousLevel) {
      this.audio.play('level');
      this.callbacks.onAnnounce?.(`NIVEL ${this.level}`);
    } else if (this.combo === 4 || this.combo === 8 || this.combo === 12) {
      this.callbacks.onAnnounce?.(`COMBO x${multiplier} · ${this.combo} BAJAS`);
    }
    this.callbacks.onHud?.(this.snapshot());
  }

  endGame() {
    this.state = 'gameover';
    this.clock.stop();
    this.clearInput();
    this.audio.play('explosion');
    this.createExplosion(this.ship.position, 0xef4444, 30);
    this.ship.visible = false;

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem(CONFIG.storageKey, String(this.highScore));
    }
    this.callbacks.onHud?.(this.snapshot());
    this.callbacks.onState?.(this.state, this.snapshot());
  }

  updateStarfield(delta, elapsed) {
    const speed = this.state === 'playing' ? 58 * this.speedMultiplier() : this.state === 'paused' ? 0 : 13;
    const attribute = this.starfield.geometry.attributes.position;
    for (let i = 2; i < attribute.array.length; i += 3) {
      attribute.array[i] += speed * delta;
      if (attribute.array[i] > 80) attribute.array[i] = -220;
    }
    attribute.needsUpdate = true;
    this.starfield.rotation.z = Math.sin(elapsed * 0.07) * 0.02;
  }

  speedMultiplier() {
    return Math.min(CONFIG.progression.maxSpeedMultiplier, 1 + (this.level - 1) * 0.12 + this.score * 0.00008);
  }

  currentSpawnInterval() {
    return Math.max(
      CONFIG.asteroid.minSpawnInterval,
      CONFIG.asteroid.spawnInterval - (this.level - 1) * 0.045 - this.score * 0.00008,
    );
  }

  updatePlaying(delta, elapsed) {
    this.fireCooldown = Math.max(0, this.fireCooldown - delta);
    this.rapidFireTimer = Math.max(0, this.rapidFireTimer - delta);
    this.comboTimer = Math.max(0, this.comboTimer - delta);
    this.hudTimer -= delta;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.2;
      this.callbacks.onHud?.(this.snapshot());
    }
    if (this.comboTimer === 0 && this.combo !== 0) {
      this.combo = 0;
      this.callbacks.onHud?.(this.snapshot());
    }

    let x = Number(this.input.right) - Number(this.input.left);
    let y = Number(this.input.up) - Number(this.input.down);
    if (x !== 0 && y !== 0) {
      x *= Math.SQRT1_2;
      y *= Math.SQRT1_2;
    }

    this.ship.position.x = clamp(this.ship.position.x + x * CONFIG.ship.speed * delta, CONFIG.world.xMin, CONFIG.world.xMax);
    this.ship.position.y = clamp(this.ship.position.y + y * CONFIG.ship.speed * delta, CONFIG.world.yMin, CONFIG.world.yMax);
    this.ship.rotation.z = THREE.MathUtils.lerp(this.ship.rotation.z, -x * 0.42, 1 - Math.pow(0.0008, delta));
    this.ship.rotation.x = THREE.MathUtils.lerp(this.ship.rotation.x, y * 0.22, 1 - Math.pow(0.001, delta));
    if (this.input.shoot) this.fire();

    this.spawnTimer -= delta;
    if (this.spawnTimer <= 0) {
      this.spawnAsteroid();
      this.spawnTimer = this.currentSpawnInterval();
    }

    this.updateLasers(delta);
    this.updateAsteroids(delta);
    this.updatePowerups(delta, elapsed);
    this.updateCamera(delta);
  }

  updateLasers(delta) {
    for (let i = this.lasers.length - 1; i >= 0; i -= 1) {
      const laser = this.lasers[i];
      laser.position.z -= CONFIG.laser.speed * delta;
      let consumed = false;

      for (let j = this.asteroids.length - 1; j >= 0; j -= 1) {
        const asteroid = this.asteroids[j];
        const radius = asteroid.userData.radius + laser.userData.radius;
        if (laser.position.distanceToSquared(asteroid.position) <= radius * radius) {
          const impactPosition = asteroid.position.clone();
          this.createExplosion(impactPosition, 0x22d3ee, 18);
          this.audio.play('explosion');
          this.scene.remove(asteroid);
          asteroid.geometry.dispose();
          this.asteroids.splice(j, 1);
          this.scene.remove(laser);
          this.lasers.splice(i, 1);
          consumed = true;
          this.registerKill(impactPosition);
          break;
        }
      }

      if (!consumed && laser.position.z < CONFIG.laser.lifetimeZ) {
        this.scene.remove(laser);
        this.lasers.splice(i, 1);
      }
    }
  }

  updateAsteroids(delta) {
    const speed = CONFIG.asteroid.baseSpeed * this.speedMultiplier();
    for (let i = this.asteroids.length - 1; i >= 0; i -= 1) {
      const asteroid = this.asteroids[i];
      asteroid.position.z += speed * delta;
      asteroid.rotation.x += asteroid.userData.rotX * delta;
      asteroid.rotation.y += asteroid.userData.rotY * delta;
      asteroid.rotation.z += asteroid.userData.rotZ * delta;

      const collisionRadius = asteroid.userData.radius + CONFIG.ship.radius;
      if (asteroid.position.distanceToSquared(this.ship.position) <= collisionRadius * collisionRadius) {
        this.scene.remove(asteroid);
        asteroid.geometry.dispose();
        this.asteroids.splice(i, 1);
        this.hitShip(asteroid);
        continue;
      }

      if (asteroid.position.z > CONFIG.world.cullZ) {
        this.scene.remove(asteroid);
        asteroid.geometry.dispose();
        this.asteroids.splice(i, 1);
        this.score += 8;
        const previousLevel = this.level;
        this.level = Math.floor(this.score / CONFIG.progression.levelEvery) + 1;
        if (this.level > previousLevel) {
          this.audio.play('level');
          this.callbacks.onAnnounce?.(`NIVEL ${this.level}`);
        }
        this.callbacks.onHud?.(this.snapshot());
      }
    }
  }

  updatePowerups(delta, elapsed) {
    const speed = 18 * this.speedMultiplier();
    for (let i = this.powerups.length - 1; i >= 0; i -= 1) {
      const powerup = this.powerups[i];
      powerup.userData.age += delta;
      powerup.position.z += speed * delta;
      powerup.rotation.x += 1.9 * delta;
      powerup.rotation.y += 2.5 * delta;
      powerup.scale.setScalar(1 + Math.sin(elapsed * 7 + i) * 0.08);

      const radius = CONFIG.ship.radius + powerup.userData.radius;
      if (powerup.position.distanceToSquared(this.ship.position) <= radius * radius) {
        this.collectPowerup(powerup);
        this.scene.remove(powerup);
        this.powerups.splice(i, 1);
        continue;
      }
      if (powerup.position.z > CONFIG.world.cullZ) {
        this.scene.remove(powerup);
        this.powerups.splice(i, 1);
      }
    }
  }

  updateParticles(delta) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const particle = this.particles[i];
      particle.userData.life -= delta;
      particle.position.addScaledVector(particle.userData.velocity, delta);
      particle.userData.velocity.multiplyScalar(Math.pow(0.16, delta));
      particle.material.opacity = Math.max(0, particle.userData.life / particle.userData.maxLife);
      if (particle.userData.life <= 0) {
        this.scene.remove(particle);
        particle.geometry.dispose();
        particle.material.dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  updateCamera(delta) {
    this.cameraKick = Math.max(0, this.cameraKick - delta * 4.5);
    const kick = this.cameraKick * Math.sin(performance.now() * 0.06) * 0.35;
    const targetX = this.ship.position.x * 0.145 + kick;
    const targetY = 4 + this.ship.position.y * 0.145 + kick * 0.5;
    const smoothing = 1 - Math.pow(0.02, delta);
    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetX, smoothing);
    this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, targetY, smoothing);
    this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, 24 + this.cameraKick * 0.65, smoothing);
    this.camera.rotation.set(0, 0, 0);
  }

  updateIdle(elapsed) {
    this.ship.visible = true;
    this.ship.position.x = Math.sin(elapsed * 0.8) * 2.1;
    this.ship.position.y = Math.cos(elapsed * 1.05) * 0.72;
    this.ship.position.z = CONFIG.world.shipZ;
    this.ship.rotation.z = Math.sin(elapsed * 0.9) * 0.13;
    this.ship.rotation.y = Math.sin(elapsed * 0.55) * 0.16;
    this.camera.position.x = Math.sin(elapsed * 0.3) * 2.2;
    this.camera.position.y = 4 + Math.cos(elapsed * 0.35) * 0.7;
    this.camera.position.z = 24;
    this.camera.lookAt(0, 0, -3);
  }

  animateThrusters(elapsed) {
    for (let i = 0; i < this.thrusters.length; i += 1) {
      const flame = this.thrusters[i];
      const pulse = 0.92 + Math.sin(elapsed * 34 + i * 0.8) * 0.16 + Math.random() * 0.05;
      flame.scale.set(1, pulse, 1);
      flame.material.opacity = 0.77 + Math.sin(elapsed * 22 + i) * 0.15;
    }
  }

  loop() {
    if (!this.renderer || !this.scene || !this.camera) return;
    const elapsed = performance.now() * 0.001;
    const delta = this.state === 'playing' ? Math.min(this.clock.getDelta(), 0.04) : this.state === 'paused' ? 0 : 1 / 60;

    this.animateThrusters(elapsed);
    this.updateStarfield(delta, elapsed);
    this.updateParticles(delta);

    if (this.state === 'playing') this.updatePlaying(delta, elapsed);
    else if (this.state === 'idle') this.updateIdle(elapsed);

    this.renderer.render(this.scene, this.camera);
  }

  handleResize() {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.rendering.maxPixelRatio));
  }
}
