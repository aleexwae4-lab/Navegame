import { createClient } from 'npm:@supabase/supabase-js@2';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, idempotency-key',
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });

function formEncode(values: Record<string, string | number>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) params.set(key, String(value));
  return params.toString();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' });

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json(401, { error: 'AUTH_REQUIRED' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
  const publicAppUrl = (Deno.env.get('WAE_PUBLIC_APP_URL') || 'https://wae-neon-rider-live.onrender.com').replace(/\/$/, '');

  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json(500, { error: 'SUPABASE_RUNTIME_NOT_CONFIGURED' });
  if (!stripeSecret) return json(503, { error: 'PAYMENT_PROVIDER_NOT_CONFIGURED', provider: 'stripe' });

  let body: { sku?: string } = {};
  try { body = await req.json(); }
  catch { return json(400, { error: 'INVALID_JSON' }); }
  const sku = String(body.sku ?? '').trim();
  if (!sku) return json(400, { error: 'SKU_REQUIRED' });

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userResult, error: userError } = await userClient.auth.getUser();
  const user = userResult.user;
  if (userError || !user) return json(401, { error: 'INVALID_SESSION' });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existingEntitlement } = await admin
    .from('commerce_entitlements')
    .select('sku,status')
    .eq('user_id', user.id)
    .eq('sku', sku)
    .eq('status', 'active')
    .maybeSingle();
  if (existingEntitlement) return json(409, { error: 'ALREADY_OWNED', sku });

  const { data: product, error: productError } = await admin
    .from('commerce_products')
    .select('sku,kind,name,rarity,price_mxn,currency,active')
    .eq('sku', sku)
    .eq('active', true)
    .maybeSingle();
  if (productError || !product) return json(404, { error: 'PRODUCT_NOT_FOUND' });

  const clientIdempotency = String(req.headers.get('Idempotency-Key') ?? '').trim();
  const idempotencyKey = clientIdempotency || crypto.randomUUID();

  const { data: existingOrder } = await admin
    .from('commerce_orders')
    .select('id,provider_checkout_id,status')
    .eq('idempotency_key', idempotencyKey)
    .eq('user_id', user.id)
    .maybeSingle();
  if (existingOrder?.provider_checkout_id && existingOrder.status === 'pending') {
    return json(409, { error: 'CHECKOUT_ALREADY_CREATED', orderId: existingOrder.id });
  }

  const { data: order, error: orderError } = await admin
    .from('commerce_orders')
    .insert({
      user_id: user.id,
      sku: product.sku,
      amount_mxn: product.price_mxn,
      currency: product.currency,
      status: 'pending',
      provider: 'stripe',
      idempotency_key: idempotencyKey,
      metadata: { product_kind: product.kind, rarity: product.rarity },
    })
    .select('id')
    .single();
  if (orderError || !order) return json(500, { error: 'ORDER_CREATE_FAILED' });

  const stripeBody = formEncode({
    mode: 'payment',
    success_url: `${publicAppUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${publicAppUrl}/?checkout=cancel`,
    client_reference_id: user.id,
    'metadata[order_id]': order.id,
    'metadata[sku]': product.sku,
    'line_items[0][price_data][currency]': 'mxn',
    'line_items[0][price_data][unit_amount]': product.price_mxn * 100,
    'line_items[0][price_data][product_data][name]': product.name,
    'line_items[0][quantity]': 1,
  });

  const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': order.id,
    },
    body: stripeBody,
  });
  const stripeData = await stripeResponse.json();

  if (!stripeResponse.ok || !stripeData?.id || !stripeData?.url) {
    await admin.from('commerce_orders').update({ status: 'failed', metadata: { stripe_error: stripeData?.error?.code ?? 'checkout_failed' }, updated_at: new Date().toISOString() }).eq('id', order.id);
    return json(502, { error: 'PAYMENT_CHECKOUT_FAILED' });
  }

  await admin
    .from('commerce_orders')
    .update({ provider_checkout_id: stripeData.id, updated_at: new Date().toISOString() })
    .eq('id', order.id);

  return json(200, {
    provider: 'stripe',
    orderId: order.id,
    checkoutId: stripeData.id,
    url: stripeData.url,
  });
});
