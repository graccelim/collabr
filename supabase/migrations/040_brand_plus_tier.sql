-- ============================================================================
-- 040: Brand Plus tier. Widen brand_profiles.plan to include 'plus'.
-- Additive + safe: existing rows are 'free'/'pro'; the new value is only ever
-- written by the brand subscription webhook (price → tier mapping). Beta is
-- unaffected (resolvePlan short-circuits to Pro Beta before reading `plan`).
--
-- Billing-privacy (moving Stripe IDs off this public-read table into a private
-- brand_subscriptions table) is a SEPARATE migration (041) — kept isolated
-- because it touches the subscription webhook.
-- ============================================================================

alter table public.brand_profiles
  drop constraint if exists brand_profiles_plan_check;

alter table public.brand_profiles
  add constraint brand_profiles_plan_check
  check (plan in ('free', 'pro', 'plus'));
