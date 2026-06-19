-- 029: creator-never-connects payout fallback + creator self-withdraw.
--
-- 1) Payout-stuck tracking on collabs. A paid collab whose work is approved but
--    whose creator never finished Stripe Connect lands in payment_status
--    'transfer_failed' (money captured, held by the platform, NOT transferred).
--    We never auto-lose or auto-release those funds — instead we remind the
--    creator, then escalate to a manual support-review state after a grace
--    period. These columns drive that lifecycle without inventing a new
--    payment_status (so none of the existing status filters/constraints move):
--      • payout_reminded_at — last "connect your payouts" reminder (throttle)
--      • payout_review_at   — when escalated to manual support review (also the
--                             idempotency guard + the "support is on it" flag)
alter table public.collabs
  add column if not exists payout_reminded_at timestamptz,
  add column if not exists payout_review_at  timestamptz;

-- Split-dispute audit trail. On a split resolution we capture only the creator's
-- agreed share; Stripe releases the uncaptured remainder back to the brand
-- atomically as part of that capture call (not a deferred auto-void). We verify
-- that release happened and record the released cents here for a clean,
-- at-a-glance audit independent of Stripe's dashboard.
alter table public.collabs
  add column if not exists dispute_released_cents integer;

-- Fast scan for the payout-stuck cron: still-unpaid transfer_failed collabs.
create index if not exists collabs_transfer_failed_idx
  on public.collabs (captured_at)
  where payment_status = 'transfer_failed';

-- 2) Creator self-withdraw. A creator may withdraw their own application while
--    it is still open (pending/shortlisted). 'withdrawn' is terminal and, like a
--    rejection, keeps the (campaign_id, creator_id) row so it cannot be used to
--    spam re-applications. Distinct from 'rejected' so the two are auditable.
alter table public.applications drop constraint if exists applications_status_check;
alter table public.applications
  add constraint applications_status_check
  check (status in ('pending','shortlisted','selected','rejected','withdrawn'));
