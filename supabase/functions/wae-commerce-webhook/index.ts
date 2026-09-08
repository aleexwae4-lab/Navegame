import { createClient } from 'npm:@supabase/supabase-js@2';

const jsonHeaders = { 'Content-Type': 'application/json' };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: jsonHeaders });

function bytesToHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function secureEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyStripeSignature(payload: string, header: string, secret: string) {
  const parts = header.split(',').map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));
  if (!timestamp || !signatures.length) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`));
  const expected = bytesToHex(signature);
  return signatures.some((candidate) => secureEqual(candidate, expected));
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' });

  const signatureHeader = req.headers.get('Stripe-Signature');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!signatureHeader || !webhookSecret) return json(401, { error: 'WEBHOOK_SIGNATURE_REQUIRED' });
  if (!supabaseUrl || !serviceRoleKey) return json(500, { error: 'SUPABASE_RUNTIME_NOT_CONFIGURED' });

  const rawBody = await req.text();
  if (!(await verifyStripeSignature(rawBody, signatureHeader, webhookSecret))) {
    return json(401, { error: 'INVALID_WEBHOOK_SIGNATURE' });
  }

  let event: any;
  try { event = JSON.parse(rawBody); }
  catch { return json(400, { error: 'INVALID_JSON' }); }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const now = new Date().toISOString();

  if (event.type === 'checkout.session.completed') {
    const session = event.data?.object;
    const orderId = String(session?.metadata?.order_id ?? '');
    if (!orderId) return json(400, { error: 'ORDER_ID_MISSING' });

    const { data: order, error: orderError } = await admin
      .from('commerce_orders')
      .select('id,user_id,sku,amount_mxn,currency,status')
      .eq('id', orderId)
      .maybeSingle();
    if (orderError || !order) return json(404, { error: 'ORDER_NOT_FOUND' });

    const amountOk = Number(session.amount_total) === Number(order.amount_mxn) * 100;
    const currencyOk = String(session.currency ?? '').toUpperCase() === String(order.currency).toUpperCase();
    const paid = session.payment_status === 'paid';
    if (!amountOk || !currencyOk || !paid) return json(409, { error: 'PAYMENT_VERIFICATION_FAILED' });

    const paymentId = String(session.payment_intent ?? session.id ?? '');
    const { error: updateError } = await admin
      .from('commerce_orders')
      .update({
        status: 'paid',
        provider_checkout_id: String(session.id),
        provider_payment_id: paymentId,
        paid_at: order.status === 'paid' ? undefined : now,
        updated_at: now,
      })
      .eq('id', order.id);
    if (updateError) return json(500, { error: 'ORDER_UPDATE_FAILED' });

    const { error: entitlementError } = await admin
      .from('commerce_entitlements')
      .upsert({
        user_id: order.user_id,
        sku: order.sku,
        source_order_id: order.id,
        status: 'active',
        revoked_at: null,
        metadata: { provider: 'stripe', checkout_id: session.id },
      }, { onConflict: 'user_id,sku' });
    if (entitlementError) return json(500, { error: 'ENTITLEMENT_GRANT_FAILED' });
  }

  if (event.type === 'checkout.session.expired') {
    const orderId = String(event.data?.object?.metadata?.order_id ?? '');
    if (orderId) {
      await admin
        .from('commerce_orders')
        .update({ status: 'expired', updated_at: now })
        .eq('id', orderId)
        .eq('status', 'pending');
    }
  }

  if (event.type === 'charge.refunded') {
    const charge = event.data?.object;
    const paymentIntent = String(charge?.payment_intent ?? '');
    if (paymentIntent) {
      const { data: order } = await admin
        .from('commerce_orders')
        .select('id,user_id,sku')
        .eq('provider_payment_id', paymentIntent)
        .maybeSingle();
      if (order) {
        await admin
          .from('commerce_orders')
          .update({ status: 'refunded', refunded_at: now, updated_at: now })
          .eq('id', order.id);
        await admin
          .from('commerce_entitlements')
          .update({ status: 'refunded', revoked_at: now })
          .eq('user_id', order.user_id)
          .eq('sku', order.sku);
      }
    }
  }

  return json(200, { received: true, type: event.type });
});
