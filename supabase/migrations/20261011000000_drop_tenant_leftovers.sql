-- Issue #26 (approved by Sarthak 2026-10-11): remove what's left of the old tenant section (white-label subdomain
-- login with a phone allowlist). Its website part went in 7050033 and its backend routes in 341dd49; nothing reads
-- these any more. Checked first: no view, policy, trigger, foreign key or other function depends on them (only
-- is_phone_allowed reads allowed_users). The businesses.allowed_users column is unrelated and stays.
-- Rows at removal: allowed_users 3, pending_requests 1 (test data; a copy was kept outside the repo).
-- No CASCADE: if something did depend on them, this fails instead of silently dropping it.

begin;

drop function if exists public.is_phone_allowed(text);
drop table if exists public.pending_requests;
drop table if exists public.allowed_users;

commit;
