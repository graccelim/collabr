-- ============================================================================
-- Phase 14 - creator_scores (Discovery Foundation)
--
-- Precomputed quality / reliability / responsiveness inputs that POWER RANKING
-- internally. Never displayed as a number. Refreshed by event-triggered and
-- nightly recompute (recompute_creator_scores). Public-read of the 0..100
-- outputs only; raw private inputs are derived server-side but kept here for
-- explainability/debugging (not exposed to clients via the app).
-- ============================================================================

create table if not exists public.creator_scores (
  creator_id uuid primary key references public.creator_profiles(id) on delete cascade,

  -- QUALITY
  quality_score        int,
  bayes_rating         numeric(5,4),
  completed_count      int  not null default 0,
  cancelled_count      int  not null default 0,
  completion_rate      numeric(5,4),
  avg_revisions        numeric(5,4),
  disputes_lost        int  not null default 0,
  flagged_messages     int  not null default 0,

  -- RELIABILITY
  reliability_score      int,
  verification_tier      smallint not null default 0,   -- 0..3
  verified_socials_share numeric(5,4) not null default 0,
  rating_count           int not null default 0,
  rating_avg             numeric(4,2) not null default 0,
  stripe_connected       boolean not null default false,
  onboarding_complete    boolean not null default false,
  email_verified         boolean not null default false,
  account_age_days       int not null default 0,

  -- RESPONSE (creator → invites only)
  invites_concluded          int not null default 0,
  invites_answered           int not null default 0,
  response_rate              numeric(5,4),  -- null until >= min sample (shown only then)
  response_rate_shrunk       numeric(5,4),  -- always defined (prior at n=0)
  response_time_median_hours numeric,

  computed_at  timestamptz not null default now(),
  score_version int not null default 1
);
alter table public.creator_scores enable row level security;
-- Own-row read only: a creator may read their own score row (for the creator's
-- own ranked recommendations). Brand-facing surfaces read OTHER creators'
-- scores via the service role (createAdminClient), so the sensitive raw inputs
-- (disputes_lost, flagged_messages, …) are never world-readable.
drop policy if exists "scores_public_read" on public.creator_scores;
drop policy if exists "scores_owner_read" on public.creator_scores;
create policy "scores_owner_read" on public.creator_scores for select
  using (creator_id in (select id from public.creator_profiles where user_id = auth.uid()));
-- writes: service role only (recompute fn / event triggers) - no client policy.

-- ── Recompute: all creators (p_creator_id null) or one ──────────────────────
create or replace function public.recompute_creator_scores(p_creator_id uuid default null)
returns integer
language plpgsql security definer set search_path = public
as $$
declare v_count int;
begin
  insert into public.creator_scores as cs (
    creator_id, completed_count, cancelled_count, completion_rate, avg_revisions,
    disputes_lost, flagged_messages, bayes_rating, quality_score,
    verification_tier, verified_socials_share, rating_count, rating_avg,
    stripe_connected, onboarding_complete, email_verified, account_age_days,
    reliability_score, invites_concluded, invites_answered, response_rate,
    response_rate_shrunk, response_time_median_hours, computed_at
  )
  select
    cp.id,
    d.completed_count, d.cancelled_count,
    case when (d.completed_count + d.cancelled_count) > 0
         then d.completed_count::numeric / (d.completed_count + d.cancelled_count) end,
    d.avg_revisions, d.disputes_lost, d.flagged_messages,
    d.bayes_rating,
    round(100 * (
        0.45 * d.bayes_rating
      + 0.20 * least(d.completed_count / 10.0, 1)
      + 0.15 * (1 - least(coalesce(d.avg_revisions, 0) / 2.0, 1))
      + 0.10 * coalesce(case when (d.completed_count + d.cancelled_count) > 0
                 then d.completed_count::numeric / (d.completed_count + d.cancelled_count) end, 0.7)
      + 0.10 * (1 - least(d.disputes_lost * 0.5 + d.flagged_messages * 0.2, 1))
    ))::int,
    d.verification_tier, d.verified_socials_share, d.rating_count, d.rating_avg,
    d.stripe_connected, d.onboarding_complete, d.email_verified, d.account_age_days,
    round(100 * (
        0.40 * d.verified_socials_share
      + 0.20 * least(d.rating_count / 5.0, 1)
      + 0.15 * least(d.completed_count / 3.0, 1)
      + 0.10 * (case when d.stripe_connected then 1 else 0 end)
      + 0.08 * (case when d.onboarding_complete then 1 else 0 end)
      + 0.05 * (case when d.email_verified then 1 else 0 end)
      + 0.02 * least(d.account_age_days / 365.0, 1)
    ))::int,
    d.invites_concluded, d.invites_answered,
    case when d.invites_concluded >= 3
         then d.invites_answered::numeric / d.invites_concluded end,
    (d.invites_answered + 5 * 0.5) / (d.invites_concluded + 5),
    d.response_time_median_hours,
    now()
  from public.creator_profiles cp
  cross join lateral (
    select
      (select count(*) from public.collabs c
        where c.creator_id = cp.id and c.status = 'completed'
          and c.payment_status in ('paid','manual_exception'))                       as completed_count,
      (select count(*) from public.collabs c
        where c.creator_id = cp.id and c.status = 'cancelled')                        as cancelled_count,
      (select avg(c.revision_count) from public.collabs c where c.creator_id = cp.id) as avg_revisions,
      (select count(*) from public.disputes dp join public.collabs c on c.id = dp.collab_id
        where c.creator_id = cp.id and dp.outcome = 'brand_wins')                     as disputes_lost,
      (select count(*) from public.collab_messages m join public.collabs c on c.id = m.collab_id
        where c.creator_id = cp.id and m.sender_id = cp.user_id and m.flagged)        as flagged_messages,
      coalesce((select count(*) from public.reviews r join public.collabs c on c.id = r.collab_id
        where c.creator_id = cp.id and r.reviewer_type = 'brand'), 0)                 as rating_count,
      coalesce((select avg(r.rating) from public.reviews r join public.collabs c on c.id = r.collab_id
        where c.creator_id = cp.id and r.reviewer_type = 'brand'), 0)                 as rating_avg,
      -- Bayesian-shrunk rating 0..1 (prior mean 4.2, strength 5)
      (
        (coalesce((select sum(r.rating) from public.reviews r join public.collabs c on c.id = r.collab_id
            where c.creator_id = cp.id and r.reviewer_type = 'brand'), 0) + 4.2 * 5)
        / ((coalesce((select count(*) from public.reviews r join public.collabs c on c.id = r.collab_id
            where c.creator_id = cp.id and r.reviewer_type = 'brand'), 0) + 5) * 5.0)
      )                                                                                as bayes_rating,
      (select count(*) from public.social_accounts s where s.creator_id = cp.id)      as social_total,
      (select count(*) from public.social_accounts s
        where s.creator_id = cp.id and s.verification_status = 'verified')            as social_verified,
      (cp.stripe_connect_id is not null)                                              as stripe_connected,
      (cp.onboarding_completed_at is not null)                                        as onboarding_complete,
      coalesce((select au.email_confirmed_at is not null from auth.users au
        where au.id = cp.user_id), false)                                            as email_verified,
      greatest(0, extract(day from now() - cp.created_at)::int)                       as account_age_days,
      (select count(*) from public.campaign_invites i
        where i.creator_id = cp.id and i.status in ('accepted','declined','expired')) as invites_concluded,
      (select count(*) from public.campaign_invites i
        where i.creator_id = cp.id and i.status in ('accepted','declined')
          and i.responded_at is not null)                                            as invites_answered,
      (select percentile_cont(0.5) within group (
          order by extract(epoch from (i.responded_at - i.created_at)) / 3600.0)
        from public.campaign_invites i
        where i.creator_id = cp.id and i.responded_at is not null)                    as response_time_median_hours
  ) base
  cross join lateral (
    select
      base.completed_count, base.cancelled_count, base.avg_revisions, base.disputes_lost,
      base.flagged_messages, base.rating_count, base.rating_avg, base.bayes_rating,
      base.stripe_connected, base.onboarding_complete, base.email_verified,
      base.account_age_days, base.invites_concluded, base.invites_answered,
      base.response_time_median_hours,
      case when base.social_total > 0 then base.social_verified::numeric / base.social_total else 0 end as verified_socials_share,
      (case when base.social_verified > 0 then 3
            when base.stripe_connected then 2
            when base.email_verified then 1 else 0 end)::smallint                     as verification_tier
  ) d
  where (p_creator_id is null or cp.id = p_creator_id)
  on conflict (creator_id) do update set
    completed_count = excluded.completed_count,
    cancelled_count = excluded.cancelled_count,
    completion_rate = excluded.completion_rate,
    avg_revisions = excluded.avg_revisions,
    disputes_lost = excluded.disputes_lost,
    flagged_messages = excluded.flagged_messages,
    bayes_rating = excluded.bayes_rating,
    quality_score = excluded.quality_score,
    verification_tier = excluded.verification_tier,
    verified_socials_share = excluded.verified_socials_share,
    rating_count = excluded.rating_count,
    rating_avg = excluded.rating_avg,
    stripe_connected = excluded.stripe_connected,
    onboarding_complete = excluded.onboarding_complete,
    email_verified = excluded.email_verified,
    account_age_days = excluded.account_age_days,
    reliability_score = excluded.reliability_score,
    invites_concluded = excluded.invites_concluded,
    invites_answered = excluded.invites_answered,
    response_rate = excluded.response_rate,
    response_rate_shrunk = excluded.response_rate_shrunk,
    response_time_median_hours = excluded.response_time_median_hours,
    computed_at = now();

  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Seed initial scores for everyone.
select public.recompute_creator_scores(null);
