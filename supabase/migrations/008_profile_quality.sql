-- Phase 6: profile quality.
-- Richer creator/brand profiles, profile completion inputs, a maintained
-- completed-campaigns trust signal, and an avatars bucket for profile photos.
-- These columns are also the substrate for future Creator Discovery filters.

-- ─── CREATOR PROFILE FIELDS ──────────────────────────────────────────────────
-- average_rate_sgd is stored in cents like every other monetary column
-- (see lib/utils formatSGD). Backfilled from the legacy base_rate column,
-- which remains for backward compatibility until discovery is rebuilt.
alter table public.creator_profiles
  add column location text
    check (location is null or char_length(location) <= 120),
  add column portfolio_links text[] not null default '{}'
    check (coalesce(array_length(portfolio_links, 1), 0) <= 10),
  add column media_kit_url text
    check (media_kit_url is null or media_kit_url ~ '^https?://'),
  add column average_rate_sgd integer
    check (average_rate_sgd is null or average_rate_sgd >= 0),
  add column availability_status text not null default 'available'
    check (availability_status in ('available', 'limited', 'unavailable'));

update public.creator_profiles
set average_rate_sgd = base_rate
where base_rate is not null and base_rate > 0;

grant select (location, portfolio_links, media_kit_url, average_rate_sgd, availability_status)
  on table public.creator_profiles to anon, authenticated;
grant update (location, portfolio_links, media_kit_url, average_rate_sgd, availability_status, base_rate)
  on table public.creator_profiles to authenticated;

-- ─── BRAND PROFILE FIELDS ────────────────────────────────────────────────────
alter table public.brand_profiles
  add column company_description text
    check (company_description is null or char_length(company_description) <= 2000),
  add column completed_campaigns integer not null default 0
    check (completed_campaigns >= 0);

grant select (company_description, completed_campaigns)
  on table public.brand_profiles to anon, authenticated;
grant update (company_description)
  on table public.brand_profiles to authenticated;

-- completed_campaigns is a trust signal maintained by trigger, since campaign
-- status transitions happen through several paths (brand PATCH, admin).
create or replace function public.sync_brand_completed_campaigns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'completed' then
      update public.brand_profiles
      set completed_campaigns = completed_campaigns + 1
      where id = new.brand_id;
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if new.status = 'completed' and old.status is distinct from 'completed' then
      update public.brand_profiles
      set completed_campaigns = completed_campaigns + 1
      where id = new.brand_id;
    elsif old.status = 'completed' and new.status is distinct from 'completed' then
      update public.brand_profiles
      set completed_campaigns = greatest(completed_campaigns - 1, 0)
      where id = new.brand_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.status = 'completed' then
      update public.brand_profiles
      set completed_campaigns = greatest(completed_campaigns - 1, 0)
      where id = old.brand_id;
    end if;
    return old;
  end if;
  return null;
end;
$$;

create trigger campaigns_sync_completed_count
  after insert or update of status or delete on public.campaigns
  for each row execute function public.sync_brand_completed_campaigns();

-- Backfill from existing completed campaigns.
update public.brand_profiles bp
set completed_campaigns = sub.cnt
from (
  select brand_id, count(*)::integer as cnt
  from public.campaigns
  where status = 'completed' and brand_id is not null
  group by brand_id
) sub
where sub.brand_id = bp.id;

-- ─── AVATARS BUCKET ──────────────────────────────────────────────────────────
-- Public profile photos. Mutations restricted to files named
-- {user_id}-{timestamp}.{ext} by that authenticated user (mirrors the
-- brand-assets logo policy from Phase 4).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "avatar_owner_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and storage.filename(name) like auth.uid()::text || '-%'
  );

create policy "avatar_owner_update" on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and storage.filename(name) like auth.uid()::text || '-%'
  )
  with check (
    bucket_id = 'avatars'
    and storage.filename(name) like auth.uid()::text || '-%'
  );

create policy "avatar_owner_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and storage.filename(name) like auth.uid()::text || '-%'
  );
