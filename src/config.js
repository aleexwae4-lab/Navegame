export const CONFIG = Object.freeze({
  version: '3.0.0',
  storageKey: 'wae_neon_rider_high_score_v3',
  world: {
    xMin: -16,
    xMax: 16,
    yMin: -9.5,
    yMax: 9.5,
    shipZ: 10,
    asteroidSpawnZ: -120,
    cullZ: 32,
  },
  ship: {
    speed: 22,
    radius: 1.35,
    shield: 100,
    hitDamage: 34,
  },
  laser: {
    speed: 92,
    cooldown: 0.16,
    rapidCooldown: 0.075,
    lifetimeZ: -145,
    radius: 0.65,
  },
  asteroid: {
    baseSpeed: 26,
    minRadius: 0.75,
    maxRadius: 2.45,
    spawnInterval: 0.92,
    minSpawnInterval: 0.32,
  },
  progression: {
    levelEvery: 450,
    maxSpeedMultiplier: 3.2,
    comboWindow: 2.2,
  },
  powerups: {
    dropChance: 0.14,
    shieldRestore: 30,
    rapidDuration: 7,
  },
  rendering: {
    stars: 1400,
    maxPixelRatio: 2,
  },
});
