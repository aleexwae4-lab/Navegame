import {
  BIOMES,
  CAMPAIGN_RANKS,
  CINEMATIC_ENCOUNTERS,
  CONFIG as V9_CONFIG,
  CONTRACTS,
  ENEMY_ROLES,
  FACTIONS,
  GUARDIANS,
  MINI_BOSSES,
  PERKS,
  RARE_EVENTS,
  SIDE_OBJECTIVES,
} from '../v9/config.js';

export {
  BIOMES,
  CAMPAIGN_RANKS,
  CINEMATIC_ENCOUNTERS,
  CONTRACTS,
  ENEMY_ROLES,
  FACTIONS,
  GUARDIANS,
  MINI_BOSSES,
  PERKS,
  RARE_EVENTS,
  SIDE_OBJECTIVES,
};

export const MASTERY_RANKS = Object.freeze([
  Object.freeze({ min: 0, name: 'CADETE' }),
  Object.freeze({ min: 5, name: 'PILOTO' }),
  Object.freeze({ min: 15, name: 'AS' }),
  Object.freeze({ min: 35, name: 'CAZADOR ESTELAR' }),
  Object.freeze({ min: 70, name: 'GUARDIÁN WAE' }),
  Object.freeze({ min: 120, name: 'LEYENDA' }),
]);

export const CONFIG = Object.freeze({
  ...V9_CONFIG,
  version: '10.1.0',
  profileKey: 'wae_neon_rider_profile_v10',
  legacyProfileKey: V9_CONFIG.profileKey,
  mastery: Object.freeze({
    launchGraceSeconds: 5.5,
    launchDamageScale: 0.45,
    entryTelegraphSeconds: 0.82,
    shotTelegraphSeconds: 0.34,
    comboTarget: 10,
    killMilestoneEvery: 25,
    rewards: Object.freeze({
      combo: 1,
      objective: 2,
      miniboss: 2,
      guardian: 3,
      cleanSector: 4,
      killMilestone: 2,
    }),
    coachTimeline: Object.freeze([
      Object.freeze({ at: 0.7, text: 'ARRASTRA EN EL ESPACIO O USA LAS FLECHAS PARA MOVERTE' }),
      Object.freeze({ at: 3.2, text: 'MANTÉN FUEGO · DESTRUYE TODO LO QUE ENTRE EN TU LÍNEA' }),
      Object.freeze({ at: 6.3, text: 'PULSO · LIMPIA PROYECTILES CUANDO TE RODEEN' }),
      Object.freeze({ at: 9.4, text: 'ESQUIVA · ÚSALA CUANDO EL PELIGRO ESTÉ ENCIMA' }),
      Object.freeze({ at: 12.4, text: 'MISIL · BUSCA AUTOMÁTICAMENTE EL OBJETIVO MÁS PELIGROSO' }),
    ]),
  }),
});
