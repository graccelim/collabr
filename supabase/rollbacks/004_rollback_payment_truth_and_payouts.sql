-- Rollback for Phase 2 payment truth and Stripe Connect payout protections.
--
-- IMPORTANT:
-- - Run this rollback before rolling back Phase 1B (003) or Phase 1A (002).
-- - Deploy application code that no longer depends on the Phase 2 fields and
--   finalize_paid_collab function before running this rollback.
--
-- WARNING: This rollback removes explicit payment truth, webhook deduplication,
-- Stripe transfer/refund tracking, and exactly-once completion accounting.
-- After rollback, PaymentIntent existence may again be mistaken for funded
-- escrow, creators may not receive tracked payouts, duplicate completion/stat
-- increments may occur, and payment failures/refunds may become untraceable.
--
-- DATA RISK:
-- Dropping the Phase 2 columns permanently deletes recorded payment states,
-- Stripe transfer/refund IDs, failure reasons, settlement timestamps, and the
-- exactly-once completion marker. Dropping stripe_events deletes the webhook
-- processing audit/deduplication history. This rollback does not reverse Stripe
-- captures, transfers, refunds, or cancellations that already occurred.

begin;

-- Remove the exactly-once paid-collab completion function before dropping the
-- columns it references.
drop function if exists public.finalize_paid_collab(uuid, integer);

-- Remove webhook audit and deduplication state.
drop table if exists public.stripe_events;

-- Remove constraints that depend on Phase 2 payment fields.
alter table public.collabs
  drop constraint if exists collabs_completed_requires_settled_payment,
  drop constraint if exists collabs_paid_requires_transfer;

-- Remove unique Stripe identifier indexes before dropping their columns.
drop index if exists public.collabs_stripe_payment_intent_id_unique;
drop index if exists public.collabs_stripe_transfer_id_unique;
drop index if exists public.collabs_stripe_refund_id_unique;

-- Remove explicit payment truth and payout/refund tracking fields.
alter table public.collabs
  drop column if exists payment_status,
  drop column if exists stripe_transfer_id,
  drop column if exists stripe_refund_id,
  drop column if exists payment_failure_reason,
  drop column if exists funded_at,
  drop column if exists captured_at,
  drop column if exists paid_at,
  drop column if exists refunded_at,
  drop column if exists completion_accounted_at;

commit;
