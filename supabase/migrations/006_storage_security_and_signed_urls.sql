-- Phase 4: private draft storage references and version-controlled bucket policy.
-- Existing submissions.file_url values remain readable for backward compatibility.

alter table public.submissions
  add column storage_path text,
  add column external_url text,
  add constraint submissions_has_file_reference check (
    file_url is not null or storage_path is not null or external_url is not null
  ) not valid,
  add constraint submissions_storage_path_is_collab_scoped check (
    storage_path is null or storage_path like collab_id::text || '/%'
  ) not valid;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'draft-submissions',
  'draft-submissions',
  false,
  524288000,
  array['video/mp4', 'video/quicktime', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand-assets',
  'brand-assets',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- These are the only application storage buckets currently supported. Replace
-- all existing object policies so an older permissive dashboard-created policy
-- cannot silently preserve access to private drafts.
do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
  loop
    execute format('drop policy if exists %I on storage.objects', v_policy.policyname);
  end loop;
end;
$$;

-- Drafts can only be uploaded by the creator on the collab named by the first
-- path segment. Reads intentionally go through the authorized server endpoint,
-- which issues short-lived signed URLs.
create policy "draft_creator_upload" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'draft-submissions'
    and exists (
      select 1
      from public.collabs c
      join public.creator_profiles cp on cp.id = c.creator_id
      where c.id::text = (storage.foldername(name))[1]
        and cp.user_id = auth.uid()
        and c.payment_status = 'funded'
        and c.status in ('briefed', 'in_revision')
    )
  );

-- brand-assets is public for reads. Mutations are restricted to files named
-- logos/{user_id}-{timestamp}.{ext} by that authenticated brand user.
create policy "brand_asset_owner_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] = 'logos'
    and storage.filename(name) like auth.uid()::text || '-%'
  );

create policy "brand_asset_owner_update" on storage.objects for update to authenticated
  using (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] = 'logos'
    and storage.filename(name) like auth.uid()::text || '-%'
  )
  with check (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] = 'logos'
    and storage.filename(name) like auth.uid()::text || '-%'
  );

create policy "brand_asset_owner_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] = 'logos'
    and storage.filename(name) like auth.uid()::text || '-%'
  );

create or replace function public.submit_draft_reference_atomic(
  p_collab_id uuid,
  p_storage_path text,
  p_external_url text,
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
  if (p_storage_path is null) = (p_external_url is null) then
    raise exception 'Exactly one draft file reference is required';
  end if;
  if p_storage_path is not null and p_storage_path not like p_collab_id::text || '/%' then
    raise exception 'Draft storage path must be scoped to the collab';
  end if;

  select * into v_collab from public.collabs where id = p_collab_id for update;
  if not found then raise exception 'Collab not found'; end if;

  select * into v_existing
  from public.submissions
  where collab_id = p_collab_id and decision = 'pending'
  order by version desc
  limit 1;

  if v_collab.status = 'draft_submitted' and v_existing.id is not null then
    if coalesce(v_existing.storage_path, '') <> coalesce(p_storage_path, '')
      or coalesce(v_existing.external_url, '') <> coalesce(p_external_url, '') then
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

  select coalesce(max(version), 0) + 1 into v_version
  from public.submissions where collab_id = p_collab_id;

  insert into public.submissions (
    collab_id, version, storage_path, external_url, creator_note
  )
  values (
    p_collab_id, v_version, p_storage_path, p_external_url, nullif(trim(p_creator_note), '')
  )
  returning id into v_submission_id;

  update public.collabs
  set status = 'draft_submitted', draft_auto_approve_at = p_auto_approve_at
  where id = p_collab_id;

  return query select v_submission_id, v_version, true;
end;
$$;

revoke all on function public.submit_draft_reference_atomic(uuid, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.submit_draft_reference_atomic(uuid, text, text, text, timestamptz)
  to service_role;
