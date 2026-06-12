-- Phase 3: atomic workflow transitions and retry-safe notifications.
-- Existing invalid revision counts or duplicate notification dedupe keys must
-- be reconciled before this migration can be applied.

alter table public.collabs
  alter column revision_count set not null,
  add constraint collabs_revision_count_valid
    check (revision_count between 0 and 2);

alter table public.campaigns
  alter column creators_needed set not null,
  add constraint campaigns_creators_needed_positive
    check (creators_needed > 0);

alter table public.applications
  add constraint applications_proposed_rate_non_negative
    check (proposed_rate >= 0);

alter table public.disputes
  add column resolution_started_at timestamptz,
  add column resolution_outcome text
    check (resolution_outcome in ('creator_wins', 'brand_wins', 'split', 'mutual')),
  add column resolution_split_percentage integer
    check (resolution_split_percentage between 0 and 100),
  add column resolution_platform_ruling text;

alter table public.notifications
  add column dedupe_key text;

create unique index notifications_user_dedupe_key_unique
  on public.notifications(user_id, dedupe_key)
  where dedupe_key is not null;

drop policy if exists "review_insert" on public.reviews;
create policy "review_insert" on public.reviews for insert
  with check (
    auth.uid() = reviewer_id
    and exists (
      select 1
      from public.collabs c
      where c.id = reviews.collab_id
        and c.status = 'completed'
        and c.payment_status in ('paid', 'manual_exception')
        and (
          (
            reviews.reviewer_type = 'brand'
            and c.brand_id in (
              select bp.id from public.brand_profiles bp
              where bp.user_id = auth.uid()
            )
          )
          or
          (
            reviews.reviewer_type = 'creator'
            and c.creator_id in (
              select cp.id from public.creator_profiles cp
              where cp.user_id = auth.uid()
            )
          )
        )
    )
  );

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

  select id into v_existing_id
  from public.collabs
  where application_id = p_application_id;

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

  select count(*) into v_selected_count
  from public.collabs
  where campaign_id = v_campaign.id;

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

create or replace function public.submit_draft_atomic(
  p_collab_id uuid,
  p_file_url text,
  p_creator_note text,
  p_auto_approve_at timestamptz
)
returns table(submission_id uuid, submission_version integer, created boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_collab public.collabs%rowtype;
  v_existing public.submissions%rowtype;
  v_submission_id uuid;
  v_version integer;
begin
  select * into v_collab from public.collabs where id = p_collab_id for update;
  if not found then raise exception 'Collab not found'; end if;

  select * into v_existing
  from public.submissions
  where collab_id = p_collab_id and decision = 'pending'
  order by version desc
  limit 1;

  if v_collab.status = 'draft_submitted' and v_existing.id is not null then
    if v_existing.file_url <> p_file_url then
      raise exception 'A different draft is already pending review';
    end if;
    return query select v_existing.id, v_existing.version, false;
    return;
  end if;

  if v_collab.payment_status <> 'funded' then
    raise exception 'Brand payment must be funded before draft submission';
  end if;
  if v_collab.status not in ('briefed', 'in_revision') then
    raise exception 'Cannot submit draft from status %', v_collab.status;
  end if;
  if p_file_url is null or length(trim(p_file_url)) = 0 then
    raise exception 'Draft file URL is required';
  end if;

  select coalesce(max(version), 0) + 1 into v_version
  from public.submissions where collab_id = p_collab_id;

  insert into public.submissions (collab_id, version, file_url, creator_note)
  values (p_collab_id, v_version, p_file_url, nullif(trim(p_creator_note), ''))
  returning id into v_submission_id;

  update public.collabs
  set status = 'draft_submitted', draft_auto_approve_at = p_auto_approve_at
  where id = p_collab_id;

  return query select v_submission_id, v_version, true;
end;
$$;

create or replace function public.review_draft_atomic(
  p_collab_id uuid,
  p_submission_id uuid,
  p_decision text,
  p_feedback text
)
returns table(submission_id uuid, applied boolean, resulting_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_collab public.collabs%rowtype;
  v_submission public.submissions%rowtype;
  v_status text;
begin
  if p_decision not in ('approved', 'revision', 'rejected') then
    raise exception 'Invalid draft decision';
  end if;

  select * into v_collab from public.collabs where id = p_collab_id for update;
  if not found then raise exception 'Collab not found'; end if;

  select * into v_submission
  from public.submissions
  where id = p_submission_id and collab_id = p_collab_id
  for update;

  if v_submission.id is null then raise exception 'No draft exists'; end if;
  if v_submission.decision = p_decision then
    return query select v_submission.id, false, v_collab.status;
    return;
  end if;
  if v_submission.decision <> 'pending' then raise exception 'No draft is pending review'; end if;
  if v_collab.status <> 'draft_submitted' then raise exception 'No draft is pending review'; end if;
  if v_collab.payment_status <> 'funded' then raise exception 'Payment is no longer funded'; end if;

  if p_decision = 'revision' and v_collab.revision_count >= 2 then
    raise exception 'Maximum revision rounds reached';
  end if;

  update public.submissions
  set decision = p_decision,
      brand_feedback = case when p_decision = 'approved' then null else p_feedback end,
      decided_at = now()
  where id = v_submission.id;

  if p_decision = 'approved' then
    v_status := 'draft_approved';
    update public.collabs
    set status = v_status, draft_auto_approve_at = null
    where id = p_collab_id;
  elsif p_decision = 'revision' then
    v_status := 'in_revision';
    update public.collabs
    set status = v_status,
        revision_count = revision_count + 1,
        draft_auto_approve_at = null
    where id = p_collab_id;
  else
    v_status := 'draft_submitted';
    update public.collabs
    set draft_auto_approve_at = null
    where id = p_collab_id;
  end if;

  return query select v_submission.id, true, v_status;
end;
$$;

create or replace function public.auto_approve_draft_atomic(
  p_collab_id uuid,
  p_now timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission_id uuid;
begin
  update public.collabs
  set status = 'draft_approved', draft_auto_approve_at = null
  where id = p_collab_id
    and status = 'draft_submitted'
    and payment_status = 'funded'
    and draft_auto_approve_at is not null
    and draft_auto_approve_at <= p_now
  returning id into v_submission_id;

  if v_submission_id is null then return false; end if;

  update public.submissions
  set decision = 'approved', decided_at = p_now
  where id = (
    select id from public.submissions
    where collab_id = p_collab_id and decision = 'pending'
    order by version desc limit 1
  );

  if not found then
    raise exception 'No draft is pending auto-approval';
  end if;
  return true;
end;
$$;

create or replace function public.submit_live_post_atomic(
  p_collab_id uuid,
  p_post_url text,
  p_screenshot_url text,
  p_auto_release_at timestamptz
)
returns table(live_post_id uuid, created boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_collab public.collabs%rowtype;
  v_existing public.live_posts%rowtype;
  v_live_post_id uuid;
begin
  select * into v_collab from public.collabs where id = p_collab_id for update;
  if not found then raise exception 'Collab not found'; end if;

  select * into v_existing from public.live_posts where collab_id = p_collab_id;
  if v_existing.id is not null then
    if v_existing.post_url <> p_post_url then
      raise exception 'A different live post is already recorded';
    end if;
    return query select v_existing.id, false;
    return;
  end if;

  if v_collab.status <> 'draft_approved' then raise exception 'Draft must be approved first'; end if;
  if v_collab.payment_status <> 'funded' then raise exception 'Payment is no longer funded'; end if;
  if p_post_url is null or length(trim(p_post_url)) = 0 then raise exception 'Live post URL is required'; end if;

  insert into public.live_posts (collab_id, post_url, screenshot_url)
  values (p_collab_id, trim(p_post_url), nullif(trim(p_screenshot_url), ''))
  returning id into v_live_post_id;

  update public.collabs
  set status = 'live_submitted', live_auto_release_at = p_auto_release_at
  where id = p_collab_id;

  return query select v_live_post_id, true;
end;
$$;

create or replace function public.raise_dispute_atomic(
  p_collab_id uuid,
  p_raised_by text,
  p_reason text,
  p_evidence_urls text[]
)
returns table(dispute_id uuid, created boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_collab public.collabs%rowtype;
  v_existing_id uuid;
  v_dispute_id uuid;
begin
  select * into v_collab from public.collabs where id = p_collab_id for update;
  if not found then raise exception 'Collab not found'; end if;

  select id into v_existing_id
  from public.disputes where collab_id = p_collab_id and resolved_at is null;
  if v_existing_id is not null then
    return query select v_existing_id, false;
    return;
  end if;

  if p_raised_by not in ('brand', 'creator') then raise exception 'Invalid dispute party'; end if;
  if v_collab.status not in ('live_submitted', 'draft_submitted', 'in_revision', 'draft_approved') then
    raise exception 'Cannot raise a dispute from status %', v_collab.status;
  end if;

  insert into public.disputes (collab_id, raised_by, reason, evidence_urls, outcome)
  values (p_collab_id, p_raised_by, p_reason, p_evidence_urls, 'pending')
  returning id into v_dispute_id;

  update public.collabs
  set status = 'disputed', draft_auto_approve_at = null, live_auto_release_at = null
  where id = p_collab_id;

  return query select v_dispute_id, true;
end;
$$;

create or replace function public.claim_live_settlement(
  p_collab_id uuid,
  p_require_expired boolean,
  p_now timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status from public.collabs where id = p_collab_id for update;
  if v_status = 'live_confirmed' then return true; end if;
  if v_status <> 'live_submitted' then return false; end if;

  update public.collabs
  set status = 'live_confirmed', live_auto_release_at = null
  where id = p_collab_id
    and status = 'live_submitted'
    and payment_status in (
      'funded', 'capture_failed', 'captured', 'transfer_pending',
      'transfer_failed', 'paid', 'manual_exception'
    )
    and (
      not p_require_expired
      or (live_auto_release_at is not null and live_auto_release_at <= p_now)
    );
  return found;
end;
$$;

create or replace function public.claim_dispute_resolution(
  p_dispute_id uuid,
  p_outcome text,
  p_split_percentage integer,
  p_platform_ruling text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dispute public.disputes%rowtype;
begin
  select * into v_dispute from public.disputes where id = p_dispute_id for update;
  if not found then raise exception 'Dispute not found'; end if;
  if v_dispute.resolved_at is not null then return false; end if;

  if v_dispute.resolution_started_at is not null then
    if v_dispute.resolution_outcome <> p_outcome
      or coalesce(v_dispute.resolution_split_percentage, -1) <> coalesce(p_split_percentage, -1) then
      raise exception 'Dispute resolution is already in progress with a different outcome';
    end if;
    return true;
  end if;

  update public.disputes
  set resolution_started_at = now(),
      resolution_outcome = p_outcome,
      resolution_split_percentage = p_split_percentage,
      resolution_platform_ruling = p_platform_ruling
  where id = p_dispute_id;
  return true;
end;
$$;

create or replace function public.finalize_dispute_resolution(p_dispute_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.disputes
  set outcome = resolution_outcome,
      split_percentage = resolution_split_percentage,
      platform_ruling = resolution_platform_ruling,
      resolved_at = now()
  where id = p_dispute_id
    and resolved_at is null
    and resolution_started_at is not null;
  return found;
end;
$$;

revoke all on function public.select_application_atomic(uuid, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.submit_draft_atomic(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.review_draft_atomic(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.auto_approve_draft_atomic(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.submit_live_post_atomic(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.raise_dispute_atomic(uuid, text, text, text[]) from public, anon, authenticated;
revoke all on function public.claim_live_settlement(uuid, boolean, timestamptz) from public, anon, authenticated;
revoke all on function public.claim_dispute_resolution(uuid, text, integer, text) from public, anon, authenticated;
revoke all on function public.finalize_dispute_resolution(uuid) from public, anon, authenticated;

grant execute on function public.select_application_atomic(uuid, integer, integer, integer) to service_role;
grant execute on function public.submit_draft_atomic(uuid, text, text, timestamptz) to service_role;
grant execute on function public.review_draft_atomic(uuid, uuid, text, text) to service_role;
grant execute on function public.auto_approve_draft_atomic(uuid, timestamptz) to service_role;
grant execute on function public.submit_live_post_atomic(uuid, text, text, timestamptz) to service_role;
grant execute on function public.raise_dispute_atomic(uuid, text, text, text[]) to service_role;
grant execute on function public.claim_live_settlement(uuid, boolean, timestamptz) to service_role;
grant execute on function public.claim_dispute_resolution(uuid, text, integer, text) to service_role;
grant execute on function public.finalize_dispute_resolution(uuid) to service_role;
