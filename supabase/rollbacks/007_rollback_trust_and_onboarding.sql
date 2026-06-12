-- Rollback for Phase 5: trust and onboarding.
-- Restores the pre-phase schema. Migrated social_accounts rows are dropped
-- (the legacy creator_profiles.platforms jsonb was never modified) and the
-- original free-text brand industries are restored from the backup table.

drop function if exists public.user_email_verified(uuid);

-- Restore original brand industries, then drop the constraint and backup.
update public.brand_profiles bp
set industry = b.industry
from public._phase5_brand_industry_backup b
where b.brand_profile_id = bp.id;

alter table public.brand_profiles
  drop constraint if exists brand_profiles_industry_valid;

drop table if exists public._phase5_brand_industry_backup;

alter table public.brand_profiles
  drop column if exists onboarding_completed_at,
  drop column if exists social_url;

alter table public.creator_profiles
  drop column if exists onboarding_completed_at,
  drop column if exists niche;

drop trigger if exists social_accounts_set_updated_at on public.social_accounts;
drop function if exists public.set_social_accounts_updated_at();
drop table if exists public.social_accounts;
