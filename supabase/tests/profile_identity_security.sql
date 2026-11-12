\set ON_ERROR_STOP on
create schema auth;
create role authenticated nologin;
create role anon nologin;
create role service_role nologin;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table public.admin_roles(user_id uuid,role text);
create table public.profiles(
 id uuid primary key,account_type text,player_verified boolean,display_name text,bio text,
 current_country text,current_team text,moderation_status text,moderation_note text,
 moderation_updated_at timestamptz,moderation_updated_by uuid,avatar_moderation_status text,
 avatar_moderation_note text,profile_visibility text,free_agent boolean,interests text,
 favorite_leagues text,updated_at timestamptz
);
create function public.is_current_user_admin_or_moderator() returns boolean language sql stable as $$
select exists(select 1 from public.admin_roles where user_id=auth.uid() and role in ('admin','moderator')) $$;
\i supabase/migrations/20261112190000_admin_only_profile_identity_fields.sql
insert into public.admin_roles values
('11111111-1111-1111-1111-111111111111','admin'),
('22222222-2222-2222-2222-222222222222','moderator');
insert into public.profiles(id,account_type,player_verified,moderation_status)
values ('44444444-4444-4444-4444-444444444444','fan',false,'normal');
do $$
declare denied boolean;
begin
 if has_function_privilege('anon','public.admin_update_profile(uuid,text,boolean,text,text,text,text,text,text,text,text,text,boolean,text,text)','EXECUTE')
 then raise exception 'anonymous execution allowed'; end if;
 perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
 denied:=false;
 begin
   perform public.admin_update_profile(p_profile_id=>'44444444-4444-4444-4444-444444444444',p_player_verified=>true);
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'moderator changed verification'; end if;
 denied:=false;
 begin
   perform public.admin_update_profile(p_profile_id=>'44444444-4444-4444-4444-444444444444',p_account_type=>'player');
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'moderator changed account type'; end if;
 perform public.admin_update_profile(p_profile_id=>'44444444-4444-4444-4444-444444444444',p_moderation_status=>'flagged');
 if (select moderation_status from public.profiles where id='44444444-4444-4444-4444-444444444444') <> 'flagged' then raise exception 'moderator moderation failed'; end if;
 perform set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',true);
 denied:=false;
 begin
   perform public.admin_update_profile(p_profile_id=>'44444444-4444-4444-4444-444444444444',p_moderation_status=>'normal');
 exception when others then denied:=true; end;
 if not denied then raise exception 'ordinary user moderated'; end if;
 perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
 perform public.admin_update_profile(p_profile_id=>'44444444-4444-4444-4444-444444444444',p_account_type=>'player',p_player_verified=>true);
 if not (select account_type='player' and player_verified from public.profiles where id='44444444-4444-4444-4444-444444444444') then raise exception 'admin update failed'; end if;
end $$;
