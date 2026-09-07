export const COMMERCE_VERSION = '11.0.0';
export const CURRENCY = 'MXN';

const product = (entry) => Object.freeze({
  purchasable: true,
  fulfillment: 'server_entitlement_required',
  ...entry,
});

export const PREMIUM_SHIPS = Object.freeze([
  product({
    id: 'viper-black', sku: 'WAE-SHIP-VIPER-BLK', kind: 'ship', rarity: 'PREMIUM',
    name: 'VIPER R BLACK EDITION', series: 'WAE BLACK SERIES', priceMxn: 49,
    tagline: 'Velocidad brutal en acabado obsidiana.',
    description: 'Interceptor premium de respuesta inmediata, firma luminosa negra/cian y reactor de alta cadencia.',
    stats: { speed: 128, shield: 108, fireRate: 118, power: 116 }, accent: '#22d3ee',
  }),
  product({
    id: 'aegis-sovereign', sku: 'WAE-SHIP-AEGIS-SOV', kind: 'ship', rarity: 'ELITE',
    name: 'AEGIS SOVEREIGN', series: 'WAE SOVEREIGN SERIES', priceMxn: 89,
    tagline: 'Blindaje de élite. Presencia imperial.',
    description: 'Chasis pesado con escudo reforzado, estabilización de fuego y arquitectura visual de lujo.',
    stats: { speed: 105, shield: 152, fireRate: 112, power: 134 }, accent: '#fbbf24',
  }),
  product({
    id: 'nova-imperium', sku: 'WAE-SHIP-NOVA-IMP', kind: 'ship', rarity: 'LEGENDARY',
    name: 'NOVA IMPERIUM', series: 'WAE IMPERIUM SERIES', priceMxn: 149,
    tagline: 'Potencia de crucero con núcleo Nova.',
    description: 'Nave legendaria balanceada para dominar oleadas, élites y Guardianes con presencia cinematográfica.',
    stats: { speed: 122, shield: 138, fireRate: 132, power: 158 }, accent: '#f472b6',
  }),
  product({
    id: 'eclipse-x', sku: 'WAE-SHIP-ECLIPSE-X', kind: 'ship', rarity: 'MYTHIC',
    name: 'WAE ECLIPSE X', series: 'WAE ECLIPSE SERIES', priceMxn: 249,
    tagline: 'Depredador de Guardianes.',
    description: 'Plataforma mítica de asalto con sobrecarga energética, escudo activo y multiplicador de armamento pesado.',
    stats: { speed: 135, shield: 156, fireRate: 148, power: 188 }, accent: '#a78bfa',
  }),
  product({
    id: 'obsidian-one', sku: 'WAE-SHIP-OBSIDIAN-1', kind: 'ship', rarity: 'COLLECTOR',
    name: 'WAE OBSIDIAN ONE', series: 'WAE OBSIDIAN SERIES', priceMxn: 399,
    tagline: 'Colección negra de máxima especificación.',
    description: 'Edición de coleccionista con perfil oscuro, reactor exclusivo y estadísticas superiores para PvE.',
    stats: { speed: 146, shield: 172, fireRate: 158, power: 216 }, accent: '#94a3b8',
  }),
  product({
    id: 'celestial-crown', sku: 'WAE-SHIP-CELESTIAL', kind: 'ship', rarity: 'FOUNDER',
    name: 'WAE CELESTIAL CROWN', series: 'WAE FOUNDER SERIES', priceMxn: 699,
    tagline: 'La nave insignia de la colección WAE.',
    description: 'Founder flagship: máxima potencia de catálogo, firma dorada, presencia única y estatus de colección.',
    stats: { speed: 158, shield: 188, fireRate: 172, power: 250 }, accent: '#fde68a',
  }),
]);

export const PREMIUM_WEAPONS = Object.freeze([
  product({ id: 'trident-vxr', sku: 'WAE-WPN-TRIDENT-VXR', kind: 'weapon', rarity: 'PREMIUM', name: 'TRIDENT VX-R', series: 'BLACK ARSENAL', priceMxn: 39, tagline: 'Triple haz reforzado.', description: 'Tres carriles de energía concentrada con mayor cadencia y penetración.', stats: { damage: 118, cadence: 122, coverage: 126, special: 108 }, accent: '#22d3ee' }),
  product({ id: 'storm-omega', sku: 'WAE-WPN-STORM-OMG', kind: 'weapon', rarity: 'ELITE', name: 'STORM OMEGA', series: 'SOVEREIGN ARSENAL', priceMxn: 69, tagline: 'Saturación táctica de cuatro haces.', description: 'Cobertura amplia para oleadas y control de múltiples amenazas.', stats: { damage: 126, cadence: 134, coverage: 150, special: 116 }, accent: '#60a5fa' }),
  product({ id: 'eclipse-cannon', sku: 'WAE-WPN-ECLIPSE-CNN', kind: 'weapon', rarity: 'LEGENDARY', name: 'ECLIPSE CANNON', series: 'ECLIPSE ARSENAL', priceMxn: 99, tagline: 'Impacto penetrante de alto calibre.', description: 'Disparo concentrado pensado para élites, mini-bosses y blindaje pesado.', stats: { damage: 166, cadence: 112, coverage: 116, special: 152 }, accent: '#c084fc' }),
  product({ id: 'helix-railgun', sku: 'WAE-WPN-HELIX-RG', kind: 'weapon', rarity: 'MYTHIC', name: 'HELIX RAILGUN', series: 'HELIX ARSENAL', priceMxn: 129, tagline: 'Precisión hiperveloz.', description: 'Railgun de trayectoria estable con potencia crítica y control quirúrgico.', stats: { damage: 182, cadence: 128, coverage: 108, special: 176 }, accent: '#67e8f9' }),
  product({ id: 'nova-destroyer', sku: 'WAE-WPN-NOVA-DST', kind: 'weapon', rarity: 'COLLECTOR', name: 'NOVA DESTROYER', series: 'NOVA ARSENAL', priceMxn: 179, tagline: 'Explosión energética de área.', description: 'Sistema de destrucción pesada diseñado para limpiar zonas de combate.', stats: { damage: 198, cadence: 132, coverage: 162, special: 188 }, accent: '#fb7185' }),
  product({ id: 'wae-singularity', sku: 'WAE-WPN-SINGULARITY', kind: 'weapon', rarity: 'FOUNDER', name: 'WAE SINGULARITY', series: 'FOUNDER ARSENAL', priceMxn: 249, tagline: 'El arma máxima del catálogo.', description: 'Tecnología Founder con daño, cobertura y efecto especial de máxima categoría.', stats: { damage: 235, cadence: 148, coverage: 188, special: 250 }, accent: '#fde68a' }),
]);

export const PREMIUM_PRODUCTS = Object.freeze([...PREMIUM_SHIPS, ...PREMIUM_WEAPONS]);

export const STORE_POLICY = Object.freeze({
  checkoutEnabled: false,
  entitlementSource: 'server',
  message: 'El pago real todavía no está conectado. Ningún producto se concede sin confirmación segura del servidor.',
});
