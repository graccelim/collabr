-- Rollback for 050_campaign_platforms.sql. Non-destructive beyond the column
-- itself (platform targeting is additive; no other data depends on it).

alter table public.campaigns
  drop constraint if exists campaigns_platforms_allowed;

alter table public.campaigns
  drop column if exists platforms;
