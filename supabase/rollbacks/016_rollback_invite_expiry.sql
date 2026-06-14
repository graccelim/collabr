-- Rollback Phase 16 — invite expiry
drop function if exists public.expire_overdue_invites();
drop index if exists public.idx_campaign_invites_expiry;
alter table public.campaign_invites drop column if exists expires_at;
