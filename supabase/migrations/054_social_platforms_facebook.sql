-- ============================================================================
-- Phase 54 - Add 'facebook' to the social_accounts platform constraint
--
-- lib/onboarding.ts's SOCIAL_PLATFORMS has included 'facebook' since before
-- this migration, but 019_social_platforms_expand.sql's check constraint was
-- never updated to match - any attempt to store a facebook social account
-- would fail the DB constraint despite the UI/type system allowing it. Pure
-- bugfix, found while building the /join creator-lookup flow (which searches
-- social_accounts by platform + handle and needs the constraint to actually
-- match what the app already claims to support).
-- ============================================================================

alter table public.social_accounts
  drop constraint if exists social_accounts_platform_check;

alter table public.social_accounts
  add constraint social_accounts_platform_check
  check (platform in ('instagram','tiktok','youtube','facebook','x','lemon8','xiaohongshu'));
