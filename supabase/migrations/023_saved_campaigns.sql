-- Saved campaigns: creators bookmark campaigns to revisit and apply later.
-- Mirrors saved_creators (brands → creators), reversed: creators → campaigns.
-- Mutations go through an authorized server route (service role); the table is
-- read-only to the owning creator via RLS.

create table public.saved_campaigns (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid not null references public.creator_profiles(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (creator_id, campaign_id)
);

create index idx_saved_campaigns_creator on public.saved_campaigns(creator_id);

alter table public.saved_campaigns enable row level security;
-- The owning creator can read their own saved list.
create policy "saved_campaigns_creator_select" on public.saved_campaigns for select
  using (
    creator_id in (
      select cp.id from public.creator_profiles cp where cp.user_id = auth.uid()
    )
  );
revoke all on table public.saved_campaigns from anon, authenticated;
grant select on table public.saved_campaigns to authenticated;
-- Insert/delete happen via the service-role server route (/api/saved-campaigns).
