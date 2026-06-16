-- ============================================================================
-- Phase 17 - Pre-launch hardening
--
-- Closes the red-team findings that need DB enforcement:
--   1. total_earned must never be world-readable        (privacy leak)
--   2. niche_tags must be capped so creators can't spam every category (ranking)
--   3. verification_code must not be readable by clients (verification privacy)
--   4. boost_purchases - idempotent record of PAID boost activations (Stripe)
--   5. avatars storage bucket + owner-scoped policies     (storage hardening)
-- ============================================================================

-- ── 1. Stop leaking lifetime earnings ───────────────────────────────────────
-- total_earned was granted to anon/authenticated in migration 003 and, combined
-- with the public `creator_public_select using(true)` policy, was world-readable.
-- The app reads earnings for the owner / admin via the service role, so no
-- client role needs column access.
revoke select (total_earned) on table public.creator_profiles from anon, authenticated;

-- ── 2. Cap niche_tags (anti niche-stuffing) ─────────────────────────────────
-- A creator could write niche_tags directly (column update grant) and assign
-- every category to appear as a "Best Match" for all campaigns. Enforce a hard
-- cap at the DB level so neither the API nor a direct client write can bypass it.
create or replace function public.enforce_niche_tags()
returns trigger language plpgsql as $$
declare bad text;
begin
  if new.niche_tags is null then new.niche_tags := '{}'; end if;
  -- dedupe
  new.niche_tags := (select coalesce(array_agg(distinct t), '{}') from unnest(new.niche_tags) t);
  -- cap creators to a genuine multi-niche identity, not category spam
  if tg_table_name = 'creator_profiles' and cardinality(new.niche_tags) > 4 then
    raise exception 'A creator can have at most 4 niches' using errcode = '23514';
  end if;
  select t into bad
    from unnest(new.niche_tags) t
    where t not in (select slug from public.niches where is_active)
    limit 1;
  if bad is not null then
    raise exception 'Invalid niche slug: %', bad using errcode = '23514';
  end if;
  return new;
end $$;

-- ── 3. Verification code privacy ────────────────────────────────────────────
-- migration 015 granted verification_code to `authenticated`, making pending
-- codes readable by any logged-in user. Revoke; the OWNER reads their own code
-- through /api/socials (service-role, scoped to their own creator_id).
revoke select (verification_code, verification_code_expires_at)
  on table public.social_accounts from authenticated;

-- ── 3b. Webhook concurrency lock ────────────────────────────────────────────
-- stripe_events gets a claim timestamp so concurrent duplicate deliveries can't
-- both process the same event (see app/api/webhooks/stripe/route.ts).
alter table public.stripe_events add column if not exists locked_at timestamptz;

-- ── 4. Boost purchases (paid activation idempotency) ────────────────────────
-- Each paid boost = one Stripe Checkout session. The session id is the primary
-- key, so the webhook activates a boost at most once even on duplicate delivery.
create table if not exists public.boost_purchases (
  id           text primary key,          -- stripe checkout session id
  creator_id   uuid not null references public.creator_profiles(id) on delete cascade,
  boost_type   text not null check (boost_type in ('monthly','per_app')),
  days         int  not null,
  amount       int,                        -- cents charged (from Stripe)
  activated_at timestamptz not null default now()
);
alter table public.boost_purchases enable row level security;
-- Owner may read their own purchase history; writes are service-role only.
drop policy if exists "boost_purchases_owner_read" on public.boost_purchases;
create policy "boost_purchases_owner_read" on public.boost_purchases for select
  using (creator_id in (select id from public.creator_profiles where user_id = auth.uid()));
grant select (id, creator_id, boost_type, days, amount, activated_at)
  on table public.boost_purchases to authenticated;
create index if not exists idx_boost_purchases_creator on public.boost_purchases (creator_id, activated_at desc);

-- ── 5. Avatars storage bucket + owner policies ──────────────────────────────
-- Profile photos upload to `avatars` with path `<userId>-<ts>.<ext>`. Public
-- read (avatar URLs are public), but only the owning user may write/overwrite
-- their own object so user A cannot clobber user B's avatar.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_owner_insert" on storage.objects;
create policy "avatars_owner_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and name like auth.uid()::text || '-%');

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and name like auth.uid()::text || '-%')
  with check (bucket_id = 'avatars' and name like auth.uid()::text || '-%');

drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and name like auth.uid()::text || '-%');
