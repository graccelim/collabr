-- Rollback Phase 18 - restore open reviews, drop reveal/rating machinery.

drop trigger if exists trg_reviews_reveal on public.reviews;
drop trigger if exists trg_notify_review_available on public.collabs;
drop function if exists public.reviews_reveal_and_rate();
drop function if exists public.notify_review_available();
drop function if exists public.recompute_all_ratings();
drop function if exists public.recompute_creator_rating(uuid);
drop function if exists public.recompute_brand_rating(uuid);

-- Read: back to public-read.
drop policy if exists "review_reveal_read" on public.reviews;
create policy "review_public_read" on public.reviews for select using (true);

-- Insert: back to the pre-018 (paid-only) rule.
drop policy if exists "review_insert" on public.reviews;
create policy "review_insert" on public.reviews for insert
  with check (
    auth.uid() = reviewer_id
    and exists (
      select 1 from public.collabs c
      where c.id = reviews.collab_id
        and c.status = 'completed'
        and c.payment_status in ('paid', 'manual_exception')
        and (
          (reviews.reviewer_type = 'brand'
            and c.brand_id in (select bp.id from public.brand_profiles bp where bp.user_id = auth.uid()))
          or
          (reviews.reviewer_type = 'creator'
            and c.creator_id in (select cp.id from public.creator_profiles cp where cp.user_id = auth.uid()))
        )
    )
  );

alter table public.reviews drop constraint if exists reviews_note_length;
alter table public.reviews drop column if exists revealed_at;

-- Brand reputation columns were introduced by 018.
revoke select (rating_avg, rating_count) on table public.brand_profiles from anon, authenticated;
alter table public.brand_profiles
  drop column if exists rating_avg,
  drop column if exists rating_count;
