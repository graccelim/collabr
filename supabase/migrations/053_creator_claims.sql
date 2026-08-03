-- ============================================================================
-- Phase 53 - Concierge beta: admin-seeded creator profiles + claim flow
--
-- Lets an admin create a creator_profiles row before the creator has an
-- account (user_id stays NULL - already nullable, no change needed there).
-- The creator later "claims" it via a secure, single-use, expiring link.
--
-- Three additive pieces, each reusing existing architecture as far as
-- possible rather than building a parallel system:
--   1. creator_profiles: three new columns (display_name, created_by_admin,
--      archived_at) - no new table for the profile itself.
--   2. creator_claims: PURE token lifecycle (issue/validate/consume/revoke).
--      Deliberately carries no brand/campaign context - seeing "which brands
--      want this creator" is a job for campaign_invites / the table below,
--      not the claim token.
--   3. pending_collab_requests: a brand's "Request Collaboration" on a still-
--      unclaimed creator. NOT a second invite system - it has no status
--      lifecycle a creator ever sees. At claim time, every unmaterialized row
--      for that creator becomes a REAL campaign_invites row via the exact
--      same createInvite() the normal brand-invite flow already uses, so
--      campaign_invites keeps meaning exactly what it means today: a real,
--      dispatched invitation, never a speculative one.
-- ============================================================================

alter table public.creator_profiles
  add column if not exists display_name text;
comment on column public.creator_profiles.display_name is
  'Name for an admin-seeded, not-yet-claimed profile. Seeds users.display_name at claim time (a one-time initial value, same as signup''s name field) - users.display_name remains the source of truth for every claimed creator, exactly as today.';

alter table public.creator_profiles
  add column if not exists created_by_admin boolean not null default false;

alter table public.creator_profiles
  add column if not exists archived_at timestamptz;
comment on column public.creator_profiles.archived_at is
  'Soft-hide from public discovery/search and direct profile view. Does NOT affect a claimed creator''s ability to log in and use their own dashboard - archiving is a visibility control, not a suspension. Reversible (clear to un-archive).';

alter table public.creator_profiles
  add column if not exists internal_notes text;
comment on column public.creator_profiles.internal_notes is
  'Admin-only sourcing notes (e.g. "contacted on Instagram", "prefers email"). Never exposed publicly - no anon/authenticated grant below, unlike display_name/created_by_admin/archived_at.';

-- No anon/authenticated grant here: every reader of pre-claim admin fields
-- (the admin tool, the claim page) goes through the service-role client,
-- which bypasses column grants entirely. Granting these to anon/authenticated
-- would be pure unused surface area with no real reader - so, unlike an
-- earlier draft of this migration, we don't.

-- ─── CREATOR CLAIMS (pure token lifecycle) ──────────────────────────────────
create table if not exists public.creator_claims (
  id           uuid primary key default gen_random_uuid(),
  creator_id   uuid not null references public.creator_profiles(id) on delete cascade,
  token_hash   text not null unique,   -- sha256(raw token) - raw token is never stored
  created_at   timestamptz not null default now(),
  created_by   uuid not null references public.users(id),
  expires_at   timestamptz not null,
  used_at      timestamptz,
  revoked_at   timestamptz,
  opened_at    timestamptz  -- first GET that resolved 'valid' (funnel signal only, never consumed - see markClaimOpened)
);
create index if not exists idx_creator_claims_creator on public.creator_claims(creator_id);
create index if not exists idx_creator_claims_active
  on public.creator_claims(expires_at)
  where used_at is null and revoked_at is null;

alter table public.creator_claims enable row level security;
-- No client policies - same posture as campaign_invites and email_log. Every
-- read/write goes through a server route on the service-role client.
revoke all on table public.creator_claims from anon, authenticated;

-- ─── PENDING COLLAB REQUESTS ─────────────────────────────────────────────────
-- "Request Collaboration" on an unclaimed creator. A queue, not an invite: no
-- status a creator ever sees, no accept/decline. Exists purely so (a) you can
-- see who's interested before you've even reached out, and (b) claim can
-- materialize the real campaign_invites rows automatically.
create table if not exists public.pending_collab_requests (
  id              uuid primary key default gen_random_uuid(),
  creator_id      uuid not null references public.creator_profiles(id) on delete cascade,
  brand_id        uuid not null references public.brand_profiles(id) on delete cascade,
  campaign_id     uuid not null references public.campaigns(id) on delete cascade,
  proposed_rate   integer not null check (proposed_rate >= 0),
  message         text check (message is null or char_length(message) <= 1000),
  created_at      timestamptz not null default now(),
  materialized_at timestamptz,  -- set once turned into a real campaign_invites row
  -- Admin-only outreach workflow (e.g. "did I already DM this brand's ask?").
  -- Deliberately NOT 'claimed'/'expired' as values: those are facts already
  -- derivable from materialized_at and the creator's claim record, not things
  -- a human decides - storing them here would create a second, driftable
  -- source of truth for state the system already tracks correctly.
  status          text not null default 'pending'
                    check (status in ('pending', 'contacted', 'interested', 'declined'))
);
-- At most one live (unmaterialized) request per brand+campaign+creator -
-- mirrors campaign_invites' own pending-uniqueness pattern.
create unique index if not exists pending_collab_requests_unique
  on public.pending_collab_requests(creator_id, campaign_id)
  where materialized_at is null;
create index if not exists idx_pending_collab_requests_creator
  on public.pending_collab_requests(creator_id) where materialized_at is null;

alter table public.pending_collab_requests enable row level security;
-- No client policies - service-role only, same as creator_claims above.
revoke all on table public.pending_collab_requests from anon, authenticated;
