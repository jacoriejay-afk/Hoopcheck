\set ON_ERROR_STOP on
create schema auth;
create role authenticated nologin;
create role anon nologin;
create role service_role nologin;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table public.admin_roles(user_id uuid,role text);
create table public.coach_team_requests(id uuid);
create table public.coaches(id uuid);
create table public.teams(id uuid);
create table public.profiles(id uuid);
create table public.coach_team_assignments(id uuid);
create function public.is_current_user_admin_or_moderator() returns boolean language sql stable as $$ select exists(select 1 from public.admin_roles where user_id=auth.uid() and role in ('admin','moderator')) $$;
\i supabase/migrations/20261113050000_admin_only_coach_verification_approval.sql
insert into public.admin_roles values ('11111111-1111-1111-1111-111111111111','admin'),('22222222-2222-2222-2222-222222222222','moderator');
do $$
declare denied boolean;
begin
 if has_function_privilege('anon','public.admin_review_coach_team_request(uuid,text,text)','EXECUTE') then raise exception 'anon allowed'; end if;
 perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
 denied:=false;
 begin perform public.admin_review_coach_team_request('44444444-4444-4444-4444-444444444444','approved');
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'moderator approval allowed'; end if;
 denied:=false;
 begin perform public.admin_review_coach_team_request('44444444-4444-4444-4444-444444444444','rejected');
 exception when others then denied := sqlerrm='Request not found'; end;
 if not denied then raise exception 'moderator rejection blocked'; end if;
 perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
 denied:=false;
 begin perform public.admin_review_coach_team_request('44444444-4444-4444-4444-444444444444','approved');
 exception when others then denied := sqlerrm='Request not found'; end;
 if not denied then raise exception 'admin approval blocked'; end if;
end $$;
