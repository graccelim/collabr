-- Phase 10: monetization architecture (beta mode + paid mode activation).
-- Subscription state lives alongside the existing plan column. While
-- BETA_FREE_PRO is enabled the application resolves every brand to Pro
-- ("Pro Beta") regardless of these columns, so no data migration is needed
-- to enter or leave beta — the flag flips behavior in code.
--
-- grandfathered_pro_until supports the beta → paid transition: existing beta
-- brands can be granted 30/60/90 days of complimentary Pro at launch with a
-- single UPDATE (no deploy), e.g.:
--   update public.brand_profiles
--   set grandfathered_pro_until = now() + interval '60 days'
--   where created_at < '<launch date>';

-- Idempotent: safe to re-run if an earlier revision of this migration
-- (without grandfathered_pro_until) was already applied.
alter table public.brand_profiles
  add column if not exists subscription_status text not null default 'beta_free'
    check (subscription_status in ('beta_free', 'active', 'cancelled', 'past_due')),
  add column if not exists subscription_current_period_end timestamptz,
  add column if not exists grandfathered_pro_until timestamptz;

-- Subscription state is intentionally NOT granted to client roles: the only
-- select policy on brand_profiles is public (using true), so a column grant
-- would expose every brand's billing state to any authenticated user. All
-- plan resolution happens in trusted server code via the service role,
-- scoped to the requesting user. Writes likewise happen only through
-- service-role webhook/billing routes.
revoke select (subscription_status, subscription_current_period_end, grandfathered_pro_until)
  on table public.brand_profiles from anon, authenticated;
