-- Phase 1B: RLS and direct-client privilege hardening
-- Trusted workflow and payment mutations must use server-side service-role access.

-- Remove broad policies that permit owners/parties to mutate every column.
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

-- Users may read their own account row and update only granted safe columns.
create policy "users_own_select" on public.users for select
  using (auth.uid() = id);
create policy "users_own_update" on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Profiles remain discoverable, but only owners may update granted safe columns.
create policy "brand_public_select" on public.brand_profiles for select
  using (true);
create policy "brand_own_update" on public.brand_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "creator_public_select" on public.creator_profiles for select
  using (true);
create policy "creator_own_update" on public.creator_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Brands may read their own campaigns. Campaign mutations go through server
-- routes so plan limits and trusted fields cannot be bypassed.
create policy "campaign_public_active_select" on public.campaigns for select
  using (status = 'active');
create policy "campaign_brand_select" on public.campaigns for select
  using (
    brand_id in (
      select bp.id from public.brand_profiles bp where bp.user_id = auth.uid()
    )
  );

-- Applications are readable by their creator and the owning campaign brand.
-- All application mutations go through authorized server routes.
create policy "application_creator_select" on public.applications for select
  using (
    creator_id in (
      select cp.id from public.creator_profiles cp where cp.user_id = auth.uid()
    )
  );
create policy "application_brand_select" on public.applications for select
  using (
    campaign_id in (
      select c.id
      from public.campaigns c
      join public.brand_profiles bp on bp.id = c.brand_id
      where bp.user_id = auth.uid()
    )
  );

-- Workflow records are read-only to their parties. Mutations use server routes.
create policy "collab_parties_select" on public.collabs for select
  using (
    creator_id in (
      select cp.id from public.creator_profiles cp where cp.user_id = auth.uid()
    )
    or brand_id in (
      select bp.id from public.brand_profiles bp where bp.user_id = auth.uid()
    )
  );

create policy "submission_parties_select" on public.submissions for select
  using (
    collab_id in (
      select c.id from public.collabs c
      where
        c.creator_id in (
          select cp.id from public.creator_profiles cp where cp.user_id = auth.uid()
        )
        or c.brand_id in (
          select bp.id from public.brand_profiles bp where bp.user_id = auth.uid()
        )
    )
  );

create policy "live_post_parties_select" on public.live_posts for select
  using (
    collab_id in (
      select c.id from public.collabs c
      where
        c.creator_id in (
          select cp.id from public.creator_profiles cp where cp.user_id = auth.uid()
        )
        or c.brand_id in (
          select bp.id from public.brand_profiles bp where bp.user_id = auth.uid()
        )
    )
  );

create policy "dispute_parties_select" on public.disputes for select
  using (
    collab_id in (
      select c.id from public.collabs c
      where
        c.creator_id in (
          select cp.id from public.creator_profiles cp where cp.user_id = auth.uid()
        )
        or c.brand_id in (
          select bp.id from public.brand_profiles bp where bp.user_id = auth.uid()
        )
    )
  );

-- Notifications can only be read by their owner. Owners may update only `read`.
create policy "notification_own_select" on public.notifications for select
  using (auth.uid() = user_id);
create policy "notification_own_update" on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Remove default table-wide direct-client privileges, then grant only the
-- operations and columns that are safe for browser/authenticated access.
revoke all on table public.users from anon, authenticated;
-- Anonymous relationship queries may reference users, but RLS exposes no rows
-- because anonymous requests have no auth.uid().
grant select on table public.users to anon, authenticated;
grant update (display_name, avatar_url) on table public.users to authenticated;

revoke all on table public.brand_profiles from anon, authenticated;
grant select (
  id, user_id, company_name, industry, website, logo_url, plan, created_at
) on table public.brand_profiles to anon, authenticated;
grant update (
  company_name, industry, website, logo_url
) on table public.brand_profiles to authenticated;

revoke all on table public.creator_profiles from anon, authenticated;
grant select (
  id, user_id, bio, niches, platforms, base_rate, is_verified,
  boost_active_until, rating_avg, rating_count, collabs_completed,
  total_earned, created_at
) on table public.creator_profiles to anon, authenticated;
grant update (
  bio, niches, platforms, base_rate
) on table public.creator_profiles to authenticated;

revoke all on table public.campaigns from anon, authenticated;
grant select on table public.campaigns to anon, authenticated;

revoke all on table public.applications from anon, authenticated;
grant select on table public.applications to authenticated;

revoke all on table public.collabs from anon, authenticated;
grant select on table public.collabs to authenticated;

revoke all on table public.submissions from anon, authenticated;
grant select on table public.submissions to authenticated;

revoke all on table public.live_posts from anon, authenticated;
grant select on table public.live_posts to authenticated;

revoke all on table public.disputes from anon, authenticated;
grant select on table public.disputes to authenticated;

revoke all on table public.reviews from anon, authenticated;
grant select on table public.reviews to anon, authenticated;
grant insert (collab_id, reviewer_id, reviewer_type, rating, note)
  on table public.reviews to authenticated;

revoke all on table public.notifications from anon, authenticated;
grant select on table public.notifications to authenticated;
grant update (read) on table public.notifications to authenticated;
