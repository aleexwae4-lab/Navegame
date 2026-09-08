import { PREMIUM_PRODUCTS } from '../v11/catalog.js';
import { commerceSnapshot, subscribeCommerce } from '../v12/backend.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const money = (value) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value);
const productsBySku = new Map(PREMIUM_PRODUCTS.map((item) => [item.sku, item]));
let activeProduct = null;
let demoTimer = 0;
let demoInterval = 0;

function benefit(item) {
  const labels = item.kind === 'ship'
    ? { speed: 'VELOCIDAD', shield: 'BLINDAJE', fireRate: 'CADENCIA', power: 'POTENCIA' }
    : { damage: 'DAÑO', cadence: 'CADENCIA', coverage: 'COBERTURA', special: 'ESPECIAL' };
  const [key] = Object.entries(item.stats).sort((a, b) => b[1] - a[1])[0] ?? ['power'];
  const value = item.stats[key] ?? 100;
  return `${labels[key] ?? key.toUpperCase()} ${value}`;
}

function statLabel(key) {
  return ({ speed: 'VELOCIDAD', shield: 'ESCUDO', fireRate: 'CADENCIA', power: 'POTENCIA', damage: 'DAÑO', cadence: 'CADENCIA', coverage: 'COBERTURA', special: 'ESPECIAL' })[key] ?? key.toUpperCase();
}

function svgShell(item, inner) {
  const key = item.id.replace(/[^a-z0-9-]/gi, '');
  return `<svg class="v14-product-svg" viewBox="0 0 520 260" role="img" aria-label="${item.name}">
    <defs>
      <linearGradient id="metal-${key}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#020617"/><stop offset=".42" stop-color="#475569"/><stop offset=".68" stop-color="#111827"/><stop offset="1" stop-color="#020617"/></linearGradient>
      <linearGradient id="glass-${key}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e0f2fe" stop-opacity=".88"/><stop offset=".42" stop-color="${item.accent}" stop-opacity=".72"/><stop offset="1" stop-color="#020617" stop-opacity=".4"/></linearGradient>
      <radialGradient id="core-${key}"><stop offset="0" stop-color="#fff"/><stop offset=".24" stop-color="${item.accent}"/><stop offset="1" stop-color="${item.accent}" stop-opacity="0"/></radialGradient>
      <filter id="glow-${key}" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="shadow-${key}" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#000" flood-opacity=".75"/></filter>
    </defs>
    <ellipse cx="260" cy="213" rx="150" ry="18" fill="#000" opacity=".52"/>
    <ellipse cx="260" cy="206" rx="118" ry="10" fill="${item.accent}" opacity=".12" filter="url(#glow-${key})"/>
    <g filter="url(#shadow-${key})">${inner}</g>
  </svg>`;
}

function shipSvg(item) {
  const key = item.id.replace(/[^a-z0-9-]/gi, '');
  const metal = `url(#metal-${key})`;
  const glass = `url(#glass-${key})`;
  const core = `url(#core-${key})`;
  const glow = `url(#glow-${key})`;
  const common = `<path d="M260 48 L295 147 L260 194 L225 147 Z" fill="${metal}" stroke="${item.accent}" stroke-opacity=".36" stroke-width="2"/><path d="M260 66 C280 86 281 120 260 143 C239 120 240 86 260 66Z" fill="${glass}"/><ellipse cx="260" cy="151" rx="18" ry="11" fill="${core}" filter="${glow}"/>`;
  const shapes = {
    'viper-black': `<path d="M260 42 L310 112 L455 154 L344 166 L302 204 L260 181 L218 204 L176 166 L65 154 L210 112Z" fill="${metal}" stroke="${item.accent}" stroke-width="3"/><path d="M105 153 L205 131 L169 170Z" fill="#020617"/><path d="M415 153 L315 131 L351 170Z" fill="#020617"/>${common}<path d="M118 154 L196 146" stroke="${item.accent}" stroke-width="5" filter="${glow}"/><path d="M402 154 L324 146" stroke="${item.accent}" stroke-width="5" filter="${glow}"/>`,
    'aegis-sovereign': `<path d="M260 38 L326 94 L458 129 L425 181 L326 174 L292 213 L228 213 L194 174 L95 181 L62 129 L194 94Z" fill="${metal}" stroke="${item.accent}" stroke-width="3"/><path d="M91 134 L202 112 L185 163 L111 164Z" fill="#111827"/><path d="M429 134 L318 112 L335 163 L409 164Z" fill="#111827"/>${common}<rect x="172" y="148" width="38" height="12" rx="6" fill="${item.accent}" opacity=".78"/><rect x="310" y="148" width="38" height="12" rx="6" fill="${item.accent}" opacity=".78"/>`,
    'nova-imperium': `<path d="M260 30 L326 96 L446 142 L354 158 L319 206 L260 178 L201 206 L166 158 L74 142 L194 96Z" fill="${metal}" stroke="${item.accent}" stroke-width="3"/><path d="M140 140 L204 112 L185 171Z" fill="${glass}" opacity=".62"/><path d="M380 140 L316 112 L335 171Z" fill="${glass}" opacity=".62"/>${common}<circle cx="260" cy="163" r="28" fill="none" stroke="${item.accent}" stroke-width="4" opacity=".7" filter="${glow}"/>`,
    'eclipse-x': `<path d="M260 25 L300 94 L471 120 L353 154 L321 219 L260 176 L199 219 L167 154 L49 120 L220 94Z" fill="${metal}" stroke="${item.accent}" stroke-width="3"/><path d="M53 121 L205 108 L164 151Z" fill="#020617"/><path d="M467 121 L315 108 L356 151Z" fill="#020617"/>${common}<path d="M80 121 L187 123" stroke="${item.accent}" stroke-width="4" filter="${glow}"/><path d="M440 121 L333 123" stroke="${item.accent}" stroke-width="4" filter="${glow}"/>`,
    'obsidian-one': `<path d="M260 28 L315 86 L442 113 L396 170 L326 175 L296 219 L224 219 L194 175 L124 170 L78 113 L205 86Z" fill="#020617" stroke="${item.accent}" stroke-width="3"/><path d="M116 120 L208 101 L189 159 L133 154Z" fill="${metal}"/><path d="M404 120 L312 101 L331 159 L387 154Z" fill="${metal}"/>${common}<path d="M260 38 L260 196" stroke="${item.accent}" stroke-width="2" opacity=".7"/><circle cx="260" cy="154" r="34" fill="none" stroke="${item.accent}" stroke-width="2" opacity=".4"/>`,
    'celestial-crown': `<path d="M260 21 L307 83 L411 62 L392 111 L481 139 L358 165 L330 218 L260 181 L190 218 L162 165 L39 139 L128 111 L109 62 L213 83Z" fill="${metal}" stroke="${item.accent}" stroke-width="4"/><path d="M84 136 L196 105 L170 164Z" fill="${glass}" opacity=".52"/><path d="M436 136 L324 105 L350 164Z" fill="${glass}" opacity=".52"/>${common}<path d="M183 69 L217 91 L260 45 L303 91 L337 69" fill="none" stroke="${item.accent}" stroke-width="6" stroke-linecap="round" filter="${glow}"/><circle cx="260" cy="152" r="36" fill="none" stroke="${item.accent}" stroke-width="4" filter="${glow}"/>`,
  };
  return svgShell(item, shapes[item.id] ?? common);
}

function weaponSvg(item) {
  const key = item.id.replace(/[^a-z0-9-]/gi, '');
  const metal = `url(#metal-${key})`;
  const core = `url(#core-${key})`;
  const glow = `url(#glow-${key})`;
  const shapes = {
    'trident-vxr': `<g transform="translate(42 54)"><path d="M78 112 L190 72 L376 72 L420 102 L376 132 L190 132Z" fill="${metal}" stroke="${item.accent}" stroke-width="3"/><rect x="190" y="59" width="218" height="18" rx="9" fill="${metal}"/><rect x="190" y="93" width="238" height="18" rx="9" fill="${metal}"/><rect x="190" y="127" width="218" height="18" rx="9" fill="${metal}"/><circle cx="154" cy="102" r="34" fill="${core}" filter="${glow}"/><path d="M399 68H455M419 102H475M399 136H455" stroke="${item.accent}" stroke-width="7" stroke-linecap="round" filter="${glow}"/></g>`,
    'storm-omega': `<g transform="translate(35 48)"><path d="M60 116 L166 56 L390 67 L443 116 L390 165 L166 176Z" fill="${metal}" stroke="${item.accent}" stroke-width="3"/><rect x="174" y="60" width="225" height="12" rx="6" fill="${item.accent}" opacity=".72"/><rect x="190" y="87" width="226" height="12" rx="6" fill="${item.accent}" opacity=".72"/><rect x="190" y="133" width="226" height="12" rx="6" fill="${item.accent}" opacity=".72"/><rect x="174" y="160" width="225" height="12" rx="6" fill="${item.accent}" opacity=".72"/><circle cx="142" cy="116" r="40" fill="${core}" filter="${glow}"/></g>`,
    'eclipse-cannon': `<g transform="translate(28 40)"><path d="M62 129 L170 58 L371 58 L462 129 L371 200 L170 200Z" fill="${metal}" stroke="${item.accent}" stroke-width="3"/><rect x="183" y="103" width="276" height="52" rx="18" fill="#020617" stroke="${item.accent}" stroke-width="4"/><circle cx="197" cy="129" r="48" fill="${core}" filter="${glow}"/><circle cx="414" cy="129" r="26" fill="${item.accent}" opacity=".85" filter="${glow}"/></g>`,
    'helix-railgun': `<g transform="translate(20 50)"><path d="M38 116 L112 72 L432 72 L488 116 L432 160 L112 160Z" fill="${metal}" stroke="${item.accent}" stroke-width="3"/><rect x="126" y="94" width="326" height="13" rx="6" fill="${item.accent}" filter="${glow}"/><rect x="126" y="125" width="326" height="13" rx="6" fill="${item.accent}" filter="${glow}"/><path d="M165 70 C210 16 287 214 346 72" fill="none" stroke="${item.accent}" stroke-width="6" opacity=".72"/><circle cx="104" cy="116" r="32" fill="${core}"/></g>`,
    'nova-destroyer': `<g transform="translate(58 34)"><path d="M54 136 L142 59 L350 59 L438 136 L350 213 L142 213Z" fill="${metal}" stroke="${item.accent}" stroke-width="3"/><circle cx="246" cy="136" r="64" fill="#020617" stroke="${item.accent}" stroke-width="5"/><circle cx="246" cy="136" r="48" fill="${core}" filter="${glow}"/><path d="M246 67V103M246 169V205M177 136H213M279 136H315" stroke="${item.accent}" stroke-width="9" stroke-linecap="round"/></g>`,
    'wae-singularity': `<g transform="translate(55 27)"><path d="M42 143 L131 57 L361 57 L450 143 L361 229 L131 229Z" fill="${metal}" stroke="${item.accent}" stroke-width="4"/><circle cx="246" cy="143" r="78" fill="#020617" stroke="${item.accent}" stroke-width="3"/><circle cx="246" cy="143" r="57" fill="none" stroke="${item.accent}" stroke-width="8" opacity=".8" filter="${glow}"/><circle cx="246" cy="143" r="31" fill="${core}" filter="${glow}"/><ellipse cx="246" cy="143" rx="96" ry="33" fill="none" stroke="${item.accent}" stroke-width="4" opacity=".58" transform="rotate(-24 246 143)"/><ellipse cx="246" cy="143" rx="96" ry="33" fill="none" stroke="${item.accent}" stroke-width="4" opacity=".44" transform="rotate(24 246 143)"/></g>`,
  };
  return svgShell(item, shapes[item.id] ?? `<rect x="90" y="90" width="340" height="80" rx="30" fill="${metal}" stroke="${item.accent}" stroke-width="3"/><circle cx="260" cy="130" r="36" fill="${core}" filter="${glow}"/>`);
}

function productSvg(item) {
  return item.kind === 'ship' ? shipSvg(item) : weaponSvg(item);
}

function enhanceStats(card, item) {
  const entries = Object.entries(item.stats);
  $$('.v11-product__stats span', card).forEach((node, index) => {
    const [, value] = entries[index] ?? ['', 0];
    const fill = Math.max(10, Math.min(100, Math.round((value / 250) * 100)));
    const meter = document.createElement('i');
    meter.className = 'v14-stat-meter';
    meter.style.setProperty('--v14-fill', `${fill}%`);
    node.append(meter);
  });
}

function enhanceCard(card, item) {
  if (!card || card.dataset.v14Ready === 'true') return;
  card.dataset.v14Ready = 'true';
  card.dataset.sku = item.sku;
  card.classList.add('v14-product');
  const visual = $('.v11-product__visual', card);
  if (visual) {
    visual.innerHTML = `<span class="v11-product__rarity">${item.rarity}</span><div class="v14-product__render">${productSvg(item)}</div><small>${item.series}</small><b class="v14-product__benefit">${benefit(item)}</b>`;
  }
  enhanceStats(card, item);
  const buyRow = $('.v11-product__buy', card);
  const buyButton = $('[data-buy-sku]', buyRow);
  if (buyRow && buyButton && !buyRow.querySelector('[data-v14-preview]')) {
    const actions = document.createElement('div');
    actions.className = 'v14-product__actions';
    const preview = document.createElement('button');
    preview.type = 'button';
    preview.dataset.v14Preview = item.sku;
    preview.textContent = 'VER';
    actions.append(preview, buyButton);
    buyRow.append(actions);
  }
}

function statRows(item) {
  return Object.entries(item.stats).map(([key, value]) => {
    const fill = Math.max(10, Math.min(100, Math.round((value / 250) * 100)));
    return `<div class="v14-preview__stat"><div><span>${statLabel(key)}</span><strong>${value}</strong></div><i><b style="--v14-fill:${fill}%"></b></i></div>`;
  }).join('');
}

function updatePrimaryButton(snapshot = commerceSnapshot()) {
  const button = $('#v14-preview [data-v14-primary]');
  if (!button || !activeProduct) return;
  button.dataset.buySku = activeProduct.sku;
  const owned = snapshot.ownedSkus?.includes(activeProduct.sku);
  button.textContent = owned ? 'EQUIPAR AHORA' : snapshot.signedIn ? `COMPRAR · ${money(activeProduct.priceMxn)}` : 'INICIAR / COMPRAR';
}

function stopDemo() {
  window.clearTimeout(demoTimer);
  window.clearInterval(demoInterval);
  const modal = $('#v14-preview');
  modal?.classList.remove('is-demo');
  const button = $('[data-v14-demo]', modal);
  if (button) button.textContent = 'DEMO VISUAL · 15s';
}

function openPreview(item) {
  const modal = $('#v14-preview');
  if (!modal) return;
  activeProduct = item;
  stopDemo();
  $('[data-v14-preview-rarity]', modal).textContent = `${item.rarity} · ${item.series}`;
  $('[data-v14-preview-name]', modal).textContent = item.name;
  $('[data-v14-preview-tagline]', modal).textContent = item.tagline;
  $('[data-v14-preview-description]', modal).textContent = item.description;
  $('[data-v14-preview-price]', modal).textContent = money(item.priceMxn);
  $('[data-v14-preview-benefit]', modal).textContent = benefit(item);
  $('[data-v14-preview-art]', modal).innerHTML = productSvg(item);
  $('[data-v14-preview-stats]', modal).innerHTML = statRows(item);
  modal.style.setProperty('--v14-accent', item.accent);
  updatePrimaryButton();
  modal.classList.remove('hidden');
  document.body.classList.add('v14-preview-open');
}

function closePreview() {
  stopDemo();
  $('#v14-preview')?.classList.add('hidden');
  document.body.classList.remove('v14-preview-open');
  activeProduct = null;
}

function installPreview() {
  if ($('#v14-preview')) return;
  const modal = document.createElement('section');
  modal.id = 'v14-preview';
  modal.className = 'v14-preview hidden';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Preview de producto premium');
  modal.innerHTML = `<div class="v14-preview__shell">
    <button class="v14-preview__close" type="button" data-v14-close aria-label="Cerrar preview">×</button>
    <div class="v14-preview__stage">
      <div class="v14-preview__grid"></div>
      <div class="v14-preview__scan"></div>
      <div class="v14-preview__art" data-v14-preview-art></div>
      <div class="v14-preview__demo-targets"><i></i><i></i><i></i></div>
      <span class="v14-preview__stage-label">WAE COMBAT SHOWROOM · LIVE RENDER</span>
    </div>
    <div class="v14-preview__content">
      <span class="v14-preview__rarity" data-v14-preview-rarity></span>
      <h2 data-v14-preview-name></h2>
      <p class="v14-preview__tagline" data-v14-preview-tagline></p>
      <p class="v14-preview__description" data-v14-preview-description></p>
      <div class="v14-preview__signature"><span>VENTAJA PRINCIPAL</span><strong data-v14-preview-benefit></strong></div>
      <div class="v14-preview__stats" data-v14-preview-stats></div>
      <div class="v14-preview__commerce"><div><span>COLLECTOR PRICE</span><strong data-v14-preview-price></strong><small>Propiedad verificable por cuenta WAE.</small></div><div class="v14-preview__actions"><button type="button" data-v14-demo>DEMO VISUAL · 15s</button><button type="button" class="v14-preview__primary" data-v14-primary>COMPRAR</button></div></div>
    </div>
  </div>`;
  document.body.append(modal);

  modal.addEventListener('click', (event) => {
    if (event.target === modal || event.target.closest('[data-v14-close]')) closePreview();
    const demo = event.target.closest('[data-v14-demo]');
    if (demo && activeProduct) {
      stopDemo();
      let seconds = 15;
      modal.classList.add('is-demo');
      demo.textContent = `DEMO · ${seconds}s`;
      demoInterval = window.setInterval(() => {
        seconds -= 1;
        demo.textContent = seconds > 0 ? `DEMO · ${seconds}s` : 'DEMO COMPLETADA';
      }, 1000);
      demoTimer = window.setTimeout(stopDemo, 15000);
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.classList.contains('hidden')) closePreview();
  });
}

function installShowroomHero(store) {
  const panel = $('.v11-store-panel', store);
  if (!panel || $('#v14-showroom-hero')) return;
  const hero = document.createElement('section');
  hero.id = 'v14-showroom-hero';
  hero.className = 'v14-showroom-hero';
  hero.innerHTML = `<div><span>WAE BLACK SERIES · COLLECTOR GRADE</span><strong>COMBAT HARDWARE, NO PLACEHOLDERS.</strong><small>Cada nave y arma tiene silueta, firma energética y perfil táctico propio.</small></div><div class="v14-showroom-hero__chips"><b>12 PIEZAS</b><b>6 NAVES</b><b>6 ARMAS</b><b>FOUNDER TIER</b></div>`;
  const anchor = $('#v13-vault', panel) ?? $('#v12-account', panel) ?? $('.v11-store-tabs', panel);
  panel.insertBefore(hero, anchor);
}

function applyBranding() {
  document.title = 'WAE Neon Rider 3D · V14 Collector Showroom';
  const seal = $('.wae-game-seal small');
  const brand = $('.brand-seal span');
  const start = $('#start-screen .eyebrow');
  if (seal) seal.textContent = 'ORIGINAL GAME SEAL · V14';
  if (brand) brand.textContent = 'NEON RIDER · COLLECTOR SHOWROOM V14';
  if (start) start.textContent = 'WAE V14 / COMBATE · COLECCIÓN · DOMINIO';
}

function installShowroom() {
  const store = $('#v11-store');
  if (!store) return;
  applyBranding();
  installPreview();
  installShowroomHero(store);
  PREMIUM_PRODUCTS.forEach((item) => {
    const button = store.querySelector(`[data-buy-sku="${item.sku}"]`);
    enhanceCard(button?.closest('.v11-product'), item);
  });
  store.addEventListener('click', (event) => {
    const preview = event.target.closest('[data-v14-preview]');
    if (!preview) return;
    event.preventDefault();
    event.stopPropagation();
    const item = productsBySku.get(preview.dataset.v14Preview);
    if (item) openPreview(item);
  }, true);
  subscribeCommerce(updatePrimaryButton);
}

installShowroom();
