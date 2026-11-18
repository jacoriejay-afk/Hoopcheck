-- admin_roles writes are mediated by privileged, owner-checked RPCs.
-- RLS already permits authenticated users to SELECT only their own role.
-- Remove unused direct DML privileges as defense in depth.
revoke insert, update, delete on table public.admin_roles from authenticated;
revoke select on table public.admin_roles from anon;
