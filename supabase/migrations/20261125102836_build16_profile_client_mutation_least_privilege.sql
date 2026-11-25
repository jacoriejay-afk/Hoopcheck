-- Defense in depth: client profile creation/deletion is not supported by existing RLS.
-- Keep trusted signup provisioning, backend deletion, public reads and own updates.
do $guard$
begin
 if not exists (select 1 from pg_class where oid='public.profiles'::regclass and relrowsecurity)
 or exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and cmd in ('INSERT','DELETE','ALL')) then
   raise exception 'Profile mutation policy changed; review grants before applying';
 end if;
end;
$guard$;
revoke insert, delete on public.profiles from public, anon, authenticated;
