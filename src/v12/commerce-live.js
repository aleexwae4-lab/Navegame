import { PREMIUM_PRODUCTS } from '../v11/catalog.js';
import {
  commerceConfigSnapshot,
  commerceSnapshot,
  createCheckout,
  refreshEntitlements,
  restoreSession,
  signIn,
  signOut,
  signUp,
  subscribeCommerce,
} from './backend.js';

const $ = (selector) => document.querySelector(selector);
const game = window.__waeNeonRiderGame;

function installCommerceUi() {
  const store = $('#v11-store');
  const panel = store?.querySelector('.v11-store-panel');
  if (!store || !panel || $('#v12-account')) return;

  const account = document.createElement('section');
  account.id = 'v12-account';
  account.className = 'v12-account';
  account.innerHTML = `<div><span>CUENTA WAE</span><strong data-v12-account-status>COMPROBANDO…</strong><small data-v12-account-email>Propiedad segura entre dispositivos.</small></div><div class="v12-account-actions"><button type="button" data-v12-restore>RESTAURAR COMPRAS</button><button type="button" data-v12-auth>AUTENTICAR</button></div>`;
  panel.insertBefore(account, panel.querySelector('.v11-store-tabs'));

  const authModal = document.createElement('div');
  authModal.className = 'v12-auth-modal hidden';
  authModal.innerHTML = `<form class="v12-auth-card" data-v12-auth-form><span>WAE PLAYER ID</span><h3>PROTEGE TUS COMPRAS</h3><p>Inicia sesión para comprar, restaurar y equipar contenido premium en cualquier dispositivo.</p><label>Correo<input type="email" name="email" autocomplete="email" required placeholder="tu@correo.com"></label><label>Contraseña<input type="password" name="password" autocomplete="current-password" minlength="6" required placeholder="••••••••"></label><div class="v12-auth-actions"><button type="submit">ENTRAR</button><button type="button" data-v12-signup>CREAR CUENTA</button></div><button class="v12-auth-cancel" type="button" data-v12-auth-close>CANCELAR</button><small data-v12-auth-message></small></form>`;
  document.body.append(authModal);

  const statusModal = document.createElement('div');
  statusModal.className = 'v12-auth-modal hidden';
  statusModal.innerHTML = `<div class="v12-auth-card"><span>WAE SECURE COMMERCE</span><h3 data-v12-status-title>ESTADO</h3><p data-v12-status-message></p><button type="button" data-v12-status-close>ENTENDIDO</button></div>`;
  document.body.append(statusModal);

  const showStatus = (title, message) => {
    statusModal.querySelector('[data-v12-status-title]').textContent = title;
    statusModal.querySelector('[data-v12-status-message]').textContent = message;
    statusModal.classList.remove('hidden');
  };

  const authMessage = (message) => { authModal.querySelector('[data-v12-auth-message]').textContent = message; };
  const closeAuth = () => authModal.classList.add('hidden');
  const openAuth = () => {
    if (!commerceConfigSnapshot().configured) {
      showStatus('BACKEND AISLADO PENDIENTE', 'La tienda está preparada, pero las cuentas y cobros permanecerán bloqueados hasta enlazar el proyecto Supabase exclusivo de Navegame.');
      return;
    }
    authModal.classList.remove('hidden');
    authModal.querySelector('input[name="email"]')?.focus();
  };

  const updateCommerceUi = (snapshot) => {
    const status = account.querySelector('[data-v12-account-status]');
    const detail = account.querySelector('[data-v12-account-email]');
    const authButton = account.querySelector('[data-v12-auth]');
    const restoreButton = account.querySelector('[data-v12-restore]');
    status.textContent = !snapshot.configured ? 'BACKEND PENDIENTE' : snapshot.signedIn ? 'PROTEGIDA' : 'SIN SESIÓN';
    detail.textContent = snapshot.signedIn ? snapshot.user?.email ?? 'Cuenta autenticada' : snapshot.configured ? 'Inicia sesión para proteger tus compras.' : 'Infraestructura aislada aún no vinculada.';
    authButton.textContent = snapshot.signedIn ? 'CERRAR SESIÓN' : 'INICIAR SESIÓN';
    restoreButton.disabled = !snapshot.signedIn;

    for (const item of PREMIUM_PRODUCTS) {
      const button = store.querySelector(`[data-buy-sku="${item.sku}"]`);
      const card = button?.closest('.v11-product');
      if (!button || !card) continue;
      const owned = snapshot.ownedSkus.includes(item.sku);
      card.classList.toggle('v12-owned', owned);
      button.textContent = owned ? 'EQUIPAR' : snapshot.signedIn ? 'COMPRAR' : snapshot.configured ? 'INICIAR SESIÓN' : 'COMPRAR';
      button.disabled = false;
    }
  };

  subscribeCommerce(updateCommerceUi);

  account.querySelector('[data-v12-auth]').addEventListener('click', async () => {
    if (commerceSnapshot().signedIn) {
      await signOut();
      showStatus('SESIÓN CERRADA', 'Tus compras siguen guardadas en el servidor y pueden restaurarse al volver a entrar.');
    } else openAuth();
  });

  account.querySelector('[data-v12-restore]').addEventListener('click', async () => {
    try {
      await refreshEntitlements();
      const count = commerceSnapshot().ownedSkus.length;
      showStatus('COMPRAS RESTAURADAS', count ? `${count} producto${count === 1 ? '' : 's'} premium verificado${count === 1 ? '' : 's'} por servidor.` : 'La cuenta está sincronizada y todavía no tiene productos premium.');
    } catch (error) {
      showStatus('NO SE PUDO RESTAURAR', error.message || 'Error de sincronización.');
    }
  });

  authModal.querySelector('[data-v12-auth-close]').addEventListener('click', closeAuth);
  authModal.addEventListener('click', (event) => { if (event.target === authModal) closeAuth(); });
  authModal.querySelector('[data-v12-auth-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    authMessage('VERIFICANDO…');
    try {
      await signIn(String(data.get('email') ?? '').trim(), String(data.get('password') ?? ''));
      authMessage('CUENTA VERIFICADA');
      setTimeout(closeAuth, 350);
    } catch (error) {
      authMessage(error.message || 'NO SE PUDO INICIAR SESIÓN');
    }
  });
  authModal.querySelector('[data-v12-signup]').addEventListener('click', async () => {
    const form = authModal.querySelector('[data-v12-auth-form]');
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    authMessage('CREANDO CUENTA…');
    try {
      const result = await signUp(String(data.get('email') ?? '').trim(), String(data.get('password') ?? ''));
      authMessage(result.access_token ? 'CUENTA CREADA · SESIÓN ACTIVA' : 'REVISA TU CORREO PARA CONFIRMAR LA CUENTA');
      if (result.access_token) setTimeout(closeAuth, 500);
    } catch (error) {
      authMessage(error.message || 'NO SE PUDO CREAR LA CUENTA');
    }
  });

  statusModal.addEventListener('click', (event) => {
    if (event.target === statusModal || event.target.closest('[data-v12-status-close]')) statusModal.classList.add('hidden');
  });

  document.addEventListener('click', async (event) => {
    const buy = event.target.closest('[data-buy-sku]');
    if (!buy) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const sku = buy.dataset.buySku;
    const snapshot = commerceSnapshot();

    if (snapshot.ownedSkus.includes(sku)) {
      const result = game?.equipPremium?.(sku);
      showStatus(result?.ok ? 'EQUIPADO' : 'VERIFICACIÓN NECESARIA', result?.ok ? 'El producto premium ya está activo para la siguiente partida.' : 'No se equipó nada porque el entitlement no está verificado en memoria.');
      return;
    }
    if (!snapshot.configured) {
      showStatus('COMPRA PROTEGIDA', 'No se aceptará dinero ni se concederá contenido localmente hasta que el backend aislado y el proveedor de pagos estén conectados.');
      return;
    }
    if (!snapshot.signedIn) {
      openAuth();
      return;
    }

    buy.disabled = true;
    const previous = buy.textContent;
    buy.textContent = 'PREPARANDO PAGO…';
    try {
      const checkout = await createCheckout(sku);
      window.location.assign(checkout.url);
    } catch (error) {
      buy.disabled = false;
      buy.textContent = previous;
      showStatus('CHECKOUT NO DISPONIBLE', error.message || 'El proveedor de pagos todavía no está configurado.');
    }
  }, true);

  const query = new URLSearchParams(window.location.search);
  const checkoutState = query.get('checkout');
  restoreSession().then(async () => {
    if (checkoutState === 'success' && commerceSnapshot().signedIn) {
      try {
        await refreshEntitlements();
        showStatus('COMPRA VERIFICADA', 'El servidor sincronizó tu cuenta. Si Stripe confirmó el pago, el producto ya puede equiparse.');
      } catch {
        showStatus('PAGO RECIBIDO · SINCRONIZANDO', 'La tienda regresó del proveedor de pagos, pero el entitlement aún no se pudo refrescar. Usa Restaurar compras.');
      }
    } else if (checkoutState === 'cancel') {
      showStatus('COMPRA CANCELADA', 'No se concedió ningún producto y tu inventario no cambió.');
    }
    if (checkoutState) {
      query.delete('checkout');
      query.delete('session_id');
      const next = `${window.location.pathname}${query.toString() ? `?${query}` : ''}${window.location.hash}`;
      history.replaceState({}, '', next);
    }
  });
}

installCommerceUi();
