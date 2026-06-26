-- ============================================================================
-- 039: Connected Creator ⭐ + Analytics + AI schema (Phases 3–5 foundation).
-- Provider-AGNOSTIC: no Phyllo specifics here. Phyllo (and any future source)
-- plugs into lib/analytics/adapters/* and writes these normalized tables.
--
-- COST CONTROL: phyllo_user_id is created ONLY after Stripe confirms Creator Pro
-- (stored on creator_subscriptions). Free creators never get a Phyllo user, so
-- these tables stay empty for them and no provider call is ever made.
--
-- EXPIRY = FREEZE: nothing here is deleted on lapse. Sync stops (entitlements),
-- Studio goes read-only, the ⭐ badge stays with a stale "last synced" — handled
-- in app code, not by dropping rows.
--
-- All additive. Does NOT touch payments/escrow/disputes/reviews/onboarding/
-- creator_scores/collabr_certification/creator_subscriptions(billing).
-- ============================================================================

-- Phyllo user id lives on the private billing row (created post-payment only).
alter table public.creator_subscriptions
  add column if not exists phyllo_user_id text;

-- Public, non-sensitive badge fields (brands see ⭐ + last-synced; not raw data).
alter table public.creator_profiles
  add column if not exists connected boolean not null default false,
  add column if not exists connected_platforms text[] not null default '{}',
  add column if not exists insights_last_synced_at timestamptz;

-- ── Connected accounts (one row per creator+platform) ───────────────────────
create table if not exists public.connected_accounts (
  id                  uuid primary key default gen_random_uuid(),
  creator_id          uuid not null references public.creator_profiles(id) on delete cascade,
  platform            text not null,            -- tiktok | instagram | youtube
  source              text not null default 'phyllo',
  external_account_id text,                     -- provider account id (e.g. Phyllo account_id)
  handle              text,
  status              text not null default 'connecting'
                      check (status in ('connecting','connected','error','revoked')),
  sync_frozen         boolean not null default false,   -- set true when Pro lapses
  consent_at          timestamptz,
  last_synced_at      timestamptz,
  created_at          timestamptz not null default now(),
  unique (creator_id, platform)
);
alter table public.connected_accounts enable row level security;
drop policy if exists "connected_accounts_owner_read" on public.connected_accounts;
create policy "connected_accounts_owner_read" on public.connected_accounts for select
  using (creator_id in (select id from public.creator_profiles where user_id = auth.uid()));
revoke all on table public.connected_accounts from anon, authenticated;
grant select on table public.connected_accounts to authenticated;

-- ── Append-only account-level snapshots (service-only) ──────────────────────
create table if not exists public.account_snapshots (
  id              bigint generated always as identity primary key,
  account_id      uuid not null references public.connected_accounts(id) on delete cascade,
  follower_count  bigint, avg_views bigint, avg_likes bigint, avg_comments bigint,
  avg_shares bigint, engagement_rate numeric(6,5),
  audience        jsonb,
  captured_at     timestamptz not null default now()
);
alter table public.account_snapshots enable row level security; -- no policy = service-role only

-- ── Posts (creator-readable for Studio) + per-post snapshots (service-only) ──
create table if not exists public.content_posts (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid references public.connected_accounts(id) on delete cascade,
  creator_id  uuid not null references public.creator_profiles(id) on delete cascade,
  collab_id   uuid references public.collabs(id) on delete set null,
  platform    text not null,
  external_id text, url text not null, posted_at timestamptz,
  category    text, style text, duration_sec int,    -- for Content DNA (nullable)
  created_at  timestamptz not null default now(),
  unique (account_id, external_id)
);
alter table public.content_posts enable row level security;
drop policy if exists "content_posts_owner_read" on public.content_posts;
create policy "content_posts_owner_read" on public.content_posts for select
  using (creator_id in (select id from public.creator_profiles where user_id = auth.uid()));
revoke all on table public.content_posts from anon, authenticated;
grant select on table public.content_posts to authenticated;

create table if not exists public.post_snapshots (
  id          bigint generated always as identity primary key,
  post_id     uuid not null references public.content_posts(id) on delete cascade,
  views bigint, likes bigint, comments bigint, shares bigint, saves bigint, reach bigint,
  captured_at timestamptz not null default now()
);
alter table public.post_snapshots enable row level security; -- service-role only

-- ── Precomputed rollups ─────────────────────────────────────────────────────
create table if not exists public.creator_rollups (
  creator_id  uuid primary key references public.creator_profiles(id) on delete cascade,
  time_window text not null default '90d',
  totals jsonb not null default '{}', averages jsonb not null default '{}',
  by_platform jsonb not null default '{}', trends jsonb,
  best_posts jsonb, worst_posts jsonb,
  computed_at timestamptz not null default now()
);
alter table public.creator_rollups enable row level security;
drop policy if exists "creator_rollups_owner_read" on public.creator_rollups;
create policy "creator_rollups_owner_read" on public.creator_rollups for select
  using (creator_id in (select id from public.creator_profiles where user_id = auth.uid()));
revoke all on table public.creator_rollups from anon, authenticated;
grant select on table public.creator_rollups to authenticated;

create table if not exists public.campaign_rollups (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  totals jsonb not null default '{}', derived jsonb not null default '{}',
  by_platform jsonb not null default '{}', per_creator jsonb not null default '[]',
  top_post jsonb, computed_at timestamptz not null default now()
);
alter table public.campaign_rollups enable row level security;
drop policy if exists "campaign_rollups_brand_read" on public.campaign_rollups;
create policy "campaign_rollups_brand_read" on public.campaign_rollups for select
  using (campaign_id in (
    select c.id from public.campaigns c
    join public.brand_profiles bp on bp.id = c.brand_id
    where bp.user_id = auth.uid()
  ));
revoke all on table public.campaign_rollups from anon, authenticated;
grant select on table public.campaign_rollups to authenticated;

-- ── Content DNA (deterministic; creator-private) ────────────────────────────
create table if not exists public.content_dna (
  creator_id          uuid primary key references public.creator_profiles(id) on delete cascade,
  time_window         text not null default '90d',
  best_categories jsonb, best_platforms jsonb, averages jsonb,
  best_video_length jsonb, best_posting_days jsonb, best_posting_times jsonb,
  best_content_styles jsonb, audience_geo jsonb, audience_age jsonb,
  posting_consistency jsonb, confidence jsonb,
  computed_at         timestamptz not null default now()
);
alter table public.content_dna enable row level security;
drop policy if exists "content_dna_owner_read" on public.content_dna;
create policy "content_dna_owner_read" on public.content_dna for select
  using (creator_id in (select id from public.creator_profiles where user_id = auth.uid()));
revoke all on table public.content_dna from anon, authenticated;
grant select on table public.content_dna to authenticated;

-- ── AI surfaces (creator-private) ───────────────────────────────────────────
create table if not exists public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  period text not null, model text not null, summary text, suggestions jsonb,
  input_hash text, created_at timestamptz not null default now(),
  unique (creator_id, period)
);
create table if not exists public.ai_reports (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  period_start date not null, period_end date not null,
  model text not null, report jsonb not null, input_hash text,
  created_at timestamptz not null default now(),
  unique (creator_id, period_start, period_end)
);
create table if not exists public.ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  surface text not null check (surface in ('growth_coach','content_lab','brand_coach')),
  content text not null, tokens_in int, tokens_out int,
  created_at timestamptz not null default now()
);
create table if not exists public.ai_invite_analyses (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  collab_id uuid references public.collabs(id) on delete cascade,
  model text not null, analysis jsonb not null, input_hash text,
  created_at timestamptz not null default now(),
  unique (creator_id, collab_id)
);
create table if not exists public.ai_campaign_recaps (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  collab_id uuid not null references public.collabs(id) on delete cascade,
  model text not null, recap jsonb not null, input_hash text,
  created_at timestamptz not null default now(),
  unique (creator_id, collab_id)
);
create table if not exists public.creator_goals (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  kind text not null, target jsonb, status text not null default 'active',
  created_at timestamptz not null default now()
);

-- All ai_* + goals: creator owner-read, service-write.
do $$
declare t text;
begin
  foreach t in array array[
    'ai_insights','ai_reports','ai_chat_messages','ai_invite_analyses','ai_campaign_recaps','creator_goals'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_owner_read', t);
    execute format(
      'create policy %I on public.%I for select using (creator_id in (select id from public.creator_profiles where user_id = auth.uid()))',
      t || '_owner_read', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
  end loop;
end $$;

-- ── Ops: sync jobs + webhook log (service-only) ─────────────────────────────
create table if not exists public.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.connected_accounts(id) on delete cascade,
  kind text not null, status text not null default 'queued',
  attempts int not null default 0, error text,
  started_at timestamptz, finished_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.sync_jobs enable row level security; -- service-role only

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'phyllo',
  external_id text unique,            -- idempotency
  type text not null, payload jsonb not null,
  processed_at timestamptz, error text,
  received_at timestamptz not null default now()
);
alter table public.webhook_events enable row level security; -- service-role only
