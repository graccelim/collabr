-- ============================================================================
-- 045: Per-platform Creator Insights store. Content behaves differently per
-- platform, so insights are computed + stored PER (creator, platform), never
-- merged. `data` holds the deterministic engine output; `ai_narrative` is the
-- OPTIONAL AI explanation (analytics work without it). Owner-read; service-write.
-- ============================================================================

create table if not exists public.creator_platform_insights (
  creator_id    uuid not null references public.creator_profiles(id) on delete cascade,
  platform      text not null,                 -- tiktok | instagram | youtube
  data          jsonb not null default '{}',   -- deterministic PlatformInsights
  ai_narrative  text,                          -- optional per-platform analyst read
  ai_hash       text,                          -- skip AI regen when data unchanged
  computed_at   timestamptz not null default now(),
  primary key (creator_id, platform)
);

alter table public.creator_platform_insights enable row level security;
drop policy if exists "cpi_owner_read" on public.creator_platform_insights;
create policy "cpi_owner_read" on public.creator_platform_insights for select
  using (creator_id in (select id from public.creator_profiles where user_id = auth.uid()));
revoke all on table public.creator_platform_insights from anon, authenticated;
grant select on table public.creator_platform_insights to authenticated;
