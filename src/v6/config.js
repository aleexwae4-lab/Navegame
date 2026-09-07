import { CONFIG as V5_CONFIG } from '../v5/config.js';

export const BIOMES = Object.freeze([
  Object.freeze({ id: 'cyan-void', name: 'VACÍO CYAN', background: 0x020617, fog: 0x07152c, star: 0x7dd3fc, accent: 0x22d3ee }),
  Object.freeze({ id: 'solar-storm', name: 'TORMENTA SOLAR', background: 0x140903, fog: 0x2b1107, star: 0xfbbf24, accent: 0xfb923c }),
  Object.freeze({ id: 'violet-rift', name: 'FALLA VIOLETA', background: 0x10051d, fog: 0x27103d, star: 0xe879f9, accent: 0xc084fc }),
  Object.freeze({ id: 'emerald-front', name: 'FRENTE ESMERALDA', background: 0x03110d, fog: 0x062a20, star: 0x6ee7b7, accent: 0x34d399 }),
]);

export const ENEMY_ROLES = Object.freeze({
  raider: Object.freeze({ id: 'raider', name: 'RAIDER', hp: 2, speed: 1.18, fire: 1.2, amplitude: 4.8, radius: 1.35, scale: [1.0, 0.72, 1.5], bulletSpeed: 1.0 }),
  sentinel: Object.freeze({ id: 'sentinel', name: 'SENTINEL', hp: 5, speed: 0.72, fire: 0.82, amplitude: 1.7, radius: 1.7, scale: [1.35, 1.0, 1.35], bulletSpeed: 0.88 }),
  sniper: Object.freeze({ id: 'sniper', name: 'SNIPER', hp: 3, speed: 0.58, fire: 1.85, amplitude: 2.2, radius: 1.4, scale: [0.86, 0.66, 1.7], bulletSpeed: 1.7 }),
  swarm: Object.freeze({ id: 'swarm', name: 'SWARM', hp: 1, speed: 1.48, fire: 1.45, amplitude: 6.2, radius: 1.0, scale: [0.7, 0.56, 1.0], bulletSpeed: 1.08 }),
});

export const PERKS = Object.freeze({
  overclock: Object.freeze({ id: 'overclock', name: 'OVERCLOCK', description: 'Cadencia primaria +18%.', stat: 'fireCooldown', multiplier: 0.82 }),
  reactor: Object.freeze({ id: 'reactor', name: 'REACTOR ROJO', description: 'Generación de HEAT +30%.', stat: 'heatGain', multiplier: 1.3 }),
  bulwark: Object.freeze({ id: 'bulwark', name: 'BULWARK', description: 'Escudo máximo +25% y recupera la nueva capacidad.', stat: 'shield', multiplier: 1.25 }),
  phase: Object.freeze({ id: 'phase', name: 'NÚCLEO PHASE', description: 'Recarga del Pulso Nova -30%.', stat: 'secondaryCooldown', multiplier: 0.7 }),
  bounty: Object.freeze({ id: 'bounty', name: 'BOUNTY LINK', description: 'Puntuación por bajas +25%.', stat: 'scoreGain', multiplier: 1.25 }),
  capacitor: Object.freeze({ id: 'capacitor', name: 'CAPACITOR X', description: 'Daño del Pulso Nova +60%.', stat: 'secondaryPower', multiplier: 1.6 }),
  nanites: Object.freeze({ id: 'nanites', name: 'NANITES', description: 'Recupera 18% del escudo al limpiar cada sector.', stat: 'sectorHeal', add: 0.18 }),
  disruptor: Object.freeze({ id: 'disruptor', name: 'DISRUPTOR', description: 'Velocidad enemiga -12%.', stat: 'enemySpeed', multiplier: 0.88 }),
});

export const CONFIG = Object.freeze({
  ...V5_CONFIG,
  version: '6.0.0',
  profileKey: 'wae_neon_rider_profile_v6',
  legacyProfileKey: V5_CONFIG.profileKey,
  drone: Object.freeze({
    ...V5_CONFIG.drone,
    maxActive: 6,
  }),
  secondary: Object.freeze({
    cooldown: 11,
    droneDamage: 4,
    bossDamage: 6,
  }),
  bossPhases: Object.freeze({
    phase2: 0.66,
    phase3: 0.33,
  }),
});
