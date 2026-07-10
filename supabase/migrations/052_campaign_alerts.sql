-- ============================================================================
-- Phase 52 - Campaign alert emails (opt-out flag)
--
-- When a brand posts a campaign with niche tags, creators whose niche_tags
-- overlap get a "Campaign alert" email (see lib/campaign-notify.ts). This flag
-- is the opt-out: the unsubscribe link in every alert sets it false, and the
-- creator can flip it back on from Settings. Default true (alerts on).
-- ============================================================================

alter table public.creator_profiles
  add column if not exists campaign_alerts boolean not null default true;

-- Creators read + toggle their own flag from Settings (own-row RLS policy
-- already gates updates; mirrors the niche_tags column grants from 013).
grant select (campaign_alerts) on table public.creator_profiles to anon, authenticated;
grant update (campaign_alerts) on table public.creator_profiles to authenticated;
