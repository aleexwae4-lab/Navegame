import { CURRENCY, PREMIUM_PRODUCTS, STORE_POLICY } from './catalog.js';

const $ = (selector) => document.querySelector(selector);
const money = (value) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: CURRENCY, maximumFractionDigits: 0 }).format(value);

function statLabel(key) {
  return ({ speed: 'VEL', shield: 'ESC', fireRate: 'CAD', power: 'POT', damage: 'DAÑO', cadence: 'CAD', coverage: 'COB', special: 'ESP' })[key] ?? key.toUpperCase();
}

function productCard(item) {
  const stats = Object.entries(item.stats).map(([key, value]) => `<span><b>${statLabel(key)}</b><strong>${value}</strong></span>`).join('');
  return `<article class="v11-product" data-kind="${item.kind}" style="--product-accent:${item.accent}">
    <div class="v11-product__visual"><span class="v11-product__rarity">${item.rarity}</span><div class="v11-product__core"></div><small>${item.series}</small></div>
    <div class="v11-product__body">
      <h3>${item.name}</h3><p class="v11-product__tagline">${item.tagline}</p><p>${item.description}</p>
      <div class="v11-product__stats">${stats}</div>
      <div class="v11-product__buy"><strong>${money(item.priceMxn)}</strong><button type="button" data-buy-sku="${item.sku}">COMPRAR</button></div>
    </div>
  </article>`;
}

function installStore() {
  const app = $('#app');
  if (!app || $('#v11-store')) return;

  const overlay = document.createElement('section');
  overlay.id = 'v11-store';
  overlay.className = 'overlay meta-overlay hidden';
  overlay.setAttribute('aria-label', 'WAE Galactic Store');
  overlay.innerHTML = `<div class="v11-store-panel">
    <div class="v11-store-head">
      <div><span class="eyebrow">WAE GALACTIC COMMERCE</span><h2>ARSENAL PREMIUM</h2><p>Naves y armamento de alto desempeño. Compra directa, sin cajas aleatorias.</p></div>
      <button id="v11-store-close" class="meta-close" type="button" aria-label="Cerrar tienda">×</button>
    </div>
    <div class="v11-store-tabs" role="tablist"><button class="active" data-store-filter="all">TODO</button><button data-store-filter="ship">NAVES</button><button data-store-filter="weapon">ARMAS</button></div>
    <div class="v11-store-grid">${PREMIUM_PRODUCTS.map(productCard).join('')}</div>
    <div class="v11-store-policy"><strong>COMPRA SEGURA</strong><span>${STORE_POLICY.message}</span></div>
  </div>`;
  app.append(overlay);

  const addStoreButton = (container, label = 'TIENDA PREMIUM') => {
    if (!container || container.querySelector('[data-open-v11-store]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.openV11Store = 'true';
    button.className = 'v11-store-open';
    button.textContent = label;
    container.append(button);
  };

  addStoreButton($('#start-screen .start-meta'));
  addStoreButton($('#hangar-screen .meta-panel-header > div'), 'VER ARSENAL PREMIUM');
  addStoreButton($('#game-over-screen .panel'), 'TIENDA PREMIUM');

  document.addEventListener('click', (event) => {
    const open = event.target.closest('[data-open-v11-store]');
    if (open) {
      document.querySelectorAll('.overlay').forEach((el) => { if (el.id !== 'v11-store') el.classList.add('hidden'); });
      overlay.classList.remove('hidden');
      return;
    }
    if (event.target.closest('#v11-store-close')) {
      overlay.classList.add('hidden');
      const gameOver = $('#game-over-screen');
      const start = $('#start-screen');
      if (gameOver && !gameOver.classList.contains('hidden')) return;
      start?.classList.remove('hidden');
      return;
    }
    const filter = event.target.closest('[data-store-filter]');
    if (filter) {
      overlay.querySelectorAll('[data-store-filter]').forEach((btn) => btn.classList.toggle('active', btn === filter));
      const kind = filter.dataset.storeFilter;
      overlay.querySelectorAll('.v11-product').forEach((card) => card.classList.toggle('hidden', kind !== 'all' && card.dataset.kind !== kind));
      return;
    }
    const buy = event.target.closest('[data-buy-sku]');
    if (buy) {
      const item = PREMIUM_PRODUCTS.find((entry) => entry.sku === buy.dataset.buySku);
      if (!item) return;
      const modal = $('#v11-checkout-modal');
      modal.querySelector('[data-checkout-name]').textContent = item.name;
      modal.querySelector('[data-checkout-price]').textContent = money(item.priceMxn);
      modal.querySelector('[data-checkout-sku]').textContent = item.sku;
      modal.classList.remove('hidden');
    }
  });

  const modal = document.createElement('div');
  modal.id = 'v11-checkout-modal';
  modal.className = 'v11-checkout hidden';
  modal.innerHTML = `<div class="v11-checkout-card"><span>COMPRA PROTEGIDA</span><h3 data-checkout-name>PRODUCTO</h3><strong data-checkout-price>$0</strong><small data-checkout-sku></small><p>El catálogo ya está listo, pero el cobro está bloqueado hasta conectar un proveedor de pagos y validación de propiedad en servidor.</p><button type="button" data-close-checkout>ENTENDIDO</button></div>`;
  app.append(modal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal || event.target.closest('[data-close-checkout]')) modal.classList.add('hidden');
  });
}

installStore();
