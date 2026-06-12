-- Phase 2: explicit payment truth, Stripe Connect payouts, and exactly-once
-- completion accounting.
--
-- Existing PaymentIntent IDs are intentionally not treated as proof of funding.
-- Existing collabs start as `unfunded` and require reconciliation or a Stripe
-- webhook/state refresh before they can proceed through paid workflow actions.

alter table public.collabs
  add column payment_status text not null default 'unfunded'
    check (payment_status in (
      'unfunded',
      'authorizing',
      'funded',
      'capture_pending',
      'captured',
      'transfer_pending',
      'paid',
      'capture_failed',
      'transfer_failed',
      'refund_pending',
      'refund_failed',
      'refunded',
      'cancelled',
      'manual_exception'
    )),
  add column stripe_transfer_id text,
  add column stripe_refund_id text,
  add column payment_failure_reason text,
  add column funded_at timestamptz,
  add column captured_at timestamptz,
  add column paid_at timestamptz,
  add column refunded_at timestamptz,
  add column completion_accounted_at timestamptz;

create unique index collabs_stripe_payment_intent_id_unique
  on public.collabs(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create unique index collabs_stripe_transfer_id_unique
  on public.collabs(stripe_transfer_id)
  where stripe_transfer_id is not null;

create unique index collabs_stripe_refund_id_unique
  on public.collabs(stripe_refund_id)
  where stripe_refund_id is not null;

-- Do not validate historical rows automatically: existing completed collabs
-- require manual reconciliation. These checks still protect all new writes.
alter table public.collabs
  add constraint collabs_completed_requires_settled_payment
    check (
      status <> 'completed'
      or payment_status in (
        'paid', 'manual_exception', 'transfer_failed',
        'refund_pending', 'refund_failed', 'refunded'
      )
    )
    not valid,
  add constraint collabs_paid_requires_transfer
    check (payment_status <> 'paid' or stripe_transfer_id is not null)
    not valid;

create table public.stripe_events (
  id text primary key,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.stripe_events enable row level security;
revoke all on table public.stripe_events from anon, authenticated;

-- Completes and accounts for a paid collab exactly once. Service-role callers
-- must first verify Stripe capture and creator transfer success.
create or replace function public.finalize_paid_collab(
  p_collab_id uuid,
  p_creator_earned integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator_id uuid;
begin
  if p_creator_earned < 0 then
    raise exception 'Creator earned amount cannot be negative';
  end if;

  update public.collabs
  set
    status = 'completed',
    live_auto_release_at = null,
    completion_accounted_at = now()
  where id = p_collab_id
    and payment_status in ('paid', 'manual_exception')
    and completion_accounted_at is null
  returning creator_id into v_creator_id;

  if v_creator_id is null then
    return false;
  end if;

  update public.creator_profiles
  set
    collabs_completed = coalesce(collabs_completed, 0) + 1,
    total_earned = coalesce(total_earned, 0) + p_creator_earned
  where id = v_creator_id;

  return true;
end;
$$;

revoke all on function public.finalize_paid_collab(uuid, integer) from public, anon, authenticated;
grant execute on function public.finalize_paid_collab(uuid, integer) to service_role;
