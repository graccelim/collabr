-- Rollback Phase 11 — Collab messaging (Chat)
drop policy if exists "collab_message_parties_read" on public.collab_messages;
drop index if exists public.collab_messages_flagged_idx;
drop index if exists public.collab_messages_collab_idx;
drop table if exists public.collab_messages;
