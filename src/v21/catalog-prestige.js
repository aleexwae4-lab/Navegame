const $ = (selector, root = document) => root.querySelector(selector);

const OMEGA_SKU = 'WAE-SHIP-AURELION-OMG';
const OMEGA_PRICE = 4999;
const NEW_SKUS = new Set([
  'WAE-SHIP-SPECTER-VLK', 'WAE-SHIP-TITAN-DOM', 'WAE-SHIP-SERAPH-QNT', OMEGA_SKU,
  'WAE-WPN-ORION-LNC', 'WAE-WPN-CHRONOS-ARR', 'WAE-WPN-ABYSS-RPR', 'WAE-WPN-OMEGA-CROWN',
]);

function money(value) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value);
}

function decorateStore() {
  for (const button of document.querySelectorAll('[data-buy-sku]')) {
    const card = button.closest('.v11-product');
    if (!card) continue;
    const sku = button.dataset.buySku || '';
    card.dataset.v2116Sku = sku;
    card.classList.toggle('v2116-new-catalog', NEW_SKUS.has(sku));
    if (sku !== OMEGA_SKU) continue;
    card.classList.add('v2116-omega-product');
    if (!card.querySelector('.v2116-omega-ribbon')) {
      const ribbon = document.createElement('div');
      ribbon.className = 'v2116-omega-ribbon';
      ribbon.innerHTML = '<span>Ω</span><b>OMEGA FLAGSHIP</b><small>PREMIO MAYOR DE TEMPORADA</small>';
      card.prepend(ribbon);
    }
    const buy = card.querySelector('.v11-product__buy');
    if (buy && !buy.querySelector('.v2116-prize-note')) {
      const note = document.createElement('small');
      note.className = 'v2116-prize-note';
      note.textContent = 'Disponible para compra · También puede obtenerse como premio oficial de competencia.';
      buy.append(note);
    }
  }
}

function ensureArenaPrize() {
  const shell = $('#v2115-competition-arena .v2115-arena-shell');
  if (!shell) return null;
  let prize = $('.v2116-grand-prize', shell);
  if (prize) return prize;
  prize = document.createElement('section');
  prize.className = 'v2116-grand-prize';
  prize.innerHTML = `
    <div class="v2116-prize-orbit" aria-hidden="true"><i>✦</i><b>Ω</b><i>✦</i></div>
    <div class="v2116-prize-copy">
      <span>FOUNDERS CIRCUIT · PREMIO MAYOR</span>
      <h3>WAE AURELION SOVEREIGN Ω</h3>
      <p>La nave más exclusiva del catálogo. El campeón oficial puede obtenerla como entitlement digital verificado por servidor.</p>
      <div class="v2116-prize-meta"><strong>${money(OMEGA_PRICE)}</strong><small>VALOR DE CATÁLOGO</small><b>OMEGA</b></div>
    </div>
    <div class="v2116-prize-actions">
      <button type="button" data-v2116-view-omega>VER REVEAL 3D</button>
      <button type="button" data-v2116-compete>COMPETIR</button>
      <small>La concesión como premio exige resultado oficial y validación del backend; no se entrega por almacenamiento local.</small>
    </div>`;
  const modes = $('[data-v2115-modes]', shell);
  modes?.insertAdjacentElement('beforebegin', prize);
  return prize;
}

function openOmegaStore() {
  const launcher = $('[data-open-v11-store]');
  launcher?.click();
  window.setTimeout(() => {
    $('[data-store-filter="ship"]')?.click();
    const omega = $(`[data-buy-sku="${OMEGA_SKU}"]`)?.closest('.v11-product');
    omega?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    omega?.classList.add('v2116-focus');
    window.setTimeout(() => omega?.classList.remove('v2116-focus'), 1800);
  }, 80);
}

function openOmegaExperience() {
  if (window.__waeLuxuryShowroom?.openOmega) {
    window.__waeLuxuryShowroom.openOmega();
    return;
  }
  openOmegaStore();
}

function sync() {
  decorateStore();
  ensureArenaPrize();
}

document.addEventListener('click', (event) => {
  if (event.target.closest('[data-v2116-view-omega]')) {
    event.preventDefault();
    openOmegaExperience();
    return;
  }
  if (event.target.closest('[data-v2116-compete]')) {
    event.preventDefault();
    const arena = $('#v2115-competition-arena');
    arena?.querySelector('[data-v2115-arena-play]')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }
}, true);

sync();
window.setInterval(sync, 1200);
window.addEventListener('pageshow', sync);
document.addEventListener('wae:achievement-unlocked', sync);

window.__waeOmegaFlagship = Object.freeze({ sku: OMEGA_SKU, priceMxn: OMEGA_PRICE, sync, open: openOmegaExperience });
