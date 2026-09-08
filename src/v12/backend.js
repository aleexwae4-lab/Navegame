const STORAGE_KEY = 'wae_neon_rider_v12_session';

const env = {
  url: String(import.meta.env.VITE_WAE_SUPABASE_URL ?? '').replace(/\/$/, ''),
  key: String(import.meta.env.VITE_WAE_SUPABASE_PUBLISHABLE_KEY ?? ''),
  checkoutFunction: String(import.meta.env.VITE_WAE_COMMERCE_CHECKOUT_FUNCTION ?? 'wae-commerce-checkout'),
  entitlementsFunction: String(import.meta.env.VITE_WAE_COMMERCE_ENTITLEMENTS_FUNCTION ?? 'wae-commerce-entitlements'),
};

function readSession() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'); }
  catch { return null; }
}

function saveSession(session) {
  if (!session) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

async function parseJson(response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); }
  catch { return { message: text }; }
}

export const commerceState = {
  session: readSession(),
  ownedSkus: new Set(),
  orders: [],
  onEntitlementsChanged: null,
  listeners: new Set(),
};

export function commerceConfigured() {
  return Boolean(env.url && env.key);
}

export function commerceConfigSnapshot() {
  return {
    configured: commerceConfigured(),
    urlConfigured: Boolean(env.url),
    publishableKeyConfigured: Boolean(env.key),
    checkoutFunction: env.checkoutFunction,
    entitlementsFunction: env.entitlementsFunction,
  };
}

export function subscribeCommerce(listener) {
  commerceState.listeners.add(listener);
  listener(commerceSnapshot());
  return () => commerceState.listeners.delete(listener);
}

function emit() {
  const snapshot = commerceSnapshot();
  for (const listener of commerceState.listeners) listener(snapshot);
}

export function commerceSnapshot() {
  return {
    configured: commerceConfigured(),
    signedIn: Boolean(commerceState.session?.access_token),
    user: commerceState.session?.user ?? null,
    ownedSkus: [...commerceState.ownedSkus],
    orders: [...commerceState.orders],
  };
}

async function authRequest(path, body) {
  if (!commerceConfigured()) throw new Error('COMMERCE_BACKEND_NOT_CONFIGURED');
  const response = await fetch(`${env.url}${path}`, {
    method: 'POST',
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await parseJson(response);
  if (!response.ok) throw new Error(data?.msg || data?.message || data?.error_description || 'AUTH_REQUEST_FAILED');
  return data;
}

export async function signUp(email, password) {
  const data = await authRequest('/auth/v1/signup', { email, password });
  if (data.access_token) {
    commerceState.session = data;
    saveSession(data);
  }
  emit();
  return data;
}

export async function signIn(email, password) {
  const data = await authRequest('/auth/v1/token?grant_type=password', { email, password });
  commerceState.session = data;
  saveSession(data);
  emit();
  await refreshEntitlements();
  return data;
}

export async function signOut() {
  const token = commerceState.session?.access_token;
  if (commerceConfigured() && token) {
    try {
      await fetch(`${env.url}/auth/v1/logout`, {
        method: 'POST',
        headers: { apikey: env.key, Authorization: `Bearer ${token}` },
      });
    } catch {}
  }
  commerceState.session = null;
  commerceState.ownedSkus.clear();
  commerceState.orders = [];
  saveSession(null);
  commerceState.onEntitlementsChanged?.();
  emit();
}

async function functionRequest(functionName, { method = 'POST', body } = {}) {
  if (!commerceConfigured()) throw new Error('COMMERCE_BACKEND_NOT_CONFIGURED');
  const token = commerceState.session?.access_token;
  if (!token) throw new Error('AUTH_REQUIRED');
  const response = await fetch(`${env.url}/functions/v1/${functionName}`, {
    method,
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await parseJson(response);
  if (!response.ok) {
    const error = new Error(data?.message || data?.error || 'COMMERCE_REQUEST_FAILED');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function refreshEntitlements() {
  if (!commerceState.session?.access_token) {
    commerceState.ownedSkus.clear();
    commerceState.orders = [];
    commerceState.onEntitlementsChanged?.();
    emit();
    return commerceSnapshot();
  }
  const data = await functionRequest(env.entitlementsFunction, { method: 'GET' });
  commerceState.ownedSkus = new Set(Array.isArray(data.entitlements) ? data.entitlements.map((item) => item.sku) : []);
  commerceState.orders = Array.isArray(data.orders) ? data.orders : [];
  commerceState.onEntitlementsChanged?.();
  emit();
  return commerceSnapshot();
}

export async function createCheckout(sku) {
  const data = await functionRequest(env.checkoutFunction, { body: { sku } });
  if (!data?.url) throw new Error('CHECKOUT_URL_MISSING');
  return data;
}

export async function restoreSession() {
  if (!commerceConfigured() || !commerceState.session?.access_token) {
    emit();
    return commerceSnapshot();
  }
  try {
    const response = await fetch(`${env.url}/auth/v1/user`, {
      headers: { apikey: env.key, Authorization: `Bearer ${commerceState.session.access_token}` },
    });
    const user = await parseJson(response);
    if (!response.ok) throw new Error('SESSION_INVALID');
    commerceState.session = { ...commerceState.session, user };
    saveSession(commerceState.session);
    await refreshEntitlements();
  } catch {
    commerceState.session = null;
    commerceState.ownedSkus.clear();
    commerceState.orders = [];
    saveSession(null);
    commerceState.onEntitlementsChanged?.();
    emit();
  }
  return commerceSnapshot();
}
