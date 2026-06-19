-- Let a brand accept any applicant who agreed a positive cash rate, even on a
-- BARTER campaign (creators can attach an optional rate when applying). The only
-- requirement to form an escrow-funded collab is a positive agreed rate — the
-- campaign's comp_type no longer blocks it. A pure barter accept (no rate) is
-- still prevented by the positive-rate check below.
--
-- Escrow mechanics are unchanged. Body is otherwise identical to migration 024
-- (keeps the cancelled-collab exclusions). create or replace preserves grants.
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

  -- A positive agreed rate is required to form an escrow collab (this also
  -- blocks pure barter, which has no cash to escrow). comp_type is not checked.
  if v_application.proposed_rate is null or v_application.proposed_rate <= 0 then
    raise exception 'A positive agreed rate is required before selection';
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
