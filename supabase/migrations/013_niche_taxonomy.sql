-- ============================================================================
-- Phase 13 - Shared niche taxonomy (Discovery Foundation)
--
-- One canonical vocabulary for BOTH creators and campaigns so matching is
-- reliable. Free text ("F&B", "Food & Beverage", "fnb", "restaurant", "cafe")
-- folds onto a canonical slug via `niche_aliases`. Mirrors lib/niches.ts.
-- ============================================================================

-- ── Canonical niches ────────────────────────────────────────────────────────
create table if not exists public.niches (
  slug        text primary key,
  label       text not null,
  parent_slug text references public.niches(slug),
  sort_order  int  not null default 0,
  is_active   boolean not null default true
);
alter table public.niches enable row level security;
drop policy if exists "niches_read" on public.niches;
create policy "niches_read" on public.niches for select using (true);

insert into public.niches (slug, label, sort_order) values
  ('food','Food',1), ('lifestyle','Lifestyle',2), ('travel','Travel',3),
  ('fashion','Fashion',4), ('beauty','Beauty',5), ('fitness','Fitness',6),
  ('tech','Tech',7), ('parenting','Parenting',8), ('business','Business',9),
  ('gaming','Gaming',10), ('education','Education',11), ('other','Other',99)
on conflict (slug) do nothing;

-- ── Aliases (free text → canonical slug) ────────────────────────────────────
create table if not exists public.niche_aliases (
  alias text primary key,
  slug  text not null references public.niches(slug) on delete cascade
);
alter table public.niche_aliases enable row level security;
drop policy if exists "niche_aliases_read" on public.niche_aliases;
create policy "niche_aliases_read" on public.niche_aliases for select using (true);

insert into public.niche_aliases (alias, slug) values
  ('f&b','food'),('fnb','food'),('f & b','food'),('food & beverage','food'),
  ('food and beverage','food'),('food&beverage','food'),('restaurant','food'),
  ('restaurants','food'),('cafe','food'),('cafes','food'),('coffee','food'),
  ('dining','food'),('foodie','food'),('culinary','food'),('cooking','food'),
  ('recipe','food'),('recipes','food'),('bakery','food'),('dessert','food'),
  ('skincare','beauty'),('skin care','beauty'),('makeup','beauty'),('make up','beauty'),
  ('cosmetics','beauty'),('cosmetic','beauty'),('haircare','beauty'),('hair','beauty'),
  ('nails','beauty'),('grooming','beauty'),
  ('style','fashion'),('apparel','fashion'),('clothing','fashion'),('streetwear','fashion'),
  ('outfit','fashion'),('ootd','fashion'),('accessories','fashion'),('retail','fashion'),
  ('gym','fitness'),('workout','fitness'),('health','fitness'),('wellness','fitness'),
  ('yoga','fitness'),('sports','fitness'),('nutrition','fitness'),('healthcare','fitness'),
  ('tourism','travel'),('hospitality','travel'),('hotel','travel'),('hotels','travel'),
  ('staycation','travel'),('adventure','travel'),('destination','travel'),
  ('technology','tech'),('gadgets','tech'),('gadget','tech'),('saas','tech'),
  ('software','tech'),('apps','tech'),('app','tech'),('ai','tech'),('electronics','tech'),
  ('startup','tech'),
  ('games','gaming'),('game','gaming'),('esports','gaming'),('streamer','gaming'),('twitch','gaming'),
  ('parent','parenting'),('family','parenting'),('kids','parenting'),('mom','parenting'),
  ('mum','parenting'),('baby','parenting'),('children','parenting'),
  ('finance','business'),('fintech','business'),('entrepreneur','business'),
  ('entrepreneurship','business'),('marketing','business'),('career','business'),('money','business'),
  ('learning','education'),('edtech','education'),('tutoring','education'),('study','education'),
  ('language','education'),('courses','education'),
  ('life','lifestyle'),('vlog','lifestyle'),('vlogging','lifestyle'),('daily','lifestyle'),
  ('home','lifestyle'),('decor','lifestyle'),('interior','lifestyle'),('pets','lifestyle'),
  ('photography','lifestyle'),
  ('misc','other'),('general','other')
on conflict (alias) do nothing;

-- ── Creator multi-niche ─────────────────────────────────────────────────────
alter table public.creator_profiles
  add column if not exists niche_tags text[] not null default '{}';

-- Primary niche (single) backfills the first tag; existing data preserved.
update public.creator_profiles
  set niche_tags = array[niche]
  where niche is not null and coalesce(array_length(niche_tags, 1), 0) = 0;

grant select (niche_tags) on table public.creator_profiles to anon, authenticated;
grant update (niche_tags) on table public.creator_profiles to authenticated;

-- ── Validation: niche_tags must be active canonical slugs ───────────────────
create or replace function public.enforce_niche_tags()
returns trigger language plpgsql as $$
declare bad text;
begin
  if new.niche_tags is null then new.niche_tags := '{}'; end if;
  -- dedupe
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

-- ── Normalize existing campaign niche_tags (with backup) ────────────────────
create table if not exists public._phase13_campaign_niche_backup as
  select id, niche_tags from public.campaigns;

update public.campaigns c set niche_tags = sub.tags
from (
  select c2.id,
         coalesce(array_agg(distinct m.slug) filter (where m.slug is not null), '{}') as tags
  from public.campaigns c2
  left join lateral unnest(coalesce(c2.niche_tags, '{}')) as t(tag) on true
  left join lateral (
    select coalesce(
      (select a.slug from public.niche_aliases a where a.alias = lower(trim(t.tag))),
      (select n.slug from public.niches n where n.slug = lower(trim(t.tag)) and n.is_active)
    ) as slug
  ) m on true
  group by c2.id
) sub
where c.id = sub.id;

-- Triggers AFTER normalization so existing rows already pass.
drop trigger if exists trg_creator_niche_tags on public.creator_profiles;
create trigger trg_creator_niche_tags before insert or update of niche_tags
  on public.creator_profiles for each row execute function public.enforce_niche_tags();

drop trigger if exists trg_campaign_niche_tags on public.campaigns;
create trigger trg_campaign_niche_tags before insert or update of niche_tags
  on public.campaigns for each row execute function public.enforce_niche_tags();

create index if not exists idx_creator_niche_tags on public.creator_profiles using gin (niche_tags);
create index if not exists idx_campaigns_niche_tags on public.campaigns using gin (niche_tags);
