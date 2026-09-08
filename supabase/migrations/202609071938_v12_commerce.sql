-- WAE Neon Rider V12 · server-authoritative commerce schema
-- Isolated project only. Do not apply to unrelated WAE databases.

create extension if not exists pgcrypto;

create table if not exists public.commerce_products (
  sku text primary key,
  kind text not null check (kind in ('ship', 'weapon')),
  name text not null,
  rarity text not null,
  price_mxn integer not null check (price_mxn > 0),
  currency text not null default 'MXN' check (currency = 'MXN'),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commerce_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sku text not null references public.commerce_products(sku),
  amount_mxn integer not null check (amount_mxn > 0),
  currency text not null default 'MXN' check (currency = 'MXN'),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'expired', 'refunded', 'cancelled')),
  provider text not null default 'stripe',
  provider_checkout_id text,
  provider_payment_id text,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  refunded_at timestamptz
);

create table if not exists public.commerce_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sku text not null references public.commerce_products(sku),
  source_order_id uuid references public.commerce_orders(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'revoked', 'refunded')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (user_id, sku)
);

create index if not exists commerce_orders_user_created_idx on public.commerce_orders(user_id, created_at desc);
create index if not exists commerce_orders_provider_checkout_idx on public.commerce_orders(provider_checkout_id);
create index if not exists commerce_entitlements_user_idx on public.commerce_entitlements(user_id, status);

alter table public.commerce_products enable row level security;
alter table public.commerce_orders enable row level security;
alter table public.commerce_entitlements enable row level security;

revoke all on public.commerce_products from anon, authenticated;
revoke all on public.commerce_orders from anon, authenticated;
revoke all on public.commerce_entitlements from anon, authenticated;

grant select on public.commerce_products to authenticated;
grant select on public.commerce_orders to authenticated;
grant select on public.commerce_entitlements to authenticated;

create policy "authenticated can read active products"
on public.commerce_products
for select
to authenticated
using (active = true);

create policy "users can read own commerce orders"
on public.commerce_orders
for select
to authenticated
using (auth.uid() = user_id);

create policy "users can read own active entitlements"
on public.commerce_entitlements
for select
to authenticated
using (auth.uid() = user_id and status = 'active');

insert into public.commerce_products (sku, kind, name, rarity, price_mxn, metadata)
values
  ('WAE-SHIP-VIPER-BLK', 'ship', 'VIPER R BLACK EDITION', 'PREMIUM', 49, '{"series":"WAE BLACK SERIES"}'),
  ('WAE-SHIP-AEGIS-SOV', 'ship', 'AEGIS SOVEREIGN', 'ELITE', 89, '{"series":"WAE SOVEREIGN SERIES"}'),
  ('WAE-SHIP-NOVA-IMP', 'ship', 'NOVA IMPERIUM', 'LEGENDARY', 149, '{"series":"WAE IMPERIUM SERIES"}'),
  ('WAE-SHIP-ECLIPSE-X', 'ship', 'WAE ECLIPSE X', 'MYTHIC', 249, '{"series":"WAE ECLIPSE SERIES"}'),
  ('WAE-SHIP-OBSIDIAN-1', 'ship', 'WAE OBSIDIAN ONE', 'COLLECTOR', 399, '{"series":"WAE OBSIDIAN SERIES"}'),
  ('WAE-SHIP-CELESTIAL', 'ship', 'WAE CELESTIAL CROWN', 'FOUNDER', 699, '{"series":"WAE FOUNDER SERIES"}'),
  ('WAE-WPN-TRIDENT-VXR', 'weapon', 'TRIDENT VX-R', 'PREMIUM', 39, '{"series":"BLACK ARSENAL"}'),
  ('WAE-WPN-STORM-OMG', 'weapon', 'STORM OMEGA', 'ELITE', 69, '{"series":"SOVEREIGN ARSENAL"}'),
  ('WAE-WPN-ECLIPSE-CNN', 'weapon', 'ECLIPSE CANNON', 'LEGENDARY', 99, '{"series":"ECLIPSE ARSENAL"}'),
  ('WAE-WPN-HELIX-RG', 'weapon', 'HELIX RAILGUN', 'MYTHIC', 129, '{"series":"HELIX ARSENAL"}'),
  ('WAE-WPN-NOVA-DST', 'weapon', 'NOVA DESTROYER', 'COLLECTOR', 179, '{"series":"NOVA ARSENAL"}'),
  ('WAE-WPN-SINGULARITY', 'weapon', 'WAE SINGULARITY', 'FOUNDER', 249, '{"series":"FOUNDER ARSENAL"}')
on conflict (sku) do update set
  kind = excluded.kind,
  name = excluded.name,
  rarity = excluded.rarity,
  price_mxn = excluded.price_mxn,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();

create or replace function public.wae_has_entitlement(target_sku text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.commerce_entitlements
    where user_id = auth.uid()
      and sku = target_sku
      and status = 'active'
  );
$$;

grant execute on function public.wae_has_entitlement(text) to authenticated;
