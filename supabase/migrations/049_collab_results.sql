-- ============================================================================
-- Self-reported campaign results. After a collab completes, the creator reports
-- their post's real metrics (views/likes/comments/shares/saves/reach + link).
-- Compliant (no scraping/OAuth), works for every platform. Brands see per-collab
-- numbers plus per-campaign / brand-wide totals. Free for everyone.
--
-- Access is service-role only (RLS on, no policies): the collab detail, campaign
-- and profile pages already read via the admin client scoped by ownership, and
-- writes go through the results route with an explicit creator-ownership check.
-- ============================================================================

-- Reliable completion timestamp (paid AND barter). A trigger stamps it the first
-- time a collab becomes 'completed'; existing rows are backfilled.
alter table public.collabs add column if not exists completed_at timestamptz;
alter table public.collabs add column if not exists results_reminded_at timestamptz;

update public.collabs
  set completed_at = coalesce(captured_at, created_at)
  where status = 'completed' and completed_at is null;

create or replace function public.set_collab_completed_at() returns trigger as $$
begin
  if new.status = 'completed' and (old.status is distinct from 'completed') and new.completed_at is null then
    new.completed_at := now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_collab_completed_at on public.collabs;
create trigger trg_collab_completed_at
  before update on public.collabs
  for each row execute function public.set_collab_completed_at();

-- One reported-results row per collab.
create table if not exists public.collab_results (
  collab_id   uuid primary key references public.collabs(id) on delete cascade,
  creator_id  uuid not null references public.creator_profiles(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  brand_id    uuid references public.brand_profiles(id) on delete set null,
  views       integer,
  likes       integer,
  comments    integer,
  shares      integer,
  saves       integer,
  reach       integer,
  post_url    text,
  reported_at timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.collab_results enable row level security;
revoke all on table public.collab_results from anon, authenticated;

create index if not exists collab_results_campaign_idx on public.collab_results (campaign_id);
create index if not exists collab_results_brand_idx    on public.collab_results (brand_id);
create index if not exists collab_results_creator_idx  on public.collab_results (creator_id);
