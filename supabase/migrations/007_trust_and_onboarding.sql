-- Phase 5: trust and onboarding.
-- Normalized social accounts, required creator/brand onboarding, email
-- verification trust signal, and duplicate-handle prevention.
--
-- Existing creators and brands are migrated in place: platforms jsonb becomes
-- social_accounts rows, free-text niches/industries are mapped onto the
-- constrained vocabularies, and accounts that already satisfy onboarding
-- requirements are marked complete so they are not locked out.

-- ─── SOCIAL ACCOUNTS ─────────────────────────────────────────────────────────
-- Handles are stored normalized: lowercase, trimmed, no leading '@'.
create table public.social_accounts (
  id                   uuid primary key default gen_random_uuid(),
  creator_id           uuid not null references public.creator_profiles(id) on delete cascade,
  platform             text not null check (platform in ('instagram','tiktok','youtube')),
  handle               text not null check (handle ~ '^[a-z0-9._-]{1,64}$'),
  url                  text not null,
  follower_count       integer check (follower_count >= 0),
  verification_status  text not null default 'unverified'
                       check (verification_status in ('unverified','pending','verified')),
  is_primary           boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- A handle can exist once per platform across the whole marketplace. This is
-- the duplicate-social-handle spam protection.
create unique index social_accounts_platform_handle_unique
  on public.social_accounts(platform, handle);

-- At most one primary account per creator.
create unique index social_accounts_one_primary_per_creator
  on public.social_accounts(creator_id)
  where is_primary;

create index idx_social_accounts_creator on public.social_accounts(creator_id);

create or replace function public.set_social_accounts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger social_accounts_set_updated_at
  before update on public.social_accounts
  for each row execute function public.set_social_accounts_updated_at();

-- Socials are public trust signals; mutations go through server routes with
-- the service role (verification_status must never be client-settable).
alter table public.social_accounts enable row level security;
create policy "social_accounts_public_select" on public.social_accounts for select
  using (true);
revoke all on table public.social_accounts from anon, authenticated;
grant select on table public.social_accounts to anon, authenticated;

-- ─── ONBOARDING COLUMNS ──────────────────────────────────────────────────────
alter table public.creator_profiles
  add column niche text
    check (niche in (
      'food','lifestyle','travel','fashion','beauty','fitness','tech',
      'parenting','business','gaming','education','other'
    )),
  add column onboarding_completed_at timestamptz;

alter table public.brand_profiles
  add column social_url text,
  add column onboarding_completed_at timestamptz;

-- Owners may update their niche directly (value list enforced by the check
-- constraint). onboarding_completed_at stays service-role only.
grant update (niche) on table public.creator_profiles to authenticated;
grant select (niche, onboarding_completed_at) on table public.creator_profiles to anon, authenticated;
grant update (social_url) on table public.brand_profiles to authenticated;
grant select (social_url, onboarding_completed_at) on table public.brand_profiles to anon, authenticated;

-- ─── MIGRATE EXISTING CREATOR DATA ───────────────────────────────────────────
-- platforms jsonb → social_accounts. Invalid or duplicate handles are skipped
-- (first creator keeps the handle), the legacy jsonb is left untouched.
insert into public.social_accounts (creator_id, platform, handle, url, follower_count)
select
  cp.id,
  p.platform,
  h.handle,
  case p.platform
    when 'instagram' then 'https://instagram.com/' || h.handle
    when 'tiktok'    then 'https://tiktok.com/@' || h.handle
    when 'youtube'   then 'https://youtube.com/@' || h.handle
  end,
  case
    when p.info->>'followers' ~ '^[0-9]{1,9}$' then (p.info->>'followers')::integer
  end
from public.creator_profiles cp
cross join lateral jsonb_each(coalesce(cp.platforms, '{}'::jsonb)) as p(platform, info)
cross join lateral (
  select lower(regexp_replace(btrim(coalesce(p.info->>'handle', '')), '^@+', '')) as handle
) h
where p.platform in ('instagram','tiktok','youtube')
  and h.handle ~ '^[a-z0-9._-]{1,64}$'
on conflict do nothing;

-- Mark one primary account per creator (largest following first).
with ranked as (
  select id,
         row_number() over (
           partition by creator_id
           order by follower_count desc nulls last, created_at, id
         ) as rn
  from public.social_accounts
)
update public.social_accounts sa
set is_primary = true
from ranked
where ranked.id = sa.id and ranked.rn = 1;

-- niches[] (legacy capitalized free text) → niche. First mappable entry wins;
-- a non-empty array with no mapping falls back to 'other'.
update public.creator_profiles cp
set niche = coalesce(
  (
    select m.mapped
    from unnest(cp.niches) with ordinality as n(val, ord)
    join (values
      ('food','food'), ('beauty','beauty'), ('fashion','fashion'),
      ('lifestyle','lifestyle'), ('wellness','fitness'), ('fitness','fitness'),
      ('travel','travel'), ('tech','tech'), ('home','lifestyle'),
      ('parenting','parenting'), ('gaming','gaming'), ('business','business'),
      ('education','education')
    ) as m(src, mapped) on lower(n.val) = m.src
    order by n.ord
    limit 1
  ),
  'other'
)
where cp.niche is null
  and cp.niches is not null
  and array_length(cp.niches, 1) > 0;

-- ─── MIGRATE EXISTING BRAND DATA ─────────────────────────────────────────────
-- Keep the original free-text industries so the rollback can restore them.
create table public._phase5_brand_industry_backup (
  brand_profile_id uuid primary key,
  industry text
);
alter table public._phase5_brand_industry_backup enable row level security;
revoke all on table public._phase5_brand_industry_backup from anon, authenticated;

insert into public._phase5_brand_industry_backup (brand_profile_id, industry)
select id, industry from public.brand_profiles where industry is not null;

update public.brand_profiles
set industry = case
  when industry is null then null
  when lower(industry) in (
    'fnb','retail','beauty','fashion','technology','travel','hospitality',
    'finance','education','healthcare','other'
  ) then lower(industry)
  when industry = 'Beauty & Personal Care'  then 'beauty'
  when industry = 'Fashion & Apparel'       then 'fashion'
  when industry = 'Food & Beverage'         then 'fnb'
  when industry = 'Health & Wellness'       then 'healthcare'
  when industry = 'Technology'              then 'technology'
  when industry = 'Travel & Hospitality'    then 'travel'
  when industry = 'Education'               then 'education'
  when industry = 'Finance'                 then 'finance'
  else 'other'
end;

alter table public.brand_profiles
  add constraint brand_profiles_industry_valid check (
    industry is null or industry in (
      'fnb','retail','beauty','fashion','technology','travel','hospitality',
      'finance','education','healthcare','other'
    )
  );

-- ─── BACKFILL ONBOARDING COMPLETION ──────────────────────────────────────────
-- Accounts that already satisfy the new requirements are grandfathered in;
-- everyone else must complete onboarding before applying / posting campaigns.
update public.creator_profiles cp
set onboarding_completed_at = now()
where cp.onboarding_completed_at is null
  and cp.niche is not null
  and exists (select 1 from public.social_accounts sa where sa.creator_id = cp.id);

update public.brand_profiles bp
set onboarding_completed_at = now()
where bp.onboarding_completed_at is null
  and coalesce(btrim(bp.company_name), '') <> ''
  and bp.industry is not null
  and (bp.website is not null or bp.social_url is not null);

-- ─── EMAIL VERIFICATION TRUST SIGNAL ─────────────────────────────────────────
-- Lets authenticated pages show "email verified" for any user without exposing
-- auth.users. Enforcement happens server-side via auth.getUser().
create or replace function public.user_email_verified(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from auth.users u
    where u.id = p_user_id and u.email_confirmed_at is not null
  );
$$;

revoke all on function public.user_email_verified(uuid) from public, anon;
grant execute on function public.user_email_verified(uuid) to authenticated, service_role;
