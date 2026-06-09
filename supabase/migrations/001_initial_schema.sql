-- collabr. full schema migration
-- Run this in Supabase SQL Editor

-- ─── USERS ───────────────────────────────────────────────────────────────────
create table if not exists public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          text not null check (role in ('brand','creator','admin')),
  email         text unique not null,
  display_name  text,
  avatar_url    text,
  created_at    timestamptz default now()
);
alter table public.users enable row level security;
drop policy if exists "users_own" on public.users;
create policy "users_own" on public.users for all using (auth.uid() = id);

-- ─── BRAND PROFILES ──────────────────────────────────────────────────────────
create table if not exists public.brand_profiles (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid unique references public.users(id) on delete cascade,
  company_name           text not null default '',
  industry               text,
  website                text,
  logo_url               text,
  plan                   text default 'free' check (plan in ('free','pro')),
  stripe_customer_id     text,
  stripe_subscription_id text,
  created_at             timestamptz default now()
);
alter table public.brand_profiles enable row level security;
drop policy if exists "brand_own" on public.brand_profiles;
drop policy if exists "brand_public_read" on public.brand_profiles;
create policy "brand_own" on public.brand_profiles for all
  using (auth.uid() = user_id);
create policy "brand_public_read" on public.brand_profiles for select
  using (true);

-- ─── CREATOR PROFILES ────────────────────────────────────────────────────────
create table if not exists public.creator_profiles (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid unique references public.users(id) on delete cascade,
  bio                 text,
  niches              text[],
  platforms           jsonb default '{}',
  base_rate           integer default 0,
  is_verified         boolean default false,
  boost_active_until  timestamptz,
  rating_avg          numeric(3,2) default 0,
  rating_count        integer default 0,
  collabs_completed   integer default 0,
  total_earned        integer default 0,
  stripe_connect_id   text,
  created_at          timestamptz default now()
);
alter table public.creator_profiles enable row level security;
drop policy if exists "creator_own" on public.creator_profiles;
drop policy if exists "creator_public_read" on public.creator_profiles;
create policy "creator_own" on public.creator_profiles for all
  using (auth.uid() = user_id);
create policy "creator_public_read" on public.creator_profiles for select
  using (true);

-- ─── CAMPAIGNS ───────────────────────────────────────────────────────────────
create table if not exists public.campaigns (
  id                uuid primary key default gen_random_uuid(),
  brand_id          uuid references public.brand_profiles(id) on delete cascade,
  title             text not null,
  brief             text not null,
  deliverable_types text[],
  comp_type         text not null check (comp_type in ('paid','barter','both')),
  budget_min        integer,
  budget_max        integer,
  barter_detail     text,
  niche_tags        text[],
  min_followers     integer default 0,
  creators_needed   integer default 1,
  deadline          date,
  status            text default 'active'
                    check (status in ('draft','active','closed','completed')),
  is_featured       boolean default false,
  featured_until    timestamptz,
  created_at        timestamptz default now()
);
alter table public.campaigns enable row level security;
drop policy if exists "campaign_brand_manage" on public.campaigns;
drop policy if exists "campaign_public_active" on public.campaigns;
create policy "campaign_brand_manage" on public.campaigns for all
  using (brand_id in (
    select id from public.brand_profiles where user_id = auth.uid()
  ));
create policy "campaign_public_active" on public.campaigns for select
  using (status = 'active');

-- ─── APPLICATIONS ────────────────────────────────────────────────────────────
create table if not exists public.applications (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid references public.campaigns(id) on delete cascade,
  creator_id    uuid references public.creator_profiles(id) on delete cascade,
  pitch         text not null,
  proposed_rate integer,
  status        text default 'pending'
                check (status in ('pending','shortlisted','selected','rejected')),
  is_boosted    boolean default false,
  created_at    timestamptz default now(),
  unique(campaign_id, creator_id)
);
alter table public.applications enable row level security;
drop policy if exists "app_creator_own" on public.applications;
drop policy if exists "app_brand_read" on public.applications;
drop policy if exists "app_brand_update" on public.applications;
create policy "app_creator_own" on public.applications for all
  using (creator_id in (
    select id from public.creator_profiles where user_id = auth.uid()
  ));
create policy "app_brand_read" on public.applications for select
  using (campaign_id in (
    select id from public.campaigns where brand_id in (
      select id from public.brand_profiles where user_id = auth.uid()
    )
  ));
create policy "app_brand_update" on public.applications for update
  using (campaign_id in (
    select id from public.campaigns where brand_id in (
      select id from public.brand_profiles where user_id = auth.uid()
    )
  ));

-- ─── COLLABS ─────────────────────────────────────────────────────────────────
create table if not exists public.collabs (
  id                        uuid primary key default gen_random_uuid(),
  application_id            uuid references public.applications(id),
  campaign_id               uuid references public.campaigns(id),
  creator_id                uuid references public.creator_profiles(id),
  brand_id                  uuid references public.brand_profiles(id),
  agreed_rate               integer not null,
  platform_fee              integer not null,
  creator_payout            integer not null,
  status                    text default 'briefed'
                            check (status in (
                              'briefed','draft_submitted','in_revision',
                              'draft_approved','live_submitted','live_confirmed',
                              'disputed','completed','cancelled'
                            )),
  revision_count            integer default 0,
  stripe_payment_intent_id  text,
  draft_auto_approve_at     timestamptz,
  live_auto_release_at      timestamptz,
  created_at                timestamptz default now()
);
alter table public.collabs enable row level security;
drop policy if exists "collab_parties" on public.collabs;
create policy "collab_parties" on public.collabs for all
  using (
    creator_id in (select id from public.creator_profiles where user_id = auth.uid())
    or brand_id in (select id from public.brand_profiles where user_id = auth.uid())
  );

-- ─── SUBMISSIONS ─────────────────────────────────────────────────────────────
create table if not exists public.submissions (
  id              uuid primary key default gen_random_uuid(),
  collab_id       uuid references public.collabs(id) on delete cascade,
  version         integer not null default 1,
  file_url        text,
  creator_note    text,
  brand_feedback  text,
  decision        text default 'pending'
                  check (decision in ('pending','approved','revision','rejected')),
  submitted_at    timestamptz default now(),
  decided_at      timestamptz
);
alter table public.submissions enable row level security;
drop policy if exists "submission_parties" on public.submissions;
create policy "submission_parties" on public.submissions for all
  using (collab_id in (
    select id from public.collabs where
      creator_id in (select id from public.creator_profiles where user_id = auth.uid())
      or brand_id in (select id from public.brand_profiles where user_id = auth.uid())
  ));

-- ─── LIVE POSTS ──────────────────────────────────────────────────────────────
create table if not exists public.live_posts (
  id              uuid primary key default gen_random_uuid(),
  collab_id       uuid references public.collabs(id) on delete cascade,
  post_url        text not null,
  screenshot_url  text,
  submitted_at    timestamptz default now(),
  confirmed_at    timestamptz,
  disputed_at     timestamptz
);
alter table public.live_posts enable row level security;
drop policy if exists "live_post_parties" on public.live_posts;
create policy "live_post_parties" on public.live_posts for all
  using (collab_id in (
    select id from public.collabs where
      creator_id in (select id from public.creator_profiles where user_id = auth.uid())
      or brand_id in (select id from public.brand_profiles where user_id = auth.uid())
  ));

-- ─── DISPUTES ────────────────────────────────────────────────────────────────
create table if not exists public.disputes (
  id                uuid primary key default gen_random_uuid(),
  collab_id         uuid references public.collabs(id) on delete cascade,
  raised_by         text not null check (raised_by in ('brand','creator')),
  reason            text not null,
  evidence_urls     text[],
  outcome           text default 'pending'
                    check (outcome in ('pending','creator_wins','brand_wins','split','mutual')),
  split_percentage  integer,
  platform_ruling   text,
  resolved_at       timestamptz,
  created_at        timestamptz default now()
);
alter table public.disputes enable row level security;
drop policy if exists "dispute_parties" on public.disputes;
create policy "dispute_parties" on public.disputes for all
  using (collab_id in (
    select id from public.collabs where
      creator_id in (select id from public.creator_profiles where user_id = auth.uid())
      or brand_id in (select id from public.brand_profiles where user_id = auth.uid())
  ));

-- ─── REVIEWS ─────────────────────────────────────────────────────────────────
create table if not exists public.reviews (
  id             uuid primary key default gen_random_uuid(),
  collab_id      uuid references public.collabs(id) on delete cascade,
  reviewer_id    uuid references public.users(id),
  reviewer_type  text not null check (reviewer_type in ('brand','creator')),
  rating         integer not null check (rating between 1 and 5),
  note           text,
  created_at     timestamptz default now(),
  unique(collab_id, reviewer_type)
);
alter table public.reviews enable row level security;
drop policy if exists "review_insert" on public.reviews;
drop policy if exists "review_public_read" on public.reviews;
create policy "review_insert" on public.reviews for insert
  with check (auth.uid() = reviewer_id);
create policy "review_public_read" on public.reviews for select
  using (true);

-- ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users(id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  payload     jsonb default '{}',
  read        boolean default false,
  created_at  timestamptz default now()
);
alter table public.notifications enable row level security;
drop policy if exists "notif_own" on public.notifications;
create policy "notif_own" on public.notifications for all
  using (auth.uid() = user_id);

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
create index if not exists idx_campaigns_status       on public.campaigns(status);
create index if not exists idx_campaigns_brand        on public.campaigns(brand_id);
create index if not exists idx_applications_campaign  on public.applications(campaign_id);
create index if not exists idx_applications_creator   on public.applications(creator_id);
create index if not exists idx_collabs_creator        on public.collabs(creator_id);
create index if not exists idx_collabs_brand          on public.collabs(brand_id);
create index if not exists idx_collabs_status         on public.collabs(status);
create index if not exists idx_submissions_collab     on public.submissions(collab_id);
create index if not exists idx_notifications_user     on public.notifications(user_id, read);
create index if not exists idx_creator_boost          on public.creator_profiles(boost_active_until);
