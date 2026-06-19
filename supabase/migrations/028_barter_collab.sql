-- True barter collabs: a brand can accept a barter applicant with NO cash rate.
-- The collab is created with agreed_rate 0 and payment_status 'funded' so the
-- normal draft/live/review gates (which require 'funded') pass without any
-- escrow funding. Completion settles as 'manual_exception' (no money moved).
-- agreed_rate = 0 is the barter signal used app-wide. Service-role only.
create or replace function public.select_barter_collab(p_application_id uuid)
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
  select * into v_application from public.applications where id = p_application_id for update;
  if not found then raise exception 'Application not found'; end if;

  -- Ignore cancelled collabs (undone/expired) so the applicant is re-selectable.
  select id into v_existing_id from public.collabs
    where application_id = p_application_id and status <> 'cancelled';
  if v_existing_id is not null then
    return query select v_existing_id, false; return;
  end if;

  if v_application.status not in ('pending', 'shortlisted', 'selected') then
    raise exception 'Application cannot be selected from status %', v_application.status;
  end if;

  select * into v_campaign from public.campaigns where id = v_application.campaign_id for update;
  if v_campaign.comp_type not in ('barter', 'both') then
    raise exception 'This campaign is not a barter campaign';
  end if;

  select count(*) into v_selected_count from public.collabs
    where campaign_id = v_campaign.id and status <> 'cancelled';
  if v_selected_count >= v_campaign.creators_needed then
    raise exception 'Campaign creator capacity has been reached';
  end if;

  insert into public.collabs (
    application_id, campaign_id, creator_id, brand_id,
    agreed_rate, platform_fee, creator_payout, status, payment_status, funded_at
  ) values (
    v_application.id, v_campaign.id, v_application.creator_id, v_campaign.brand_id,
    0, 0, 0, 'briefed', 'funded', now()
  ) returning id into v_collab_id;

  update public.applications set status = 'selected' where id = v_application.id;
  return query select v_collab_id, true;
end;
$$;

revoke all on function public.select_barter_collab(uuid) from public, anon, authenticated;
grant execute on function public.select_barter_collab(uuid) to service_role;
