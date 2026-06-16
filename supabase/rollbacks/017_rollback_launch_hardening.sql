-- Rollback Phase 17 - Pre-launch hardening
-- Restores the prior (less safe) grants/behaviour. Run only to undo 017.

-- 1. Re-expose total_earned (NOT recommended - restores the privacy leak)
grant select (total_earned) on table public.creator_profiles to anon, authenticated;

-- 2. Drop the niche_tags cap (restore pre-017 validation function)
create or replace function public.enforce_niche_tags()
returns trigger language plpgsql as $$
declare bad text;
begin
  if new.niche_tags is null then new.niche_tags := '{}'; end if;
  new.niche_tags := (select coalesce(array_agg(distinct t), '{}') from unnest(new.niche_tags) t);
  select t into bad
    from unnest(new.niche_tags) t
    where t not in (select slug from public.niches where is_active)
    limit 1;
  if bad is not null then
    raise exception 'Invalid niche slug: %', bad using errcode = '23514';
  end if;
  return new;
end $$;

-- 3. Re-grant verification_code to authenticated
grant select (verification_code, verification_code_expires_at)
  on table public.social_accounts to authenticated;

-- 4. Drop boost_purchases
drop table if exists public.boost_purchases;

-- 5. Remove avatars storage policies (bucket left in place to avoid orphaning files)
drop policy if exists "avatars_public_read" on storage.objects;
drop policy if exists "avatars_owner_insert" on storage.objects;
drop policy if exists "avatars_owner_update" on storage.objects;
drop policy if exists "avatars_owner_delete" on storage.objects;
