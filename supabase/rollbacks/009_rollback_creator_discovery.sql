-- Rollback for Phase 9: creator discovery.
-- Collabs created from accepted invites are regular collabs (with regular
-- applications) and are intentionally left untouched.

drop table if exists public.campaign_invites;
drop table if exists public.saved_creators;
