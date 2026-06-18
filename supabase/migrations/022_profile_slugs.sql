-- 022_profile_slugs.sql
-- SEO-friendly slugs for public brand / creator / campaign URLs.
-- The UUID stays the primary key; `slug` is a human-readable, unique alias used
-- in shareable links (e.g. /brands/acme-coffee, /creators/girldevours).

alter table public.brand_profiles   add column if not exists slug text;
alter table public.creator_profiles add column if not exists slug text;
alter table public.campaigns         add column if not exists slug text;

-- Unique where set (rows backfill their slug lazily in the app; collisions are
-- resolved with -2, -3, ... before insert/update).
create unique index if not exists brand_profiles_slug_key   on public.brand_profiles   (slug) where slug is not null;
create unique index if not exists creator_profiles_slug_key on public.creator_profiles (slug) where slug is not null;
create unique index if not exists campaigns_slug_key        on public.campaigns         (slug) where slug is not null;

-- brand_profiles / creator_profiles use column-level grants (migration 003), so
-- the new column must be granted explicitly for anon (public) reads. campaigns
-- has a table-level grant and needs none.
grant select (slug) on table public.brand_profiles   to anon, authenticated;
grant select (slug) on table public.creator_profiles to anon, authenticated;
