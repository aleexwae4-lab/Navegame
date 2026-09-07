import {
  BIOMES,
  CINEMATIC_ENCOUNTERS,
  CONFIG as V8_CONFIG,
  CONTRACTS,
  ENEMY_ROLES,
  GUARDIANS,
  MINI_BOSSES,
  PERKS,
  RARE_EVENTS,
} from '../v8/config.js';

export { BIOMES, CINEMATIC_ENCOUNTERS, CONTRACTS, ENEMY_ROLES, GUARDIANS, MINI_BOSSES, PERKS, RARE_EVENTS };

export const FACTIONS = Object.freeze({
  'cyan-void': Object.freeze({
    id: 'helix-dominion', name: 'DOMINIO HELIX', short: 'HELIX', doctrine: 'VELOCIDAD VECTORIAL',
    description: 'Escuadras rápidas que presionan el espacio de maniobra.',
    enemySpeed: 1.08, bulletSpeed: 1, damage: 1, eliteBonus: 0.02, accent: '#67e8f9',
  }),
  'solar-storm': Object.freeze({
    id: 'solar-foundry', name: 'FORJA SOLAR', short: 'FORJA', doctrine: 'ARTILLERÍA TÉRMICA',
    description: 'Proyectiles más veloces y daño sostenido.',
    enemySpeed: 1, bulletSpeed: 1.12, damage: 1.08, eliteBonus: 0.02, accent: '#fdba74',
  }),
  'violet-rift': Object.freeze({
    id: 'rift-covenant', name: 'PACTO DE LA FALLA', short: 'RIFT', doctrine: 'CAZADORES ÉLITE',
    description: 'Mayor presencia de unidades élite y cazadores especializados.',
    enemySpeed: 1.03, bulletSpeed: 1.05, damage: 1.02, eliteBonus: 0.12, accent: '#e879f9',
  }),
  'emerald-front': Object.freeze({
    id: 'verdant-legion', name: 'LEGIÓN VERDANT', short: 'VERDANT', doctrine: 'GUERRA DE DESGASTE',
    description: 'Formaciones resistentes que prolongan los encuentros.',
    enemySpeed: 0.98, bulletSpeed: 1, damage: 1.05, eliteBonus: 0.06, accent: '#6ee7b7',
  }),
});

export const SIDE_OBJECTIVES = Object.freeze([
  Object.freeze({ id: 'combo', name: 'CADENA PERFECTA', description: 'Alcanza combo 8.', target: 8, rewardCores: 1, rewardRenown: 1 }),
  Object.freeze({ id: 'elite', name: 'CAZA PRIORITARIA', description: 'Destruye 2 élites en el sector.', target: 2, rewardCores: 2, rewardRenown: 2 }),
  Object.freeze({ id: 'missile', name: 'DOCTRINA MISIL', description: 'Dispara 2 misiles WAE durante el sector.', target: 2, rewardCores: 1, rewardRenown: 1 }),
  Object.freeze({ id: 'shield', name: 'ESCUDO DE ACERO', description: 'Mantén al menos 70% de escudo durante 20 s.', target: 20, rewardCores: 2, rewardRenown: 2 }),
  Object.freeze({ id: 'score', name: 'SUPERIORIDAD', description: 'Genera 1,200 puntos dentro del sector.', target: 1200, rewardCores: 1, rewardRenown: 1 }),
]);

export const CAMPAIGN_RANKS = Object.freeze([
  Object.freeze({ min: 0, name: 'PILOTO' }),
  Object.freeze({ min: 4, name: 'AS DE SECTOR' }),
  Object.freeze({ min: 10, name: 'VANGUARDIA' }),
  Object.freeze({ min: 20, name: 'COMANDANTE ESTELAR' }),
  Object.freeze({ min: 36, name: 'LEYENDA WAE' }),
]);

export const CONFIG = Object.freeze({
  ...V8_CONFIG,
  version: '9.0.0',
  profileKey: 'wae_neon_rider_profile_v9',
  legacyProfileKey: V8_CONFIG.profileKey,
  campaign: Object.freeze({
    chapterEvery: 4,
    objectiveGrace: 1.2,
  }),
});
