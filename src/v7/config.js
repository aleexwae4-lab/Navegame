import { CONFIG as V6_CONFIG, BIOMES, ENEMY_ROLES, PERKS } from '../v6/config.js';

export { BIOMES, ENEMY_ROLES, PERKS };

export const CONTRACTS = Object.freeze({
  stable: Object.freeze({
    id: 'stable', name: 'RUTA ESTABLE', tag: 'CONTROL',
    description: 'Entrada segura al siguiente sector con reparación inmediata.',
    eliteChance: 0.08, scoreMultiplier: 1, damageMultiplier: 1, eliteReward: 1, repair: 0.12, bossCores: 0,
  }),
  bounty: Object.freeze({
    id: 'bounty', name: 'CACERÍA ÉLITE', tag: 'RECOMPENSA',
    description: 'Más enemigos élite. Cada élite destruido paga Cores adicionales.',
    eliteChance: 0.34, scoreMultiplier: 1.15, damageMultiplier: 1.05, eliteReward: 1.55, repair: 0, bossCores: 1,
  }),
  volatile: Object.freeze({
    id: 'volatile', name: 'ANOMALÍA VOLÁTIL', tag: 'ALTO RIESGO',
    description: 'Recibes más daño, pero toda baja y Guardián valen mucho más.',
    eliteChance: 0.2, scoreMultiplier: 1.48, damageMultiplier: 1.25, eliteReward: 1.8, repair: 0, bossCores: 2,
  }),
});

export const GUARDIANS = Object.freeze({
  'cyan-void': Object.freeze({ id: 'helix', name: 'HELIX WARDEN', title: 'GUARDIÁN DEL VACÍO', hp: 1.0, signature: 2.6 }),
  'solar-storm': Object.freeze({ id: 'forge', name: 'SOLAR FORGE', title: 'CORAZÓN DE LA TORMENTA', hp: 1.12, signature: 3.15 }),
  'violet-rift': Object.freeze({ id: 'seer', name: 'RIFT SEER', title: 'ORÁCULO DE LA FALLA', hp: 1.08, signature: 2.85 }),
  'emerald-front': Object.freeze({ id: 'bastion', name: 'VERDANT BASTION', title: 'FORTALEZA VIVIENTE', hp: 1.18, signature: 4.3 }),
});

export const RARE_EVENTS = Object.freeze([
  Object.freeze({ id: 'cache', name: 'CACHÉ WAE', description: '+1 Core y carga parcial de HEAT.' }),
  Object.freeze({ id: 'repair', name: 'VENTANA DE REPARACIÓN', description: 'Recuperación de escudo de emergencia.' }),
  Object.freeze({ id: 'surge', name: 'SOBRECARGA IÓNICA', description: 'El reactor entra inmediatamente en OVERDRIVE.' }),
  Object.freeze({ id: 'hunters', name: 'SEÑAL DE CAZADORES', description: 'Dos élites irrumpen en el sector.' }),
]);

export const CONFIG = Object.freeze({
  ...V6_CONFIG,
  version: '7.0.0',
  profileKey: 'wae_neon_rider_profile_v7',
  legacyProfileKey: V6_CONFIG.profileKey,
  dash: Object.freeze({ cooldown: 4.8, distance: 8.2, invulnerability: 0.52 }),
  elite: Object.freeze({ hpMultiplier: 2.35, scale: 1.24, score: 260, cores: 1, minSector: 2 }),
  events: Object.freeze({ firstWindow: 13, chance: 0.78 }),
});
