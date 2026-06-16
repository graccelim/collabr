-- Phase 9: creator discovery - saved creators and campaign invites.
-- Discovery filters reuse the Phase 5/6 profile columns; no profile schema
-- changes are needed. Invite acceptance converges into the existing collab
-- workflow via select_application_atomic - no parallel workflow.

-- ─── SAVED CREATORS ──────────────────────────────────────────────────────────
create table public.saved_creators (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references public.brand_profiles(id) on delete cascade,
  creator_id  uuid not null references public.creator_profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (brand_id, creator_id)
);

create index idx_saved_creators_brand on public.saved_creators(brand_id);

alter table public.saved_creators enable row level security;
create policy "saved_creators_brand_select" on public.saved_creators for select
  using (
    brand_id in (
      select bp.id from public.brand_profiles bp where bp.user_id = auth.uid()
    )
  );
revoke all on table public.saved_creators from anon, authenticated;
grant select on table public.saved_creators to authenticated;
-- Mutations go through authorized server routes (service role).

-- ─── CAMPAIGN INVITES ────────────────────────────────────────────────────────
-- proposed_rate is required (cents) so acceptance can create a valid paid
-- collab through the existing atomic selection workflow.
create table public.campaign_invites (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid references public.campaigns(id) on delete cascade,
  brand_id       uuid not null references public.brand_profiles(id) on delete cascade,
  creator_id     uuid not null references public.creator_profiles(id) on delete cascade,
  message        text check (message is null or char_length(message) <= 1000),
  proposed_rate  integer not null check (proposed_rate > 0),
  status         text not null default 'pending'
                 check (status in ('pending', 'accepted', 'declined', 'expired')),
  created_at     timestamptz not null default now(),
  responded_at   timestamptz
);

-- One open invite per campaign per creator.
create unique index campaign_invites_pending_unique
  on public.campaign_invites(campaign_id, creator_id)
  where status = 'pending' and campaign_id is not null;

create index idx_campaign_invites_brand   on public.campaign_invites(brand_id, status);
create index idx_campaign_invites_creator on public.campaign_invites(creator_id, status);

alter table public.campaign_invites enable row level security;
create policy "campaign_invites_party_select" on public.campaign_invites for select
  using (
    brand_id in (
      select bp.id from public.brand_profiles bp where bp.user_id = auth.uid()
    )
    or creator_id in (
      select cp.id from public.creator_profiles cp where cp.user_id = auth.uid()
    )
  );
revoke all on table public.campaign_invites from anon, authenticated;
grant select on table public.campaign_invites to authenticated;
-- Mutations go through authorized server routes (service role): only brands
-- may create invites; only the invited creator may accept or decline.
