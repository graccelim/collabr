-- Rollback for Phase 1B RLS and direct-client privilege hardening.
--
-- IMPORTANT: Run this rollback before
-- 002_rollback_database_integrity_constraints.sql.
--
-- WARNING: This rollback reintroduces security vulnerabilities. Authenticated
-- users regain broad direct-client mutation access to trusted profile,
-- workflow, payment, dispute, review, and notification data. Public profile
-- reads may expose private Stripe identifiers.

begin;

-- Remove Phase 1B policies.
drop policy if exists "users_own_select" on public.users;
drop policy if exists "users_own_update" on public.users;

drop policy if exists "brand_public_select" on public.brand_profiles;
drop policy if exists "brand_own_update" on public.brand_profiles;

drop policy if exists "creator_public_select" on public.creator_profiles;
drop policy if exists "creator_own_update" on public.creator_profiles;

drop policy if exists "campaign_public_active_select" on public.campaigns;
drop policy if exists "campaign_brand_select" on public.campaigns;

drop policy if exists "application_creator_select" on public.applications;
drop policy if exists "application_brand_select" on public.applications;

drop policy if exists "collab_parties_select" on public.collabs;
drop policy if exists "submission_parties_select" on public.submissions;
drop policy if exists "live_post_parties_select" on public.live_posts;
drop policy if exists "dispute_parties_select" on public.disputes;

drop policy if exists "notification_own_select" on public.notifications;
drop policy if exists "notification_own_update" on public.notifications;

-- Ensure rerunning this rollback does not fail on restored original policies.
drop policy if exists "users_own" on public.users;
drop policy if exists "brand_own" on public.brand_profiles;
drop policy if exists "brand_public_read" on public.brand_profiles;
drop policy if exists "creator_own" on public.creator_profiles;
drop policy if exists "creator_public_read" on public.creator_profiles;
drop policy if exists "campaign_brand_manage" on public.campaigns;
drop policy if exists "campaign_public_active" on public.campaigns;
drop policy if exists "app_creator_own" on public.applications;
drop policy if exists "app_brand_read" on public.applications;
drop policy if exists "app_brand_update" on public.applications;
drop policy if exists "collab_parties" on public.collabs;
drop policy if exists "submission_parties" on public.submissions;
drop policy if exists "live_post_parties" on public.live_posts;
drop policy if exists "dispute_parties" on public.disputes;
drop policy if exists "notif_own" on public.notifications;

-- Restore original broad policies.
create policy "users_own" on public.users for all
  using (auth.uid() = id);

create policy "brand_own" on public.brand_profiles for all
  using (auth.uid() = user_id);
create policy "brand_public_read" on public.brand_profiles for select
  using (true);

create policy "creator_own" on public.creator_profiles for all
  using (auth.uid() = user_id);
create policy "creator_public_read" on public.creator_profiles for select
  using (true);

create policy "campaign_brand_manage" on public.campaigns for all
  using (
    brand_id in (
      select id from public.brand_profiles where user_id = auth.uid()
    )
  );
create policy "campaign_public_active" on public.campaigns for select
  using (status = 'active');

create policy "app_creator_own" on public.applications for all
  using (
    creator_id in (
      select id from public.creator_profiles where user_id = auth.uid()
    )
  );
create policy "app_brand_read" on public.applications for select
  using (
    campaign_id in (
      select id from public.campaigns where brand_id in (
        select id from public.brand_profiles where user_id = auth.uid()
      )
    )
  );
create policy "app_brand_update" on public.applications for update
  using (
    campaign_id in (
      select id from public.campaigns where brand_id in (
        select id from public.brand_profiles where user_id = auth.uid()
      )
    )
  );

create policy "collab_parties" on public.collabs for all
  using (
    creator_id in (
      select id from public.creator_profiles where user_id = auth.uid()
    )
    or brand_id in (
      select id from public.brand_profiles where user_id = auth.uid()
    )
  );

create policy "submission_parties" on public.submissions for all
  using (
    collab_id in (
      select id from public.collabs where
        creator_id in (
          select id from public.creator_profiles where user_id = auth.uid()
        )
        or brand_id in (
          select id from public.brand_profiles where user_id = auth.uid()
        )
    )
  );

create policy "live_post_parties" on public.live_posts for all
  using (
    collab_id in (
      select id from public.collabs where
        creator_id in (
          select id from public.creator_profiles where user_id = auth.uid()
        )
        or brand_id in (
          select id from public.brand_profiles where user_id = auth.uid()
        )
    )
  );

create policy "dispute_parties" on public.disputes for all
  using (
    collab_id in (
      select id from public.collabs where
        creator_id in (
          select id from public.creator_profiles where user_id = auth.uid()
        )
        or brand_id in (
          select id from public.brand_profiles where user_id = auth.uid()
        )
    )
  );

create policy "notif_own" on public.notifications for all
  using (auth.uid() = user_id);

-- Restore broad direct-client privileges needed by the original policies.
grant select, insert, update, delete on table
  public.users,
  public.brand_profiles,
  public.creator_profiles,
  public.campaigns,
  public.applications,
  public.collabs,
  public.submissions,
  public.live_posts,
  public.disputes,
  public.reviews,
  public.notifications
to anon, authenticated;

commit;
