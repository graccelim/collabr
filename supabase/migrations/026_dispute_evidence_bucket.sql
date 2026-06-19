-- Private storage bucket for dispute evidence files (screenshots, images, docs).
-- All access is service-role mediated: uploads go through the authorized evidence
-- route, and the app hands out short-lived signed URLs for viewing. No public
-- access and no per-user storage policy needed (service role bypasses RLS).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dispute-evidence', 'dispute-evidence', false, 26214400, null)
on conflict (id) do nothing;
