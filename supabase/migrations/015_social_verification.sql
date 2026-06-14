-- ============================================================================
-- Phase 15 — Social ownership verification (bio-code)
--
-- Beta verification = ACCOUNT OWNERSHIP only (creator places a one-time code in
-- their bio; an admin confirms). It does NOT verify follower count, engagement,
-- or audience — follower_count stays self-reported. The schema is source-
-- agnostic so OAuth (which can set verified_follower_count) drops in later.
--
-- verification_status remains service-role-set only (existing grant in 007).
-- ============================================================================

alter table public.social_accounts
  add column if not exists verification_method        text
    check (verification_method is null or verification_method in ('bio_code','oauth')),
  add column if not exists verification_code           text,
  add column if not exists verification_code_expires_at timestamptz,
  add column if not exists verification_requested_at   timestamptz,
  add column if not exists verified_at                 timestamptz,
  add column if not exists verified_by                 uuid references public.users(id),
  add column if not exists verified_follower_count     integer,    -- null until OAuth
  add column if not exists verified_follower_count_at  timestamptz;

-- Owners may read these on their own accounts; the verification_status column
-- itself stays non-client-writable (only the service role flips it).
grant select (verification_method, verification_code, verification_code_expires_at,
              verification_requested_at, verified_at)
  on table public.social_accounts to authenticated;

-- ── Audit trail ─────────────────────────────────────────────────────────────
create table if not exists public.verification_events (
  id                uuid primary key default gen_random_uuid(),
  social_account_id uuid not null references public.social_accounts(id) on delete cascade,
  creator_id        uuid references public.creator_profiles(id) on delete cascade,
  action            text not null check (action in ('requested','verified','rejected','revoked')),
  actor             uuid references public.users(id),
  reason            text,
  created_at        timestamptz not null default now()
);
create index if not exists idx_verification_events_account on public.verification_events (social_account_id, created_at desc);
create index if not exists idx_verification_events_pending on public.verification_events (created_at desc);

alter table public.verification_events enable row level security;
-- No client policies — written/read only by service role (request route + admin queue).

create index if not exists idx_social_accounts_pending
  on public.social_accounts (verification_requested_at)
  where verification_status = 'pending';
