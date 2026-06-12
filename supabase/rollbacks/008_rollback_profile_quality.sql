-- Rollback for Phase 6: profile quality.
-- average_rate_sgd was backfilled FROM base_rate (base_rate itself was never
-- modified), so dropping the new columns loses no original data.

drop policy if exists "avatar_owner_insert" on storage.objects;
drop policy if exists "avatar_owner_update" on storage.objects;
drop policy if exists "avatar_owner_delete" on storage.objects;
delete from storage.objects where bucket_id = 'avatars';
delete from storage.buckets where id = 'avatars';

drop trigger if exists campaigns_sync_completed_count on public.campaigns;
drop function if exists public.sync_brand_completed_campaigns();

alter table public.brand_profiles
  drop column if exists completed_campaigns,
  drop column if exists company_description;

alter table public.creator_profiles
  drop column if exists availability_status,
  drop column if exists average_rate_sgd,
  drop column if exists media_kit_url,
  drop column if exists portfolio_links,
  drop column if exists location;
