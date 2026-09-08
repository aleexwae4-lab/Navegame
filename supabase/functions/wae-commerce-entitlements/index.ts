import { createClient } from 'npm:@supabase/supabase-js@2';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'GET') return json(405, { error: 'METHOD_NOT_ALLOWED' });

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json(401, { error: 'AUTH_REQUIRED' });

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anonKey) return json(500, { error: 'SUPABASE_RUNTIME_NOT_CONFIGURED' });

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userResult, error: userError } = await client.auth.getUser();
  if (userError || !userResult.user) return json(401, { error: 'INVALID_SESSION' });

  const [{ data: entitlements, error: entitlementError }, { data: orders, error: orderError }] = await Promise.all([
    client
      .from('commerce_entitlements')
      .select('sku,status,granted_at')
      .eq('status', 'active')
      .order('granted_at', { ascending: false }),
    client
      .from('commerce_orders')
      .select('id,sku,status,amount_mxn,currency,created_at,paid_at,refunded_at')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  if (entitlementError) return json(500, { error: 'ENTITLEMENTS_READ_FAILED' });
  if (orderError) return json(500, { error: 'ORDERS_READ_FAILED' });

  return json(200, {
    userId: userResult.user.id,
    entitlements: entitlements ?? [],
    orders: orders ?? [],
  });
});
