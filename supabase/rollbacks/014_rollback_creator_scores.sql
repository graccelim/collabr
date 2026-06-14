-- Rollback Phase 14 — creator_scores
drop function if exists public.recompute_creator_scores(uuid);
drop table if exists public.creator_scores;
