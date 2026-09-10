import { Capacitor } from '@capacitor/core';
import { commerceSnapshot } from '../v12/backend.js';

const $ = (selector, root = document) => root.querySelector(selector);
const PLATFORM = Capacitor.getPlatform();
const NATIVE = Capacitor.isNativePlatform();

function ownsSku(sku) {
  const owned = new Set(commerceSnapshot()?.ownedSkus || []);
  return owned.has(String(sku || ''));
}

function storeLabel() {
  if (PLATFORM === 'ios') return 'APP STORE';
  if (PLATFORM === 'android') return 'GOOGLE PLAY';
  return 'MOBILE STORE';
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
      <h3>COMPRA MÓVIL PROTEGIDA</h3>
      <p>Esta versión nativa no abre el checkout web para bienes digitales. El catálogo móvil se habilitará mediante el sistema de compra oficial de la plataforma.</p>
      <small>Si ya posees este artículo, inicia sesión y sincroniza tu colección: los entitlements existentes siguen siendo válidos.</small>
      <button type="button" data-v2121-close>ENTENDIDO</button>
    </article>`;
  document.body.append(notice);
  return notice;
}

function showNotice() {
  const notice = ensureNotice();
  notice.classList.remove('hidden');
  document.body.classList.add('v2121-native-commerce-open');
}

function closeNotice() {
  ensureNotice().classList.add('hidden');
  document.body.classList.remove('v2121-native-commerce-open');
}

function decorateCompetitionForNative() {
  if (!NATIVE) return;
  const arena = $('#v2115-competition-arena');
  const gate = $('.v2115-money-gate', arena || document);
  if (gate) gate.hidden = true;
  const copy = $('.v2115-arena-head p', arena || document);
  if (copy) copy.textContent = 'Competencias gratuitas basadas en habilidad. Sin depósitos, apuestas ni cuota de entrada.';
  const footer = $('.v2115-arena-shell footer', arena || document);
  if (footer && !footer.querySelector('[data-v2121-rules]')) {
    const link = document.createElement('a');
    link.dataset.v2121Rules = 'true';
    link.href = '/founders-circuit-rules.html';
    link.textContent = 'REGLAS OFICIALES';
    link.style.marginLeft = '12px';
    footer.append(link);
  }
}

function decorateNativeStore() {
  if (!NATIVE) return;
  document.documentElement.dataset.waeNative = PLATFORM;
  document.body?.classList.add('v2121-native-shell');
  for (const button of document.querySelectorAll('[data-buy-sku]')) {
    const sku = button.dataset.buySku;
    if (!sku || ownsSku(sku)) continue;
    button.dataset.v2121NativePurchase = 'blocked';
    button.setAttribute('aria-label', `Compra móvil mediante ${storeLabel()}`);
  }
  decorateCompetitionForNative();
}

function installNativePurchaseGate() {
  if (!NATIVE) return;
  document.addEventListener('click', (event) => {
    const buy = event.target.closest('[data-buy-sku]');
    if (buy && !ownsSku(buy.dataset.buySku)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showNotice();
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

  decorateNativeStore();
  window.setInterval(decorateNativeStore, 1200);
  document.addEventListener('wae:commerce-changed', decorateNativeStore);
}

installNativePurchaseGate();

window.__waeMobileStore = Object.freeze({
  isNative: NATIVE,
  platform: PLATFORM,
  store: storeLabel(),
  refresh: decorateNativeStore,
});
