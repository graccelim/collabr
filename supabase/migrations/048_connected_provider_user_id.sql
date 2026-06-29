-- ============================================================================
-- Store the provider's app-scoped user id on each connected account, so Meta's
-- Deauthorize and Data Deletion callbacks (which identify the person by their
-- Meta/Facebook user id, not our Instagram business id) can find and purge the
-- right account. Also useful for TikTok/YouTube provider identity.
-- ============================================================================
alter table public.connected_accounts
  add column if not exists provider_user_id text;

create index if not exists connected_accounts_provider_user_id_idx
  on public.connected_accounts (provider_user_id);
