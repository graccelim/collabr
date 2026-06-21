-- 034: money-safety hardening — settlement claim + transfer-reversal state.

-- 1) DB-level settlement claim. A short-lived lease so confirm-live,
--    auto-release, payout-retry and the account.updated webhook can't all reach
--    stripe.transfers.create concurrently. Time-boxed (re-claimable after the
--    lease expires) so a crashed settler is still recoverable; the Stripe
--    idempotency key remains the second line of defence on that retry.
alter table public.collabs
  add column if not exists settlement_claimed_at timestamptz;

-- 2) Distinct 'transfer_reversed' payment state. A reversal of an already-paid
--    transfer must NOT masquerade as a normal retryable 'transfer_failed' (the
--    payout-stuck cron would loop on it forever) — it needs manual review.
alter table public.collabs drop constraint if exists collabs_payment_status_check;
alter table public.collabs
  add constraint collabs_payment_status_check check (payment_status in (
    'unfunded','authorizing','funded','capture_pending','captured',
    'transfer_pending','paid','capture_failed','transfer_failed','transfer_reversed',
    'refund_pending','refund_failed','refunded','cancelled','manual_exception'
  ));

-- A completed collab may now also legitimately sit in 'transfer_reversed'
-- (work was done, payout was clawed back, support is reconciling).
alter table public.collabs drop constraint if exists collabs_completed_requires_settled_payment;
alter table public.collabs
  add constraint collabs_completed_requires_settled_payment check (
    status <> 'completed'
    or payment_status in (
      'paid','manual_exception','transfer_failed','transfer_reversed',
      'refund_pending','refund_failed','refunded'
    )
  ) not valid;
