-- ============================================================================
-- 044: First-party (no-Phyllo) social integration. OAuth tokens for connected
-- accounts live in a PRIVATE, service-role-only table — never readable by the
-- creator (they are secrets). connected_accounts keeps the public-safe row
-- (platform/handle/status/last_synced); tokens are isolated here.
-- ============================================================================

create table if not exists public.connected_account_tokens (
  account_id     uuid primary key references public.connected_accounts(id) on delete cascade,
  access_token   text,
  refresh_token  text,
  expires_at     timestamptz,
  scope          text,
  updated_at     timestamptz not null default now()
);

alter table public.connected_account_tokens enable row level security;
-- Service-role ONLY. No anon/authenticated access of any kind (these are secrets).
revoke all on table public.connected_account_tokens from anon, authenticated;

-- 'source' now records the native platform integration instead of a vendor.
-- (Column already exists from 039 with default 'phyllo'; new rows use 'native'.)
