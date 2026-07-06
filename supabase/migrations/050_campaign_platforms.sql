-- ============================================================================
-- Campaign platform targeting. The post-job and edit-campaign forms have always
-- collected "Platforms" but the API silently dropped it (no column existed) —
-- brands believed they were targeting platforms and creators never saw it.
-- Stores CANONICAL slugs (must match SOCIAL_PLATFORMS in lib/onboarding.ts);
-- the UI renders labels via SOCIAL_LABELS. Empty array = all platforms welcome.
--
-- No RLS change: campaigns' existing policies cover the new column (public
-- read of active campaigns via admin client; writes are server-route only).
-- ============================================================================

alter table public.campaigns
  add column if not exists platforms text[] not null default '{}';

alter table public.campaigns
  add constraint campaigns_platforms_allowed
  check (
    platforms <@ array['instagram','tiktok','youtube','facebook','x','lemon8','xiaohongshu']::text[]
    and coalesce(array_length(platforms, 1), 0) <= 7
  );
