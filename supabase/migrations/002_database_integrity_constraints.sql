-- Phase 1A: database integrity constraints
-- Existing duplicate or invalid rows must be reconciled before this migration
-- can be applied successfully.

-- One collab may be created from a selected application.
create unique index collabs_application_id_unique
  on public.collabs(application_id)
  where application_id is not null;

-- A collab has one live post record.
alter table public.live_posts
  add constraint live_posts_collab_id_unique unique (collab_id);

-- Submission versions are unique within a collab.
alter table public.submissions
  add constraint submissions_collab_id_version_unique unique (collab_id, version);

-- A collab may have only one unresolved dispute.
create unique index disputes_one_unresolved_per_collab
  on public.disputes(collab_id)
  where resolved_at is null;

-- Monetary values cannot be negative.
alter table public.collabs
  add constraint collabs_agreed_rate_non_negative check (agreed_rate >= 0),
  add constraint collabs_platform_fee_non_negative check (platform_fee >= 0),
  add constraint collabs_creator_payout_non_negative check (creator_payout >= 0);

alter table public.campaigns
  add constraint campaigns_budget_min_non_negative check (budget_min >= 0),
  add constraint campaigns_budget_max_non_negative check (budget_max >= 0),
  add constraint campaigns_budget_range_valid check (
    budget_min is null
    or budget_max is null
    or budget_max >= budget_min
  );

-- Only a party to a completed collab may review it, using their actual role.
drop policy if exists "review_insert" on public.reviews;
create policy "review_insert" on public.reviews for insert
  with check (
    auth.uid() = reviewer_id
    and exists (
      select 1
      from public.collabs c
      where c.id = reviews.collab_id
        and c.status = 'completed'
        and (
          (
            reviews.reviewer_type = 'brand'
            and c.brand_id in (
              select bp.id
              from public.brand_profiles bp
              where bp.user_id = auth.uid()
            )
          )
          or
          (
            reviews.reviewer_type = 'creator'
            and c.creator_id in (
              select cp.id
              from public.creator_profiles cp
              where cp.user_id = auth.uid()
            )
          )
        )
    )
  );
