-- ============================================================================
-- 038: Creator Pro 💎 subscription state (Phase 2 — additive, behind the
-- `creator_pro` feature flag; safe no-op until the flag + Stripe prices exist).
--
-- SECURITY NOTE (deviation from the plan): the plan suggested pro_* columns on
-- creator_profiles, but that table is PUBLIC-READ — so Stripe customer/subscription
-- IDs would leak. Instead, subscription state lives in this CREATOR-PRIVATE table
-- (mirrors creator_scores / collabr_certification: owner-read, service-write).
-- The earn/freeze DECISION is the pure tested engine in lib/entitlements.ts.
--
-- Expiry = FREEZE, never delete: status flips to 'canceled'/'expired' and access
-- stops, but history (Phase-3 analytics) is retained and resumes on renewal.
--
-- Does NOT touch payments/escrow/disputes/reviews/onboarding/creator_scores/
-- collabr_certification.
-- ============================================================================

create table if not exists public.creator_subscriptions (
  creator_id              uuid primary key references public.creator_profiles(id) on delete cascade,
  status                  text not null default 'none'
                          check (status in ('none','trialing','active','past_due','canceled','expired')),
  pro_until               timestamptz,            -- access end; sync/studio freeze after this
  current_period_end      timestamptz,
  cancel_at_period_end    boolean not null default false,
  -- Sensitive — only ever here (never on the public profile row).
  stripe_customer_id      text,
  stripe_subscription_id  text,
  price_id                text,
  updated_at              timestamptz not null default now(),
  created_at              timestamptz not null default now()
);
alter table public.creator_subscriptions enable row level security;

-- Own-row read only. Entitlement checks (connect/sync/studio/AI gating) read via
-- the service role server-side; the creator reads their own row for billing UI.
drop policy if exists "creator_subscription_owner_read" on public.creator_subscriptions;
create policy "creator_subscription_owner_read" on public.creator_subscriptions for select
  using (creator_id in (select id from public.creator_profiles where user_id = auth.uid()));
-- Writes: service role only (Stripe webhook / checkout callback). No client write policy.
revoke all on table public.creator_subscriptions from anon, authenticated;
grant select on table public.creator_subscriptions to authenticated;

create index if not exists idx_creator_subscriptions_stripe_sub
  on public.creator_subscriptions(stripe_subscription_id);
