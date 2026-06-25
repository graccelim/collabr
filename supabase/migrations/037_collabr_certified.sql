-- ============================================================================
-- 037: Collabr Certified 🛡️  (Phase 1 — additive, behind the `collabr_certified`
-- feature flag in the app; safe no-op until the flag is on and the cron runs).
--
-- A MAINTAINED, SUSPENDABLE reliability badge earned purely from Collabr
-- behaviour. Facts only — no score, no ranking, no percentile. The DECISION
-- (earn / keep / suspend with hysteresis) lives in the tested TS engine
-- `lib/certification/criteria.ts`; this migration only:
--   1. adds a public `certified` boolean to creator_profiles (the badge),
--   2. adds a creator-private `collabr_certification` table (the why/criteria),
--   3. provides `collabr_certification_facts()` — windowed aggregation only.
--
-- Does NOT touch payments, disputes, reviews, escrow, onboarding, creator_scores
-- (the ranking engine), Creator Pro, Connected, or AI.
-- ============================================================================

-- 1. Public badge flag on the profile (creator_profiles is public-read; ONLY the
--    boolean lives here — never the reason/criteria, which could be sensitive).
alter table public.creator_profiles
  add column if not exists certified boolean not null default false;

-- 2. Creator-private detail (mirrors creator_scores: owner-read, service writes).
create table if not exists public.collabr_certification (
  creator_id              uuid primary key references public.creator_profiles(id) on delete cascade,
  status                  text not null default 'none'
                          check (status in ('none','certified','suspended')),
  criteria                jsonb,         -- per-criterion met/not-met (booleans only)
  suspended_reason        text,          -- plain-language; private to the creator
  -- windowed facts kept for explainability/debugging (not world-readable)
  window_label            text not null default '90d_or_last_20',
  completed_count         int  not null default 0,
  reviews_count           int  not null default 0,
  rating_avg              numeric(4,2) not null default 0,
  completion_rate         numeric(5,4),
  dispute_rate            numeric(5,4),
  unresolved_disputes     int  not null default 0,
  response_median_hours   numeric,
  repeat_brands           int  not null default 0,
  evaluated_at            timestamptz not null default now()
);
alter table public.collabr_certification enable row level security;

-- Own-row read only. Brand-facing surfaces use the public `creator_profiles.certified`
-- boolean (badge) + the facts already exposed by creator_scores via the service role;
-- the private reason/criteria here are never world-readable.
drop policy if exists "certification_owner_read" on public.collabr_certification;
create policy "certification_owner_read" on public.collabr_certification for select
  using (creator_id in (select id from public.creator_profiles where user_id = auth.uid()));
-- Writes: service role only (the recompute cron). No client write policy.
revoke all on table public.collabr_certification from anon, authenticated;
grant select on table public.collabr_certification to authenticated;

-- 3. Windowed facts per creator (AGGREGATION ONLY — no thresholds, no decision).
--    Window = collabs on/after a cutoff that covers the LATER of (last 90 days)
--    and (the last 20 completed collaborations), so the badge is stable.
--    `current_status` is returned so the TS engine can apply hysteresis.
create or replace function public.collabr_certification_facts(p_creator_id uuid default null)
returns table (
  creator_id            uuid,
  completed_count       int,
  cancelled_count       int,
  reviews_count         int,
  rating_avg            numeric,
  disputes_count        int,
  unresolved_disputes   int,
  response_median_hours numeric,
  repeat_brands         int,
  current_status        text
)
language sql stable security definer set search_path = public
as $$
  select
    cp.id,
    f.completed_count,
    f.cancelled_count,
    f.reviews_count,
    f.rating_avg,
    f.disputes_count,
    f.unresolved_disputes,
    f.response_median_hours,
    f.repeat_brands,
    coalesce(cc.status, 'none') as current_status
  from public.creator_profiles cp
  left join public.collabr_certification cc on cc.creator_id = cp.id
  cross join lateral (
    -- cutoff = earlier of (now-90d) and (created_at of the 20th most-recent completed),
    -- so the window always covers at least the last 20 completed collaborations.
    select least(
      now() - interval '90 days',
      coalesce((
        select min(t.created_at) from (
          select c.created_at from public.collabs c
          where c.creator_id = cp.id and c.status = 'completed'
            and c.payment_status in ('paid','manual_exception')
          order by c.created_at desc limit 20
        ) t
      ), now() - interval '90 days')
    ) as cutoff
  ) w
  cross join lateral (
    select
      (select count(*)::int from public.collabs c
         where c.creator_id = cp.id and c.status = 'completed'
           and c.payment_status in ('paid','manual_exception')
           and c.created_at >= w.cutoff)                                          as completed_count,
      (select count(*)::int from public.collabs c
         where c.creator_id = cp.id and c.status = 'cancelled'
           and c.created_at >= w.cutoff)                                          as cancelled_count,
      (select count(*)::int from public.reviews r
         join public.collabs c on c.id = r.collab_id
         where c.creator_id = cp.id and r.reviewer_type = 'brand'
           and c.created_at >= w.cutoff)                                          as reviews_count,
      coalesce((select avg(r.rating) from public.reviews r
         join public.collabs c on c.id = r.collab_id
         where c.creator_id = cp.id and r.reviewer_type = 'brand'
           and c.created_at >= w.cutoff), 0)                                      as rating_avg,
      (select count(*)::int from public.disputes d
         join public.collabs c on c.id = d.collab_id
         where c.creator_id = cp.id and c.created_at >= w.cutoff)                 as disputes_count,
      -- An open dispute is current state (not windowed) — the immediate-suspend trigger.
      (select count(*)::int from public.disputes d
         join public.collabs c on c.id = d.collab_id
         where c.creator_id = cp.id and d.outcome = 'pending')                    as unresolved_disputes,
      (select percentile_cont(0.5) within group (
            order by extract(epoch from (i.responded_at - i.created_at)) / 3600.0)
         from public.campaign_invites i
         where i.creator_id = cp.id and i.responded_at is not null
           and i.responded_at >= now() - interval '90 days')                      as response_median_hours,
      (select count(*)::int from (
         select c.brand_id from public.collabs c
         where c.creator_id = cp.id and c.status = 'completed'
         group by c.brand_id having count(*) >= 2) rb)                            as repeat_brands
  ) f
  where (p_creator_id is null or cp.id = p_creator_id);
$$;
