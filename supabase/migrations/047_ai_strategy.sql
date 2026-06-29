-- ============================================================================
-- AI strategist output for Creator Studio. The deterministic engine owns the
-- facts (data); this column stores the LLM "strategist read" (analyst read,
-- 4-6 personalised cards, 3 experiments), cached by the same ai_hash so it only
-- regenerates when the underlying insights change.
-- ============================================================================
alter table public.creator_platform_insights
  add column if not exists ai_strategy jsonb,
  add column if not exists ai_strategy_hash text;
