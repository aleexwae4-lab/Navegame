import {
  BIOMES,
  CONFIG as V7_CONFIG,
  CONTRACTS,
  ENEMY_ROLES,
  GUARDIANS,
  PERKS,
  RARE_EVENTS,
} from '../v7/config.js';

export { BIOMES, CONTRACTS, ENEMY_ROLES, GUARDIANS, PERKS, RARE_EVENTS };

export const MINI_BOSSES = Object.freeze({
  breaker: Object.freeze({
    id: 'breaker', name: 'VOID BREAKER', title: 'MINI-BOSS · ARTILLERÍA',
    hpMultiplier: 3.6, scale: 1.48, rewardScore: 720, rewardCores: 2,
  }),
  lancer: Object.freeze({
    id: 'lancer', name: 'SOLAR LANCER', title: 'MINI-BOSS · INTERCEPTOR',
    hpMultiplier: 3.15, scale: 1.38, rewardScore: 760, rewardCores: 2,
  }),
  phantom: Object.freeze({
    id: 'phantom', name: 'RIFT PHANTOM', title: 'MINI-BOSS · CAZADOR',
    hpMultiplier: 3.35, scale: 1.42, rewardScore: 820, rewardCores: 2,
  }),
  citadel: Object.freeze({
    id: 'citadel', name: 'EMERALD CITADEL', title: 'MINI-BOSS · FORTALEZA',
    hpMultiplier: 4.15, scale: 1.58, rewardScore: 900, rewardCores: 3,
  }),
});

export const CINEMATIC_ENCOUNTERS = Object.freeze([
  Object.freeze({ id: 'ace-wing', name: 'ALA DE ASES', description: 'Una escuadra élite entra al corredor.', kind: 'elites' }),
  Object.freeze({ id: 'core-storm', name: 'TORMENTA DE CORES', description: 'El reactor absorbe energía y acelera HEAT.', kind: 'heat' }),
  Object.freeze({ id: 'last-stand', name: 'ÚLTIMA LÍNEA', description: 'Reparación táctica antes del Guardián.', kind: 'repair' }),
]);

export const CONFIG = Object.freeze({
  ...V7_CONFIG,
  version: '8.0.0',
  profileKey: 'wae_neon_rider_profile_v8',
  legacyProfileKey: V7_CONFIG.profileKey,
  cinematic: Object.freeze({
    telegraphWindow: 0.72,
    slowmoDuration: 0.26,
    slowmoScale: 0.38,
    bossSlowmoDuration: 0.34,
    fovKick: 6,
  }),
  missile: Object.freeze({
    cooldown: 7.5,
    speed: 88,
    turnRate: 7.5,
    droneDamage: 8,
    bossDamage: 10,
    blastRadius: 3.2,
  }),
  wingman: Object.freeze({
    fireInterval: 1.15,
    orbitRadius: 2.15,
    orbitSpeed: 1.7,
  }),
  miniboss: Object.freeze({
    minSector: 2,
    spawnAt: 21,
    baseChance: 0.64,
  }),
  encounter: Object.freeze({
    spawnAt: 31,
    chance: 0.62,
  }),
});
