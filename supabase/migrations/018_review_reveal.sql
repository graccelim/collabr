-- ============================================================================
-- Phase 18 — Double-blind reviews + brand reputation
--
-- Reviews already exist (insert is gated to real completed+paid collabs). Two
-- gaps closed here:
--   1. DOUBLE-BLIND: a review becomes publicly visible only once BOTH sides have
--      reviewed, or 14 days after it was written — whichever comes first. This
--      stops retaliation/bias (you can't read their review before writing yours).
--   2. BRAND REPUTATION: creator_profiles already has rating_avg/rating_count
--      (migration 001) but brand_profiles does NOT — add the matching columns,
--      then grant them so creators can see who they'd be working with (the
--      aggregate is public; individual notes stay reveal-gated).
-- ============================================================================

-- ── 1. Reveal rule (SECURITY DEFINER → bypasses RLS, so no policy recursion) ──
create or replace function public.review_is_revealed(
  p_collab uuid, p_type text, p_created timestamptz
) returns boolean
language sql stable security definer set search_path = public as $$
  select (now() > p_created + interval '14 days')
      or exists (
        select 1 from public.reviews r
        where r.collab_id = p_collab and r.reviewer_type <> p_type
      );
$$;
grant execute on function public.review_is_revealed(uuid, text, timestamptz) to anon, authenticated;

-- ── 2. Replace the open read policy with the reveal gate ─────────────────────
-- Authors always see their own review; everyone else sees it only once revealed.
drop policy if exists "review_public_read" on public.reviews;
drop policy if exists "review_reveal_read" on public.reviews;
create policy "review_reveal_read" on public.reviews for select
  using (
    reviewer_id = auth.uid()
    or public.review_is_revealed(collab_id, reviewer_type, created_at)
  );

-- ── 3. Brand reputation columns (mirror creator_profiles: numeric(3,2)/int) ──
-- These did NOT exist on brand_profiles. Add them before granting/using them.
alter table public.brand_profiles
  add column if not exists rating_avg   numeric(3,2) default 0,
  add column if not exists rating_count integer      default 0;

-- Make brand reputation client-readable (it's public, like creators').
grant select (rating_avg, rating_count) on table public.brand_profiles to anon, authenticated;
