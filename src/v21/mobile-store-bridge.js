import { Capacitor } from '@capacitor/core';
import { store, ProductType, Platform } from 'capacitor-plugin-cdv-purchase';
import { commerceState, commerceSnapshot, refreshEntitlements } from '../v12/backend.js';
import { MOBILE_STORE_PRODUCTS, mobileProductForSku, mobileProductForStoreId } from './mobile-product-map.js';

const $ = (selector, root = document) => root.querySelector(selector);
const API_URL = String(import.meta.env.VITE_WAE_SUPABASE_URL || '').replace(/\/$/, '');
const API_KEY = String(import.meta.env.VITE_WAE_SUPABASE_PUBLISHABLE_KEY || '');
const FUNCTION_URL = API_URL ? `${API_URL}/functions/v1/wae-mobile-commerce` : '';
const PLATFORM = Capacitor.getPlatform();
const NATIVE = Capacitor.isNativePlatform();
const STORE_PLATFORM = PLATFORM === 'ios' ? Platform.APPLE_APPSTORE : PLATFORM === 'android' ? Platform.GOOGLE_PLAY : null;
const PENDING_KEY = 'wae_neon_rider_v21_mobile_purchase_intents';

const state = {
  initialized: false,
  initializing: false,
  ready: false,
  restoring: false,
  products: new Map(),
  verifier: { android: false, ios: false },
  lastError: '',
  pendingTransactions: new Map(),
};

function storeLabel() {
  if (PLATFORM === 'ios') return 'APP STORE';
  if (PLATFORM === 'android') return 'GOOGLE PLAY';
  return 'MOBILE STORE';
}

function storeProductId(entry) {
  return PLATFORM === 'ios' ? entry.appleProductId : entry.googleProductId;
}

function readPending() {
  try {
    const raw = JSON.parse(localStorage.getItem(PENDING_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch { return {}; }
}

function writePending(value) {
  try {
    if (Object.keys(value || {}).length) localStorage.setItem(PENDING_KEY, JSON.stringify(value));
    else localStorage.removeItem(PENDING_KEY);
  } catch {}
}

function pendingIntent(productId) {
  return readPending()[String(productId || '')] || null;
}

function savePendingIntent(productId, intent) {
  const all = readPending();
  if (intent?.id) all[productId] = intent;
  else delete all[productId];
  writePending(all);
}

function signedIn() { return Boolean(commerceState.session?.access_token); }
function ownsSku(sku) { return new Set(commerceSnapshot()?.ownedSkus || []).has(String(sku || '')); }

function nativeApiHeaders() {
  const token = commerceState.session?.access_token;
  if (!FUNCTION_URL || !API_KEY) throw new Error('MOBILE_COMMERCE_NOT_CONFIGURED');
  if (!token) throw new Error('AUTH_REQUIRED');
  return { apikey: API_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function mobileApi(body, method = 'POST') {
  const response = await fetch(FUNCTION_URL, {
    method,
    headers: nativeApiHeaders(),
    body: method === 'GET' ? undefined : JSON.stringify(body || {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error || 'MOBILE_COMMERCE_FAILED');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function ensureNotice() {
  let notice = $('#v2121-native-commerce-notice');
  if (notice) return notice;
  notice = document.createElement('section');
  notice.id = 'v2121-native-commerce-notice';
  notice.className = 'v2121-native-commerce-notice hidden';
  notice.setAttribute('role', 'dialog');
  notice.setAttribute('aria-modal', 'true');
  notice.innerHTML = `
    <div class="v2121-native-commerce-backdrop" data-v2121-close></div>
    <article>
      <button type="button" data-v2121-close aria-label="Cerrar">×</button>
      <span>WAE STORE · ${storeLabel()}</span>
      <h3 data-v2122-notice-title>COMPRA MÓVIL PROTEGIDA</h3>
      <p data-v2122-notice-message>Las compras móviles se procesan exclusivamente mediante la tienda oficial y se validan en servidores WAE antes de entregar el artículo.</p>
      <small data-v2122-notice-detail>Si ya posees este artículo, inicia sesión y restaura tus compras.</small>
      <button type="button" data-v2121-close>ENTENDIDO</button>
    </article>`;
  document.body.append(notice);
  return notice;
}

function showNotice(title, message, detail = '') {
  const notice = ensureNotice();
  $('[data-v2122-notice-title]', notice).textContent = title || 'WAE STORE';
  $('[data-v2122-notice-message]', notice).textContent = message || '';
  $('[data-v2122-notice-detail]', notice).textContent = detail || '';
  notice.classList.remove('hidden');
  document.body.classList.add('v2121-native-commerce-open');
}

function closeNotice() {
  ensureNotice().classList.add('hidden');
  document.body.classList.remove('v2121-native-commerce-open');
}

function showToast(message, tone = '') {
  let toast = $('#v2122-store-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'v2122-store-toast';
    toast.className = 'v2122-store-toast';
    document.body.append(toast);
  }
  toast.dataset.tone = tone;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function openAuth() {
  const auth = $('[data-v12-auth]');
  if (auth) { auth.click(); return; }
  $('[data-open-v11-store]')?.click();
  window.setTimeout(() => $('[data-v12-auth]')?.click(), 120);
}

function productPrice(product) {
  return product?.pricing?.price || product?.offers?.[0]?.pricingPhases?.[0]?.price || '';
}

function productForSku(sku) {
  const map = mobileProductForSku(sku);
  if (!map || !STORE_PLATFORM) return null;
  return store.get(storeProductId(map), STORE_PLATFORM) || state.products.get(storeProductId(map)) || null;
}

function ensureNativeStoreControls() {
  if (!NATIVE) return;
  const policy = $('#v11-store .v11-store-policy');
  if (!policy) return;
  if (!policy.querySelector('[data-v2122-native-store-state]')) {
    const controls = document.createElement('div');
    controls.className = 'v2122-native-store-controls';
    controls.innerHTML = `
      <span data-v2122-native-store-state>STORE INITIALIZING</span>
      <button type="button" data-v2122-restore>RESTORE PURCHASES</button>`;
    policy.append(controls);
  }
  const status = $('[data-v2122-native-store-state]', policy);
  const verifierReady = PLATFORM === 'ios' ? state.verifier.ios : state.verifier.android;
  if (state.ready && verifierReady) status.textContent = `${storeLabel()} · READY`;
  else if (state.ready) status.textContent = `${storeLabel()} · VERIFIER PENDING`;
  else if (state.initializing) status.textContent = `${storeLabel()} · CONNECTING`;
  else status.textContent = `${storeLabel()} · NOT READY`;
}

function decorateNativeStore() {
  if (!NATIVE) return;
  document.documentElement.dataset.waeNative = PLATFORM;
  document.body?.classList.add('v2121-native-shell', 'v2122-native-billing');
  ensureNativeStoreControls();

  for (const button of document.querySelectorAll('[data-buy-sku]')) {
    const sku = button.dataset.buySku;
    if (!sku) continue;
    const owned = ownsSku(sku);
    const product = productForSku(sku);
    const buy = button.closest('.v11-product__buy');
    const price = buy?.querySelector('strong');

    if (owned) {
      button.dataset.v2122StoreState = 'owned';
      delete button.dataset.v2121NativePurchase;
      continue;
    }

    button.dataset.v2121NativePurchase = product ? 'ready' : 'pending';
    button.dataset.v2122StoreState = product ? 'ready' : 'pending';
    if (product) {
      const localized = productPrice(product);
      if (localized && price) price.textContent = localized;
      button.textContent = `COMPRAR · ${storeLabel()}`;
      button.disabled = false;
    } else {
      if (price) price.textContent = '—';
      button.textContent = `${storeLabel()} · PENDIENTE`;
      button.disabled = false;
    }
  }
}

async function refreshVerifierState() {
  if (!NATIVE || !signedIn()) return;
  try {
    const data = await mobileApi(null, 'GET');
    state.verifier = { ...state.verifier, ...(data.verifier || {}) };
  } catch (error) {
    state.lastError = error.message || 'VERIFIER_STATUS_FAILED';
  }
  ensureNativeStoreControls();
}

async function createIntent(sku) {
  const map = mobileProductForSku(sku);
  if (!map) throw new Error('PRODUCT_NOT_FOUND');
  const data = await mobileApi({ action: 'intent', platform: PLATFORM, sku });
  if (!data?.intent?.id) throw new Error('PURCHASE_INTENT_MISSING');
  savePendingIntent(storeProductId(map), data.intent);
  return data.intent;
}

function transactionPayload(transaction, intent, productId) {
  const payload = {
    action: 'verify',
    intentId: intent.id,
    productId,
    environment: transaction?.parentReceipt?.nativeData?.environment || transaction?.nativePurchase?.environment || '',
  };
  if (PLATFORM === 'android') {
    payload.purchaseToken = transaction?.purchaseId || transaction?.nativePurchase?.purchaseToken || transaction?.transactionId || '';
  } else {
    payload.transactionId = transaction?.transactionId || transaction?.purchaseId || '';
  }
  return payload;
}

async function verifyApprovedTransaction(transaction) {
  if (!NATIVE || transaction?.isPending) return;
  const productId = transaction?.products?.[0]?.id || '';
  const map = mobileProductForStoreId(productId);
  if (!map) return;
  const dedupe = transaction.transactionId || transaction.purchaseId || `${PLATFORM}:${productId}`;
  if (state.pendingTransactions.has(dedupe)) return;
  state.pendingTransactions.set(dedupe, true);

  try {
    if (!signedIn()) {
      showNotice('INICIA SESIÓN', 'La compra fue detectada, pero WAE necesita tu cuenta para vincular el entitlement.', 'No se finalizará la transacción hasta verificarla con tu cuenta.');
      return;
    }
    let intent = pendingIntent(productId);
    if (!intent?.id) intent = await createIntent(map.sku);
    const result = await mobileApi(transactionPayload(transaction, intent, productId));
    if (!result?.ok || result?.entitlement !== 'active') throw new Error('ENTITLEMENT_NOT_GRANTED');

    await transaction.finish();
    savePendingIntent(productId, null);
    await refreshEntitlements();
    showToast(`${map.name} · DESBLOQUEADO`, 'success');
    document.dispatchEvent(new CustomEvent('wae:mobile-purchase-granted', { detail: { sku: map.sku, platform: PLATFORM } }));
  } catch (error) {
    state.lastError = error.message || 'PURCHASE_VERIFICATION_FAILED';
    const verifierMissing = /VERIFIER_NOT_CONFIGURED/.test(state.lastError);
    showNotice(
      verifierMissing ? 'STORE VERIFIER PENDING' : 'COMPRA NO FINALIZADA',
      verifierMissing ? 'La tienda nativa está integrada, pero faltan credenciales privadas del proveedor para validar compras de producción.' : 'WAE no pudo verificar esta transacción. El artículo no fue concedido.',
      'La transacción queda sin finalizar para poder reintentarse de forma segura.'
    );
  } finally {
    state.pendingTransactions.delete(dedupe);
    decorateNativeStore();
  }
}

async function purchaseSku(sku) {
  if (!NATIVE) return false;
  if (ownsSku(sku)) return true;
  if (!signedIn()) { openAuth(); return false; }
  const map = mobileProductForSku(sku);
  if (!map) { showToast('PRODUCTO MÓVIL NO CONFIGURADO', 'error'); return false; }
  const product = productForSku(sku);
  if (!product) {
    showNotice('PRODUCTO PENDIENTE EN TIENDA', `${map.name} todavía no está disponible en ${storeLabel()}.`, 'El SKU WAE está preparado, pero el producto debe existir y estar activo en la consola oficial de la tienda.');
    return false;
  }
  const offer = product.getOffer?.();
  if (!offer) { showToast('OFERTA NO DISPONIBLE', 'error'); return false; }

  try {
    await createIntent(sku);
    const error = await store.order(offer, { applicationUsername: commerceState.session?.user?.id || undefined });
    if (error) {
      state.lastError = error.message || String(error.code || 'ORDER_FAILED');
      showToast(state.lastError, 'error');
      return false;
    }
    showToast(`${storeLabel()} · COMPRA INICIADA`);
    return true;
  } catch (error) {
    state.lastError = error.message || 'ORDER_FAILED';
    showToast(state.lastError, 'error');
    return false;
  }
}

async function restorePurchases() {
  if (!NATIVE || state.restoring) return;
  if (!signedIn()) { openAuth(); return; }
  state.restoring = true;
  const button = $('[data-v2122-restore]');
  if (button) { button.disabled = true; button.textContent = 'RESTORING…'; }
  try {
    const error = await store.restorePurchases();
    if (error) throw new Error(error.message || 'RESTORE_FAILED');
    await new Promise((resolve) => setTimeout(resolve, 500));
    await refreshEntitlements();
    showToast('COMPRAS RESTAURADAS', 'success');
  } catch (error) {
    state.lastError = error.message || 'RESTORE_FAILED';
    showToast(state.lastError, 'error');
  } finally {
    state.restoring = false;
    if (button) { button.disabled = false; button.textContent = 'RESTORE PURCHASES'; }
    decorateNativeStore();
  }
}

async function initializeNativeStore() {
  if (!NATIVE || !STORE_PLATFORM || state.initialized || state.initializing) return;
  state.initializing = true;
  decorateNativeStore();
  try {
    store.applicationUsername = () => commerceState.session?.user?.id || undefined;
    store.obfuscator = 'uuid';
    store.verbosity = 1;

    store.register(MOBILE_STORE_PRODUCTS.map((entry) => ({
      id: storeProductId(entry),
      type: ProductType.NON_CONSUMABLE,
      platform: STORE_PLATFORM,
    })));

    store.when()
      .productUpdated((product) => {
        state.products.set(product.id, product);
        decorateNativeStore();
      })
      .approved((transaction) => { void verifyApprovedTransaction(transaction); })
      .finished(() => { decorateNativeStore(); });

    store.error((error) => {
      state.lastError = error?.message || String(error?.code || 'STORE_ERROR');
      console.warn('[WAE Mobile Store]', state.lastError);
    });

    const errors = await store.initialize([STORE_PLATFORM]);
    const initError = Array.isArray(errors) ? errors.find(Boolean) : errors;
    if (initError) state.lastError = initError.message || 'STORE_INITIALIZE_WARNING';
    state.ready = Boolean(store.isReady);
    state.initialized = true;
    await refreshVerifierState();
  } catch (error) {
    state.lastError = error.message || 'STORE_INITIALIZE_FAILED';
    console.warn('[WAE Mobile Store]', state.lastError);
  } finally {
    state.initializing = false;
    state.ready = Boolean(store.isReady || state.ready);
    decorateNativeStore();
  }
}

function installNativePurchaseGate() {
  if (!NATIVE) return;
  document.addEventListener('click', (event) => {
    const buy = event.target.closest('[data-buy-sku]');
    if (buy && !ownsSku(buy.dataset.buySku)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      void purchaseSku(buy.dataset.buySku);
      return;
    }
    if (event.target.closest('[data-v2122-restore]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      void restorePurchases();
      return;
    }
    if (event.target.closest('[data-v2121-close]')) {
      event.preventDefault();
      closeNotice();
    }
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !ensureNotice().classList.contains('hidden')) {
      event.stopImmediatePropagation();
      closeNotice();
    }
  }, true);

  document.addEventListener('wae:commerce-changed', () => {
    decorateNativeStore();
    void refreshVerifierState();
  });
  window.addEventListener('pageshow', decorateNativeStore);
  window.setInterval(decorateNativeStore, 1200);
  void initializeNativeStore();
}

installNativePurchaseGate();

window.__waeMobileStore = Object.freeze({
  isNative: NATIVE,
  platform: PLATFORM,
  store: storeLabel(),
  initialize: initializeNativeStore,
  purchase: purchaseSku,
  restore: restorePurchases,
  refresh: decorateNativeStore,
  getStatus: () => ({ initialized: state.initialized, ready: state.ready, verifier: { ...state.verifier }, productsLoaded: state.products.size, lastError: state.lastError }),
});
