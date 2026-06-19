-- 030: race-safe "Undo selection".
--
-- Undo must never race against Stripe funding. Previously the route read
-- payment_status, then acted — a funding webhook arriving in between could fund
-- a collab we were about to cancel (or vice-versa). This RPC takes a row lock
-- (SELECT ... FOR UPDATE) and re-checks the money state INSIDE the lock, then
-- atomically cancels the (still-unfunded) collab and returns its applicant to
-- the pool. The concurrent funding webhook either:
--   • already committed before us → we observe 'funded' under the lock and
--     refuse (result 'funded'), or
--   • is blocked on the lock until we commit → it then finds payment_status
--     'cancelled', and its UPDATE (WHERE payment_status IN
--     (unfunded,authorizing,funded)) no longer matches → no-op.
-- Either way no capture happens, so money is safe. The Stripe authorization
-- hold (if any) is released best-effort by the caller afterwards; an uncaptured
-- hold simply expires on its own if that cleanup is missed.
--
-- p_brand_user_id: enforces brand ownership for the route; pass NULL for
-- service/cron callers (funding-deadline expiry) to skip the ownership check.
-- Idempotent: a second call observes 'cancelled' and returns 'already'.
create or replace function public.claim_unselect_atomic(
  p_collab_id uuid,
  p_brand_user_id uuid
)
returns table(result text, intent_id text, application_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_collab public.collabs%rowtype;
  v_brand_user uuid;
begin
  select * into v_collab from public.collabs where id = p_collab_id for update;
  if not found then
    return query select 'not_found'::text, null::text, null::uuid; return;
  end if;

  if p_brand_user_id is not null then
    select user_id into v_brand_user from public.brand_profiles where id = v_collab.brand_id;
    if v_brand_user is distinct from p_brand_user_id then
      return query select 'forbidden'::text, null::text, null::uuid; return;
    end if;
  end if;

  -- Idempotent no-op if already unwound.
  if v_collab.status = 'cancelled' then
    return query select 'already'::text, null::text, v_collab.application_id; return;
  end if;

  -- Money guard: only a hidden, not-yet-funded collab may be undone.
  if v_collab.status <> 'briefed'
     or v_collab.payment_status not in ('unfunded', 'authorizing')
     or v_collab.stripe_transfer_id is not null then
    return query select 'funded'::text, null::text, null::uuid; return;
  end if;

  update public.collabs
    set status = 'cancelled', payment_status = 'cancelled'
    where id = p_collab_id;

  if v_collab.application_id is not null then
    update public.applications set status = 'pending'
      where id = v_collab.application_id and status = 'selected';
  end if;

  return query select 'cancelled'::text, v_collab.stripe_payment_intent_id, v_collab.application_id;
end;
$$;

revoke all on function public.claim_unselect_atomic(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_unselect_atomic(uuid, uuid) to service_role;
