-- Rollback for Phase 10: monetization architecture.
-- plan / stripe_customer_id / stripe_subscription_id predate this phase and
-- are left untouched. saved_creators, campaign_invites and other Pro-feature
-- data are never deleted by plan changes or by this rollback.

alter table public.brand_profiles
  drop column if exists grandfathered_pro_until,
  drop column if exists subscription_current_period_end,
  drop column if exists subscription_status;
