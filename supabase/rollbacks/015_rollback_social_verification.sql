-- Rollback Phase 15 — social verification
drop index if exists public.idx_social_accounts_pending;
drop index if exists public.idx_verification_events_pending;
drop index if exists public.idx_verification_events_account;
drop table if exists public.verification_events;

alter table public.social_accounts
  drop column if exists verified_follower_count_at,
  drop column if exists verified_follower_count,
  drop column if exists verified_by,
  drop column if exists verified_at,
  drop column if exists verification_requested_at,
  drop column if exists verification_code_expires_at,
  drop column if exists verification_code,
  drop column if exists verification_method;
