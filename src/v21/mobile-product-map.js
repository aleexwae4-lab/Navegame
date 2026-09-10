import { PREMIUM_PRODUCTS } from '../v11/catalog.js';

const makeStoreId = (sku) => `com.waeproduction.neonrider.${String(sku || '').toLowerCase().replace(/^wae-/, '').replace(/-/g, '.')}`;

export const MOBILE_STORE_PRODUCTS = Object.freeze(PREMIUM_PRODUCTS.map((product) => Object.freeze({
  sku: product.sku,
  kind: product.kind,
  name: product.name,
  rarity: product.rarity,
  priceMxn: product.priceMxn,
  appleProductId: makeStoreId(product.sku),
  googleProductId: makeStoreId(product.sku),
  type: 'non_consumable',
})));

export const MOBILE_STORE_BY_SKU = Object.freeze(Object.fromEntries(MOBILE_STORE_PRODUCTS.map((entry) => [entry.sku, entry])));
export const MOBILE_STORE_BY_PRODUCT_ID = Object.freeze(Object.fromEntries(MOBILE_STORE_PRODUCTS.flatMap((entry) => [
  [entry.appleProductId, entry],
  [entry.googleProductId, entry],
])));

export function mobileProductForSku(sku) {
  return MOBILE_STORE_BY_SKU[String(sku || '')] || null;
}

export function mobileProductForStoreId(productId) {
  return MOBILE_STORE_BY_PRODUCT_ID[String(productId || '')] || null;
}
