-- 032: allow rate-0 (pure barter) invites.
--
-- campaign_invites.proposed_rate was `check (proposed_rate > 0)`, which rejected
-- barter invites (no cash). Relax to >= 0 so a brand can invite a creator to a
-- barter campaign; acceptance creates a true barter collab (agreed_rate 0).
alter table public.campaign_invites drop constraint if exists campaign_invites_proposed_rate_check;
alter table public.campaign_invites
  add constraint campaign_invites_proposed_rate_check check (proposed_rate >= 0);
