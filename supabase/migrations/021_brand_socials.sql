-- ============================================================================
-- Phase 21 - Brand social profiles (multiple, with a primary)
--
-- Brings brands to parity with creators: instead of a single free-text
-- social_url, a brand can list several social profiles (platform + handle,
-- with one marked primary). Stored as a small JSON array on the brand profile -
-- entries look like { platform, handle, url, is_primary, follower_count }.
-- The legacy social_url is still written (the primary's url) for compatibility.
-- ============================================================================

alter table public.brand_profiles
  add column if not exists socials jsonb not null default '[]'::jsonb;

-- Column-level grants (brand_profiles uses explicit column grants, see 008).
grant select (socials) on table public.brand_profiles to anon, authenticated;
grant update (socials) on table public.brand_profiles to authenticated;

-- ── Rollback ────────────────────────────────────────────────────────────────
-- alter table public.brand_profiles drop column if exists socials;
