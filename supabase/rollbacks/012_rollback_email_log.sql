-- Rollback Phase 12 — email dedupe log
drop index if exists public.email_log_created_idx;
drop table if exists public.email_log;
