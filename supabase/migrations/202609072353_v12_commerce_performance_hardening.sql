-- WAE Neon Rider V12 · commerce performance hardening
-- Mirrors the hardening applied to the isolated wae-neon-rider-commerce Supabase project.

create index if not exists commerce_orders_sku_idx on public.commerce_orders(sku);
create index if not exists commerce_entitlements_sku_idx on public.commerce_entitlements(sku);
create index if not exists commerce_entitlements_source_order_idx on public.commerce_entitlements(source_order_id);

drop policy if exists "users can read own commerce orders" on public.commerce_orders;
create policy "users can read own commerce orders"
on public.commerce_orders
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "users can read own active entitlements" on public.commerce_entitlements;
create policy "users can read own active entitlements"
on public.commerce_entitlements
for select
to authenticated
using ((select auth.uid()) = user_id and status = 'active');
