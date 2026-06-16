-- ============================================================================
-- Phase 12 - Transactional product email dedupe log
--
-- Product (non-auth) emails are sent by the app via Resend. To guarantee a
-- given email is never sent twice (route retries, cron re-runs, double clicks),
-- every send first claims a unique `dedupe_key` here. A 23505 conflict means
-- "already sent" → the send is skipped.
--
-- Service-role only: written exclusively by server routes via createAdminClient.
-- No client policies (RLS on, zero policies) so recipient addresses stay private.
-- ============================================================================

create table if not exists public.email_log (
  id          uuid primary key default gen_random_uuid(),
  dedupe_key  text not null unique,
  recipient   text not null,
  email_type  text not null,
  created_at  timestamptz not null default now()
);

create index if not exists email_log_created_idx on public.email_log (created_at desc);

alter table public.email_log enable row level security;
-- No policies on purpose - only the service role (which bypasses RLS) touches it.
