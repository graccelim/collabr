-- Rollback for 051_durable_rate_limits.sql. Safe to drop: lib/rate-limit.ts
-- fails open to the in-memory limiter when the RPC is missing.

drop function if exists public.rate_limit_hit(text, int, int);
drop table if exists public.rate_limit_events;
