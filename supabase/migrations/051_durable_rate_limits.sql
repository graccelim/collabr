-- ============================================================================
-- Durable rate limiting. The in-memory limiter (lib/rate-limit.ts) is
-- per-serverless-instance and resets on deploy, so its caps are soft on Vercel.
-- This adds a DB-backed sliding window used by security-sensitive routes
-- (signup, resend-verification, socials, invites, boost, creator-pro, AI).
-- The in-memory check stays as a cheap first line; this is the real cap.
--
-- Service-role only: RLS on with no policies, and the function is EXECUTE-
-- revoked from client roles (called via createAdminClient in lib/rate-limit).
-- ============================================================================

create table public.rate_limit_events (
  key        text not null,
  created_at timestamptz not null default now()
);

create index rate_limit_events_key_time
  on public.rate_limit_events (key, created_at);

alter table public.rate_limit_events enable row level security;

-- Sliding-window hit: prunes the key's expired events, counts the rest,
-- inserts + allows if under the limit. One round trip per check. Two racing
-- requests can both pass at exactly the boundary — acceptable softness (this
-- is spam friction, not an exactly-once counter).
create or replace function public.rate_limit_hit(
  p_key text,
  p_max int,
  p_window_seconds int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  delete from rate_limit_events
    where key = p_key
    and created_at < now() - make_interval(secs => p_window_seconds);

  select count(*) into v_count from rate_limit_events where key = p_key;
  if v_count >= p_max then
    return false;
  end if;

  insert into rate_limit_events (key) values (p_key);
  return true;
end;
$$;

revoke execute on function public.rate_limit_hit(text, int, int) from public;
revoke execute on function public.rate_limit_hit(text, int, int) from anon;
revoke execute on function public.rate_limit_hit(text, int, int) from authenticated;
