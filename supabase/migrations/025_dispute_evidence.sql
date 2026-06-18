-- Threaded dispute evidence. The existing `disputes` table holds the opener's
-- single reason + evidence_urls; this adds a per-message log so BOTH parties can
-- submit evidence over time with author + timestamp. Mutations go through an
-- authorized service-role route; parties can read their own collab's evidence.

create table if not exists public.dispute_evidence (
  id              uuid primary key default gen_random_uuid(),
  dispute_id      uuid not null references public.disputes(id) on delete cascade,
  collab_id       uuid not null references public.collabs(id) on delete cascade,
  author_user_id  uuid not null references public.users(id),
  author_type     text not null check (author_type in ('brand','creator')),
  body            text,
  attachment_urls text[] not null default '{}',
  created_at      timestamptz not null default now()
);

create index if not exists idx_dispute_evidence_dispute on public.dispute_evidence(dispute_id);

alter table public.dispute_evidence enable row level security;
create policy "dispute_evidence_parties_select" on public.dispute_evidence for select
  using (
    collab_id in (
      select id from public.collabs where
        creator_id in (select id from public.creator_profiles where user_id = auth.uid())
        or brand_id in (select id from public.brand_profiles where user_id = auth.uid())
    )
  );
revoke all on table public.dispute_evidence from anon, authenticated;
grant select on table public.dispute_evidence to authenticated;
-- Inserts happen via the service-role route (/api/collabs/[id]/dispute/evidence).
