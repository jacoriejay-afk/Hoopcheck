\set ON_ERROR_STOP on
create schema if not exists auth;
create role authenticated nologin;
create role anon nologin;
create role service_role nologin;
create table public.admin_roles(user_id uuid,role text);
create table public.coaches(id uuid primary key);
create table public.teams(id uuid primary key);
create table public.leagues(id uuid primary key);
create table public.reviews(id uuid,coach_id uuid,team_id uuid);
create function auth.uid() returns uuid language sql stable as $$
select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
\i supabase/migrations/20261112180000_admin_only_directory_deletion.sql
insert into public.admin_roles values
('11111111-1111-1111-1111-111111111111','admin'),
('22222222-2222-2222-2222-222222222222','moderator');
insert into public.teams values ('44444444-4444-4444-4444-444444444444');
do $$
declare who uuid; denied boolean;
begin
  if has_function_privilege('anon','public.admin_delete_directory_entry(text,uuid)','EXECUTE')
    then raise exception 'anonymous execution allowed'; end if;
  foreach who in array array[
    '22222222-2222-2222-2222-222222222222'::uuid,
    '33333333-3333-3333-3333-333333333333'::uuid
  ] loop
    perform set_config('request.jwt.claim.sub',who::text,true);
    denied:=false;
    begin
      perform public.admin_delete_directory_entry('team','44444444-4444-4444-4444-444444444444');
    exception when insufficient_privilege then denied:=true;
    end;
    if not denied then raise exception 'non-admin deletion succeeded'; end if;
  end loop;
  if not exists(select 1 from public.teams where id='44444444-4444-4444-4444-444444444444')
    then raise exception 'fixture deleted by non-admin'; end if;
  perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
  if not public.admin_delete_directory_entry('team','44444444-4444-4444-4444-444444444444')
    then raise exception 'admin deletion failed'; end if;
  if exists(select 1 from public.teams where id='44444444-4444-4444-4444-444444444444')
    then raise exception 'admin deletion not persisted'; end if;
end $$;
