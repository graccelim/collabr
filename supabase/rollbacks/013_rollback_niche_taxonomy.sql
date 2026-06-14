-- Rollback Phase 13 — niche taxonomy
drop trigger if exists trg_campaign_niche_tags on public.campaigns;
drop trigger if exists trg_creator_niche_tags on public.creator_profiles;
drop function if exists public.enforce_niche_tags();

-- Restore original free-text campaign tags.
update public.campaigns c set niche_tags = b.niche_tags
  from public._phase13_campaign_niche_backup b where c.id = b.id;
drop table if exists public._phase13_campaign_niche_backup;

drop index if exists public.idx_campaigns_niche_tags;
drop index if exists public.idx_creator_niche_tags;
alter table public.creator_profiles drop column if exists niche_tags;

drop table if exists public.niche_aliases;
drop table if exists public.niches;
