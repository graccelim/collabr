-- ============================================================================
-- 042: Campaign analytics completion. Adds trend + connected-coverage + AI recap
-- to campaign_rollups, and indexes the post→collab link. Additive; brand-owner
-- RLS on campaign_rollups (from 039) is unchanged.
-- ============================================================================

alter table public.campaign_rollups
  add column if not exists trends jsonb,          -- views/engagement over snapshot dates
  add column if not exists coverage jsonb,        -- {creatorsTotal, creatorsConnected, unlinked:[...]}
  add column if not exists ai_recap jsonb,        -- AI campaign recap (brand-readable)
  add column if not exists ai_recap_hash text;    -- skip recap regen when metrics unchanged

-- The post→collab link drives campaign rollups; index for the join.
create index if not exists idx_content_posts_collab on public.content_posts(collab_id)
  where collab_id is not null;
