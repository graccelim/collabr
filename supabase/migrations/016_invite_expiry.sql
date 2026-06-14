-- ============================================================================
-- Phase 16 — Invite expiry (response-metric foundation)
--
-- Invites that sit `pending` past the window become `expired` so they count as
-- a non-response in the creator response metric (Phase 14). Adds an explicit
-- expiry timestamp + a set-based expiry function the cron calls.
-- ============================================================================

alter table public.campaign_invites
  add column if not exists expires_at timestamptz;

-- Backfill an expiry for existing pending invites (7 days from creation).
update public.campaign_invites
  set expires_at = created_at + interval '7 days'
  where expires_at is null;

create index if not exists idx_campaign_invites_expiry
  on public.campaign_invites (expires_at)
  where status = 'pending';

-- Expire overdue pending invites. Returns the number expired.
create or replace function public.expire_overdue_invites()
returns integer
language plpgsql security definer set search_path = public
as $$
declare v_count int;
begin
  update public.campaign_invites
    set status = 'expired', responded_at = null
    where status = 'pending'
      and coalesce(expires_at, created_at + interval '7 days') < now();
  get diagnostics v_count = row_count;
  return v_count;
end $$;
