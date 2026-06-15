-- ============================================================================
-- Phase 20 — Brand location
--
-- Brings brand_profiles to parity with creator_profiles: a free-text location
-- (e.g. a restaurant's city / neighbourhood) shown on the public brand profile.
-- Mirrors the creator location column + grants from migration 008.
-- ============================================================================

alter table public.brand_profiles
  add column if not exists location text
    check (location is null or char_length(location) <= 120);

-- Column-level grants (brand_profiles uses explicit column grants, see 008).
grant select (location) on table public.brand_profiles to anon, authenticated;
grant update (location) on table public.brand_profiles to authenticated;

-- ── Rollback ────────────────────────────────────────────────────────────────
-- alter table public.brand_profiles drop column if exists location;
