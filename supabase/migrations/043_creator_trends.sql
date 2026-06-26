-- ============================================================================
-- 043: Creator historical trend for the Insights "Performance Overview". Additive
-- (mirrors campaign_rollups.trends). Filled by the nightly rollups cron from
-- post_snapshots; null until data exists. No behaviour change without the suite.
-- ============================================================================

alter table public.creator_rollups
  add column if not exists trends jsonb;   -- [{date, views}] over snapshot dates
