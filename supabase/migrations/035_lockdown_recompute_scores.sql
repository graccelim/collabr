-- 035: lock down recompute_creator_scores (was callable by any authed/anon user).
--
-- It's SECURITY DEFINER and, with a null arg, recomputes the whole table — a DoS
-- vector if exposed. Every other definer function revokes client execute; this
-- one was missed. Restrict to service_role (the nightly cron uses that).
revoke all on function public.recompute_creator_scores(uuid) from public, anon, authenticated;
grant execute on function public.recompute_creator_scores(uuid) to service_role;
