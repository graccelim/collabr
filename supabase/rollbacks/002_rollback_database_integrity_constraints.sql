-- Rollback for Phase 1A database integrity constraints.
--
-- IMPORTANT: Run 003_rollback_rls_security_hardening.sql before this rollback.
--
-- WARNING: This rollback reintroduces duplicate and invalid workflow risks,
-- including duplicate collabs, live posts, submission versions, unresolved
-- disputes, negative monetary values, invalid campaign budgets, and reviews
-- from users who are not parties to a completed collab.

begin;

drop index if exists public.collabs_application_id_unique;
drop index if exists public.disputes_one_unresolved_per_collab;

alter table public.live_posts
  drop constraint if exists live_posts_collab_id_unique;

alter table public.submissions
  drop constraint if exists submissions_collab_id_version_unique;

alter table public.collabs
  drop constraint if exists collabs_agreed_rate_non_negative,
  drop constraint if exists collabs_platform_fee_non_negative,
  drop constraint if exists collabs_creator_payout_non_negative;

alter table public.campaigns
  drop constraint if exists campaigns_budget_min_non_negative,
  drop constraint if exists campaigns_budget_max_non_negative,
  drop constraint if exists campaigns_budget_range_valid;

-- Restore the original, weaker review authorization policy.
drop policy if exists "review_insert" on public.reviews;
create policy "review_insert" on public.reviews for insert
  with check (auth.uid() = reviewer_id);

commit;
