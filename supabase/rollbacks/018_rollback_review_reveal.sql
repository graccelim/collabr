-- Rollback Phase 18 — restore open review reads, drop reveal gate.

drop policy if exists "review_reveal_read" on public.reviews;
create policy "review_public_read" on public.reviews for select using (true);

drop function if exists public.review_is_revealed(uuid, text, timestamptz);

-- Brand reputation columns were introduced by 018 (they did not exist before),
-- so reverse them fully. Revoke before drop.
revoke select (rating_avg, rating_count) on table public.brand_profiles from anon, authenticated;
alter table public.brand_profiles
  drop column if exists rating_avg,
  drop column if exists rating_count;
