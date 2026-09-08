import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

function hex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyStripeSignature(payload: string, signatureHeader: string, secret: string) {
  const parts = signatureHeader.split(',').map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`));
  const expected = hex(mac);
  return signatures.some((candidate) => timingSafeEqual(candidate, expected));
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json(500, { error: 'SUPABASE_RUNTIME_NOT_CONFIGURED' });

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
  if (!webhookSecret) {
    const { data: secretRow } = await admin.from('commerce_runtime_secrets').select('value').eq('key', 'stripe_webhook_secret').maybeSingle();
    webhookSecret = secretRow?.value || '';
  }
  if (!webhookSecret) return json(503, { error: 'WEBHOOK_SECRET_NOT_CONFIGURED' });

  const signature = req.headers.get('Stripe-Signature') || '';
  const payload = await req.text();
  if (!signature || !(await verifyStripeSignature(payload, signature, webhookSecret))) {
    return json(400, { error: 'INVALID_STRIPE_SIGNATURE' });
  }

  let event: any;
  try { event = JSON.parse(payload); }
  catch { return json(400, { error: 'INVALID_JSON' }); }

  const type = String(event?.type || '');
  const object = event?.data?.object;

  if (type === 'checkout.session.completed' || type === 'checkout.session.async_payment_succeeded') {
    if (!object || object.payment_status !== 'paid') return json(200, { received: true, ignored: 'NOT_PAID' });
    const orderId = String(object.metadata?.order_id || '');
    const sku = String(object.metadata?.sku || '');
    const userId = String(object.client_reference_id || '');
    const currency = String(object.currency || '').toUpperCase();
    const amountTotal = Number(object.amount_total || 0);
    if (!orderId || !sku || !userId) return json(400, { error: 'MISSING_ORDER_METADATA' });

    const { data: order, error: orderError } = await admin
      .from('commerce_orders')
      .select('id,user_id,sku,amount_mxn,currency,status')
      .eq('id', orderId)
      .eq('user_id', userId)
      .eq('sku', sku)
      .maybeSingle();
    if (orderError || !order) return json(404, { error: 'ORDER_NOT_FOUND' });
    if (currency !== order.currency || amountTotal !== order.amount_mxn * 100) return json(409, { error: 'AMOUNT_MISMATCH' });

    const paymentId = String(object.payment_intent || '');
    const now = new Date().toISOString();
    const { error: updateError } = await admin.from('commerce_orders').update({
      status: 'paid',
      provider_checkout_id: String(object.id || ''),
      provider_payment_id: paymentId || null,
      paid_at: now,
      updated_at: now,
      metadata: { stripe_event_id: event.id, payment_status: object.payment_status },
    }).eq('id', order.id);
    if (updateError) return json(500, { error: 'ORDER_UPDATE_FAILED' });

    const { error: entitlementError } = await admin.from('commerce_entitlements').upsert({
      user_id: order.user_id,
      sku: order.sku,
      source_order_id: order.id,
      status: 'active',
      granted_at: now,
      revoked_at: null,
      metadata: { stripe_event_id: event.id, payment_intent: paymentId },
    }, { onConflict: 'user_id,sku' });
    if (entitlementError) return json(500, { error: 'ENTITLEMENT_GRANT_FAILED' });
    return json(200, { received: true, fulfilled: true, orderId: order.id, sku: order.sku });
  }

  if (type === 'checkout.session.expired') {
    const orderId = String(object?.metadata?.order_id || '');
    if (orderId) await admin.from('commerce_orders').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', orderId).eq('status', 'pending');
    return json(200, { received: true });
  }

  if (type === 'charge.refunded') {
    const paymentIntent = String(object?.payment_intent || '');
    if (!paymentIntent) return json(200, { received: true, ignored: 'NO_PAYMENT_INTENT' });
    const { data: order } = await admin.from('commerce_orders').select('id,user_id,sku').eq('provider_payment_id', paymentIntent).maybeSingle();
    if (!order) return json(200, { received: true, ignored: 'ORDER_NOT_FOUND' });
    const now = new Date().toISOString();
    await admin.from('commerce_orders').update({ status: 'refunded', refunded_at: now, updated_at: now }).eq('id', order.id);
    await admin.from('commerce_entitlements').update({ status: 'refunded', revoked_at: now, metadata: { stripe_event_id: event.id, refund_charge: object?.id || null } }).eq('user_id', order.user_id).eq('sku', order.sku);
    return json(200, { received: true, revoked: true, sku: order.sku });
  }

  return json(200, { received: true, ignored: type || 'UNKNOWN_EVENT' });
});
