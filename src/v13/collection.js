import { PREMIUM_PRODUCTS } from '../v11/catalog.js';
import { commerceSnapshot, refreshEntitlements, subscribeCommerce } from '../v12/backend.js';

const $ = (selector, root = document) => root.querySelector(selector);
const money = (value) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value);

function applyV13Branding() {
  document.title = 'WAE Neon Rider 3D · V13 Private Vault';
  const sealVersion = $('.wae-game-seal small');
  const brandVersion = $('.brand-seal span');
  const startEyebrow = $('#start-screen .eyebrow');
  const storeEyebrow = $('#v11-store .v11-store-head .eyebrow');
  if (sealVersion) sealVersion.textContent = 'ORIGINAL GAME SEAL · V13';
  if (brandVersion) brandVersion.textContent = 'NEON RIDER · PRIVATE VAULT V13';
  if (startEyebrow) startEyebrow.textContent = 'WAE V13 / JUEGA · COLECCIONA · DOMINA';
  if (storeEyebrow) storeEyebrow.textContent = 'WAE PRIVATE VAULT COMMERCE';
}

function ownedProducts(snapshot) {
  const owned = new Set(snapshot.ownedSkus ?? []);
  return PREMIUM_PRODUCTS.filter((item) => owned.has(item.sku));
}

function collectionTier(count) {
  if (count >= 12) return 'CELESTIAL VAULT';
  if (count >= 9) return 'OBSIDIAN VAULT';
  if (count >= 6) return 'LEGENDARY VAULT';
  if (count >= 3) return 'ELITE VAULT';
  if (count >= 1) return 'PREMIUM VAULT';
  return 'VAULT INICIAL';
}

function installCollection() {
  applyV13Branding();
  const store = $('#v11-store');
  const panel = $('.v11-store-panel', store);
  const tabs = $('.v11-store-tabs', store);
  if (!store || !panel || !tabs || $('#v13-vault')) return;

  const vault = document.createElement('section');
  vault.id = 'v13-vault';
  vault.className = 'v13-vault';
  vault.innerHTML = `
    <div class="v13-vault__identity">
      <span>WAE PRIVATE VAULT</span>
      <strong data-v13-tier>VAULT INICIAL</strong>
      <small data-v13-account>Inicia sesión para sincronizar tu colección.</small>
    </div>
    <div class="v13-vault__metrics">
      <div><span>COLECCIÓN</span><strong data-v13-count>0 / ${PREMIUM_PRODUCTS.length}</strong></div>
      <div><span>VALOR</span><strong data-v13-value>${money(0)}</strong></div>
      <div><span>NAVE ACTIVA</span><strong data-v13-ship>—</strong></div>
      <div><span>ARMA ACTIVA</span><strong data-v13-weapon>—</strong></div>
    </div>
    <div class="v13-vault__progress"><i data-v13-progress></i></div>
    <div class="v13-vault__actions">
      <button type="button" data-v13-owned-only>VER MI COLECCIÓN</button>
      <button type="button" data-v13-sync>SYNC</button>
    </div>`;
  panel.insertBefore(vault, tabs);

  let ownedOnly = false;
  let cleanedAuthReturn = false;

  const render = (snapshot) => {
    const owned = ownedProducts(snapshot);
    const value = owned.reduce((sum, item) => sum + item.priceMxn, 0);
    const selectedShip = localStorage.getItem('wae_neon_rider_v12_ship_sku');
    const selectedWeapon = localStorage.getItem('wae_neon_rider_v12_weapon_sku');
    const ship = PREMIUM_PRODUCTS.find((item) => item.sku === selectedShip);
    const weapon = PREMIUM_PRODUCTS.find((item) => item.sku === selectedWeapon);

    $('[data-v13-tier]', vault).textContent = collectionTier(owned.length);
    $('[data-v13-account]', vault).textContent = snapshot.signedIn
      ? snapshot.user?.email ?? 'Colección sincronizada por servidor.'
      : 'Inicia sesión para sincronizar tu colección.';
    $('[data-v13-count]', vault).textContent = `${owned.length} / ${PREMIUM_PRODUCTS.length}`;
    $('[data-v13-value]', vault).textContent = money(value);
    $('[data-v13-ship]', vault).textContent = ship?.name ?? 'ESTÁNDAR';
    $('[data-v13-weapon]', vault).textContent = weapon?.name ?? 'ESTÁNDAR';
    $('[data-v13-progress]', vault).style.width = `${(owned.length / PREMIUM_PRODUCTS.length) * 100}%`;

    const ownedSet = new Set(snapshot.ownedSkus ?? []);
    store.querySelectorAll('.v11-product').forEach((card) => {
      const sku = card.querySelector('[data-buy-sku]')?.dataset.buySku;
      const isOwned = ownedSet.has(sku);
      card.classList.toggle('v13-owned', isOwned);
      card.classList.toggle('v13-owned-filtered', ownedOnly && !isOwned);
    });

    const filterButton = $('[data-v13-owned-only]', vault);
    filterButton.textContent = ownedOnly ? 'VER TODO EL ARSENAL' : `MI COLECCIÓN · ${owned.length}`;
    filterButton.disabled = !snapshot.signedIn;

    if (!cleanedAuthReturn && snapshot.signedIn) {
      const query = new URLSearchParams(window.location.search);
      if (query.get('auth') === 'confirmed') {
        query.delete('auth');
        const next = `${window.location.pathname}${query.toString() ? `?${query}` : ''}${window.location.hash}`;
        history.replaceState({}, '', next);
      }
      cleanedAuthReturn = true;
    }
  };

  subscribeCommerce(render);

  $('[data-v13-owned-only]', vault).addEventListener('click', () => {
    ownedOnly = !ownedOnly;
    render(commerceSnapshot());
  });

  $('[data-v13-sync]', vault).addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'SYNC…';
    try { await refreshEntitlements(); }
    catch {}
    button.disabled = false;
    button.textContent = original;
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-buy-sku]')) return;
    window.setTimeout(() => render(commerceSnapshot()), 0);
  });
}

installCollection();
