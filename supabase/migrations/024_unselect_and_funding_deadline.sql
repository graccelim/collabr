-- Undo-selection + funding-deadline support.
--
-- A brand can undo a selection before escrow is funded, and a cron cancels
-- hidden, unfunded collabs after 72h. Both set the collab to 'cancelled' and
-- revert the application to 'pending'. For the applicant to be re-selectable, a
-- CANCELLED collab must stop blocking the application: it must not count toward
-- capacity, must not satisfy the "already has a collab" check, and must not hold
-- the one-collab-per-application unique slot.

-- 1. One ACTIVE collab per application — a cancelled collab no longer occupies
--    the slot, so the same application can be selected again later (a fresh
--    collab row is inserted; the cancelled one is kept for audit).
drop index if exists public.collabs_application_id_unique;
create unique index collabs_application_id_unique
  on public.collabs(application_id)
  where application_id is not null and status <> 'cancelled';

-- 2. Recreate the selection RPC so it ignores cancelled collabs in BOTH the
--    "already selected" short-circuit and the capacity count. Body is otherwise
--    identical to migration 005. (create or replace preserves grants.)
create or replace function public.select_application_atomic(
  p_application_id uuid,
  p_agreed_rate integer,
  p_platform_fee integer,
  p_creator_payout integer
)
returns table(collab_id uuid, created boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_application public.applications%rowtype;
  v_campaign public.campaigns%rowtype;
  v_existing_id uuid;
  v_collab_id uuid;
  v_selected_count integer;
begin
  select * into v_application
  from public.applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'Application not found';
  end if;

  -- Ignore cancelled collabs: an undone/expired selection must be redoable.
  select id into v_existing_id
  from public.collabs
  where application_id = p_application_id
    and status <> 'cancelled';

  if v_existing_id is not null then
    return query select v_existing_id, false;
    return;
  end if;

  if v_application.status not in ('pending', 'shortlisted', 'selected') then
    raise exception 'Application cannot be selected from status %', v_application.status;
  end if;

  select * into v_campaign
  from public.campaigns
  where id = v_application.campaign_id
  for update;

  if v_campaign.comp_type not in ('paid', 'both') then
    raise exception 'Only campaigns with a paid rate can create collabs in the launch workflow';
  end if;

  if v_application.proposed_rate is null or v_application.proposed_rate <= 0 then
    raise exception 'A positive proposed rate is required before selection';
  end if;

  if p_agreed_rate <> v_application.proposed_rate
    or p_platform_fee < 0
    or p_creator_payout < 0
    or p_platform_fee + p_creator_payout <> p_agreed_rate then
    raise exception 'Invalid collab payment amounts';
  end if;

  -- Capacity counts only live collabs; a cancelled one frees its slot.
  select count(*) into v_selected_count
  from public.collabs
  where campaign_id = v_campaign.id
    and status <> 'cancelled';

  if v_selected_count >= v_campaign.creators_needed then
    raise exception 'Campaign creator capacity has been reached';
  end if;

  insert into public.collabs (
    application_id, campaign_id, creator_id, brand_id,
    agreed_rate, platform_fee, creator_payout, status
  ) values (
    v_application.id, v_campaign.id, v_application.creator_id, v_campaign.brand_id,
    p_agreed_rate, p_platform_fee, p_creator_payout, 'briefed'
  )
  returning id into v_collab_id;

  update public.applications
  set status = 'selected'
  where id = v_application.id;

  return query select v_collab_id, true;
end;
$$;
