-- ============================================================================
-- Phase 11 — Collab messaging (Chat)
--
-- A scoped message thread between the two parties of a collab. Off-platform
-- contact-sharing (phone / email / handles / other-app names) is detected
-- server-side at send time and flagged for manual moderation review — we keep
-- the message (so context survives) but mark it for the admin queue.
--
-- RLS mirrors collabs' `collab_parties`: only the collab's creator and brand
-- can read the thread. Inserts are NOT granted to client roles — all sends go
-- through the server route (createAdminClient) so the `flagged`/`flag_reasons`
-- moderation columns cannot be tampered with by the client.
-- ============================================================================

create table if not exists public.collab_messages (
  id           uuid primary key default gen_random_uuid(),
  collab_id    uuid not null references public.collabs(id) on delete cascade,
  sender_id    uuid not null references public.users(id),
  body         text not null check (char_length(body) between 1 and 2000),
  flagged      boolean not null default false,
  flag_reasons text[] not null default '{}',
  created_at   timestamptz not null default now()
);

create index if not exists collab_messages_collab_idx
  on public.collab_messages (collab_id, created_at);
create index if not exists collab_messages_flagged_idx
  on public.collab_messages (flagged, created_at desc) where flagged;

alter table public.collab_messages enable row level security;

-- Parties of the collab may READ the thread (same membership test as collabs).
drop policy if exists "collab_message_parties_read" on public.collab_messages;
create policy "collab_message_parties_read" on public.collab_messages for select
  using (
    collab_id in (
      select id from public.collabs
      where creator_id in (select id from public.creator_profiles where user_id = auth.uid())
         or brand_id   in (select id from public.brand_profiles   where user_id = auth.uid())
    )
  );

-- No insert/update/delete policy on purpose: sends go through the server route
-- with the service role; the moderation columns stay server-controlled.
