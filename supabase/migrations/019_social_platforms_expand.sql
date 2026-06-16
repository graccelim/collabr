-- ============================================================================
-- Phase 19 - Expand social platforms (beta trust model)
--
-- Adds X, Lemon8 and Xiaohongshu (RED) to the allowed social platforms so
-- creators can list every profile brands actually check. Handles/URLs are still
-- creator-provided; this migration does NOT add or imply any ownership
-- verification (the bio-code verification concept is retired in the app layer;
-- its dormant columns from 015 are left in place for a clean, reversible drop
-- later).
-- ============================================================================

alter table public.social_accounts
  drop constraint if exists social_accounts_platform_check;

alter table public.social_accounts
  add constraint social_accounts_platform_check
  check (platform in ('instagram','tiktok','youtube','x','lemon8','xiaohongshu'));

-- ── Rollback ────────────────────────────────────────────────────────────────
-- alter table public.social_accounts drop constraint if exists social_accounts_platform_check;
-- alter table public.social_accounts add constraint social_accounts_platform_check
--   check (platform in ('instagram','tiktok','youtube'));
