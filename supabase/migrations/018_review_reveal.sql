-- ============================================================================
-- Phase 18 - Double-blind reviews, honest aggregates, barter eligibility
--
-- Reviews already exist (1 per side per collab). This migration makes the
-- two-sided reputation system launch-ready:
--
--  1. DOUBLE-BLIND via reviews.revealed_at - a review is hidden until BOTH sides
--     submit (revealed immediately, DB trigger) or 7 days pass (cron). Authors
--     always see their own. No per-row function in RLS (cheap + scalable).
--  2. HONEST AGGREGATES (fixes audit C-1): rating_avg/rating_count are computed
--     from REVEALED reviews ONLY, so an unrevealed review never moves the public
--     number and the hidden score can't be inferred.
--  3. ANTI-FARMING: the average is one vote per DISTINCT counterparty (repeated
--     reviews from the same pair can't inflate it) and rating_count = distinct
--     collaborators. Preserves genuine repeat collabs and barter.
--  4. BARTER ELIGIBILITY: reviews unlock on completion for paid (money moved)
--     AND barter (agreed_rate = 0) collabs - accountability without cash.
--  5. NOTES: hard 1000-char DB cap (app also trims + moderates).
--  6. BRAND REPUTATION columns added (creator_profiles already had them).
-- ============================================================================

-- ── 1. Columns ───────────────────────────────────────────────────────────────
alter table public.reviews
  add column if not exists revealed_at timestamptz;

-- Existing reviews were public under the old policy - keep them visible.
update public.reviews set revealed_at = created_at where revealed_at is null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'reviews_note_length') then
    alter table public.reviews
      add constraint reviews_note_length check (note is null or char_length(note) <= 1000);
  end if;
end $$;

alter table public.brand_profiles
  add column if not exists rating_avg   numeric(3,2) default 0,
  add column if not exists rating_count integer      default 0;

-- ── 2. Reputation recompute (revealed-only, one vote per distinct counterparty)
create or replace function public.recompute_creator_rating(p_creator uuid)
returns void language sql security definer set search_path = public as $$
  update public.creator_profiles cp set
    rating_count = coalesce((
      select count(distinct c.brand_id)
      from public.reviews r join public.collabs c on c.id = r.collab_id
      where r.reviewer_type = 'brand' and r.revealed_at is not null and c.creator_id = p_creator
    ), 0),
    rating_avg = coalesce((
      select round(avg(per_cp), 2) from (
        select avg(r.rating) as per_cp
        from public.reviews r join public.collabs c on c.id = r.collab_id
        where r.reviewer_type = 'brand' and r.revealed_at is not null and c.creator_id = p_creator
        group by c.brand_id
      ) s
    ), 0)
  where cp.id = p_creator;
$$;

create or replace function public.recompute_brand_rating(p_brand uuid)
returns void language sql security definer set search_path = public as $$
  update public.brand_profiles bp set
    rating_count = coalesce((
      select count(distinct c.creator_id)
      from public.reviews r join public.collabs c on c.id = r.collab_id
      where r.reviewer_type = 'creator' and r.revealed_at is not null and c.brand_id = p_brand
    ), 0),
    rating_avg = coalesce((
      select round(avg(per_cp), 2) from (
        select avg(r.rating) as per_cp
        from public.reviews r join public.collabs c on c.id = r.collab_id
        where r.reviewer_type = 'creator' and r.revealed_at is not null and c.brand_id = p_brand
        group by c.creator_id
      ) s
    ), 0)
  where bp.id = p_brand;
$$;

create or replace function public.recompute_all_ratings()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select distinct creator_id from public.collabs where creator_id is not null loop
    perform public.recompute_creator_rating(r.creator_id);
  end loop;
  for r in select distinct brand_id from public.collabs where brand_id is not null loop
    perform public.recompute_brand_rating(r.brand_id);
  end loop;
end $$;

-- ── 3. Mutual reveal trigger - reveal both + refresh both aggregates ─────────
create or replace function public.reviews_reveal_and_rate()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_creator uuid; v_brand uuid;
begin
  if exists (
    select 1 from public.reviews r
    where r.collab_id = new.collab_id and r.reviewer_type <> new.reviewer_type
  ) then
    update public.reviews set revealed_at = coalesce(revealed_at, now())
      where collab_id = new.collab_id and revealed_at is null;
    select creator_id, brand_id into v_creator, v_brand from public.collabs where id = new.collab_id;
    if v_creator is not null then perform public.recompute_creator_rating(v_creator); end if;
    if v_brand is not null then perform public.recompute_brand_rating(v_brand); end if;
  end if;
  return null;
end $$;
drop trigger if exists trg_reviews_reveal on public.reviews;
create trigger trg_reviews_reveal after insert on public.reviews
  for each row execute function public.reviews_reveal_and_rate();

-- ── 4. "Review available" notification when a collab completes (any path) ────
create or replace function public.notify_review_available()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_brand_user uuid; v_creator_user uuid;
begin
  if new.status = 'completed' and (old.status is distinct from 'completed') then
    select user_id into v_brand_user   from public.brand_profiles   where id = new.brand_id;
    select user_id into v_creator_user from public.creator_profiles where id = new.creator_id;
    if v_brand_user is not null then
      insert into public.notifications (user_id, type, title, body, payload, dedupe_key)
      values (v_brand_user, 'review_available', 'You can now review this collaboration',
              'Reviews reveal once you both submit, or after 7 days.',
              jsonb_build_object('collab_id', new.id), 'review_available:' || new.id)
      on conflict (user_id, dedupe_key) do nothing;
    end if;
    if v_creator_user is not null then
      insert into public.notifications (user_id, type, title, body, payload, dedupe_key)
      values (v_creator_user, 'review_available', 'You can now review this collaboration',
              'Reviews reveal once you both submit, or after 7 days.',
              jsonb_build_object('collab_id', new.id), 'review_available:' || new.id)
      on conflict (user_id, dedupe_key) do nothing;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_review_available on public.collabs;
create trigger trg_notify_review_available after update of status on public.collabs
  for each row execute function public.notify_review_available();

-- ── 5. RLS: author always; everyone else only once revealed ─────────────────
drop policy if exists "review_public_read" on public.reviews;
drop policy if exists "review_reveal_read" on public.reviews;
drop function if exists public.review_is_revealed(uuid, text, timestamptz);
create policy "review_reveal_read" on public.reviews for select
  using (reviewer_id = auth.uid() or revealed_at is not null);

-- ── 6. Insert eligibility: completed paid OR completed barter (agreed_rate=0) ─
drop policy if exists "review_insert" on public.reviews;
create policy "review_insert" on public.reviews for insert
  with check (
    auth.uid() = reviewer_id
    and exists (
      select 1 from public.collabs c
      where c.id = reviews.collab_id
        and c.status = 'completed'
        and (c.payment_status in ('paid', 'manual_exception') or c.agreed_rate = 0)
        and (
          (reviews.reviewer_type = 'brand'
            and c.brand_id in (select bp.id from public.brand_profiles bp where bp.user_id = auth.uid()))
          or
          (reviews.reviewer_type = 'creator'
            and c.creator_id in (select cp.id from public.creator_profiles cp where cp.user_id = auth.uid()))
        )
    )
  );

-- ── 7. Grants - public reputation readable; recompute internal-only ──────────
grant select (rating_avg, rating_count) on table public.brand_profiles to anon, authenticated;
revoke all on function public.recompute_creator_rating(uuid) from public, anon, authenticated;
revoke all on function public.recompute_brand_rating(uuid)   from public, anon, authenticated;
revoke all on function public.recompute_all_ratings()        from public, anon, authenticated;
grant execute on function public.recompute_all_ratings() to service_role;

-- ── 8. Backfill aggregates from revealed reviews ────────────────────────────
select public.recompute_all_ratings();
