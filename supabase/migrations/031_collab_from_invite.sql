-- 031: surface invite-accepted collabs to the creator.
--
-- Normally a selected-but-unfunded collab is hidden from the creator (their
-- application just reads "Applied") so a brand's private, never-funded selection
-- never raises false hope. But when a creator ACCEPTS A DIRECT INVITE, they
-- explicitly opted in — the collaboration is real and should be visible to them
-- immediately (showing "awaiting the brand to secure payment"), even before the
-- brand funds. This flag marks those collabs so the creator-facing views show
-- them while still keeping cold, unfunded brand selections hidden.
alter table public.collabs
  add column if not exists from_invite boolean not null default false;

-- When did the creator last open their Invites tab? The nav's invite badge
-- counts only invites that arrived since then, so opening the tab clears the
-- "new invite" indicator (the invites themselves stay listed until acted on).
alter table public.creator_profiles
  add column if not exists invites_seen_at timestamptz;

