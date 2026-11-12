-- Proposed production migration: restrict complimentary membership grants to admins.
-- Review against live function definition before applying.
-- This is a verification query, not a production mutation.
select p.proname, p.prosecdef, pg_get_functiondef(p.oid)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'admin_set_membership';
