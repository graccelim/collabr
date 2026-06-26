-- ============================================================================
-- 041: Brand billing privacy. brand_profiles is PUBLIC-READ (brand_public_select
-- using(true)), so Stripe IDs on it are world-readable. Move them into a private
-- brand_subscriptions table (owner-read, service-write), mirroring the creator
-- pattern. Only the two Stripe ID columns move — `plan`/subscription_status stay
-- so resolvePlan + its callers are unchanged. The brand Stripe *customer* is
-- shared with escrow; both now read it from here via lib/brand-billing.ts.
-- ============================================================================

create table if not exists public.brand_subscriptions (
  brand_id                uuid primary key references public.brand_profiles(id) on delete cascade,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  price_id                text,
  updated_at              timestamptz not null default now()
);
alter table public.brand_subscriptions enable row level security;

drop policy if exists "brand_subscriptions_owner_read" on public.brand_subscriptions;
create policy "brand_subscriptions_owner_read" on public.brand_subscriptions for select
  using (brand_id in (select id from public.brand_profiles where user_id = auth.uid()));
revoke all on table public.brand_subscriptions from anon, authenticated;
grant select on table public.brand_subscriptions to authenticated;

create index if not exists idx_brand_subscriptions_stripe_customer
  on public.brand_subscriptions(stripe_customer_id);

-- Migrate any existing IDs (brands who funded escrow already have a customer id).
insert into public.brand_subscriptions (brand_id, stripe_customer_id, stripe_subscription_id)
  select id, stripe_customer_id, stripe_subscription_id
  from public.brand_profiles
  where stripe_customer_id is not null or stripe_subscription_id is not null
  on conflict (brand_id) do nothing;

-- Remove the leak: drop the Stripe ID columns from the public-read table.
alter table public.brand_profiles
  drop column if exists stripe_customer_id,
  drop column if exists stripe_subscription_id;
