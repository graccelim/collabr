-- Rollback Phase 18 — restore open review reads, drop reveal gate.

drop policy if exists "review_reveal_read" on public.reviews;
create policy "review_public_read" on public.reviews for select using (true);

drop function if exists public.review_is_revealed(uuid, text, timestamptz);

-- (Leaving the brand_profiles rating grant in place is harmless; revoke if needed:)
revoke select (rating_avg, rating_count) on table public.brand_profiles from anon, authenticated;
