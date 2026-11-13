\set ON_ERROR_STOP on
create schema auth;
create role authenticated nologin;
create role anon nologin;
create role service_role nologin;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table public.admin_roles(user_id uuid,role text);
create table public.player_verification_requests(id uuid primary key);
\i supabase/migrations/20261113040000_admin_only_player_verification_approval.sql
insert into public.admin_roles values
('11111111-1111-1111-1111-111111111111','admin'),
('22222222-2222-2222-2222-222222222222','moderator');
do $$
declare denied boolean;
begin
 if has_function_privilege('anon','public.moderate_player_verification(uuid,text,text)','EXECUTE')
 then raise exception 'anon execute allowed'; end if;
 perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
 denied:=false;
 begin
 perform public.moderate_player_verification('44444444-4444-4444-4444-444444444444','approved');
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'moderator approval allowed'; end if;
 perform set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',true);
 denied:=false;
 begin
 perform public.moderate_player_verification('44444444-4444-4444-4444-444444444444','approved');
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'ordinary approval allowed'; end if;
 perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
 denied:=false;
 begin
 perform public.moderate_player_verification('44444444-4444-4444-4444-444444444444','invalid');
 exception when others then
 denied := sqlerrm = 'Invalid verification status'; end;
 if not denied then raise exception 'admin did not pass authorization guard'; end if;
end $$;
