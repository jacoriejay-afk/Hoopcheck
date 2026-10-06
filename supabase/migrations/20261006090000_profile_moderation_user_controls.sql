-- Profile moderation, research-account reporting, avatar review, and admin user controls.

create table if not exists public.profile_reports (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 500),
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now()
);
alter table public.profile_reports enable row level security;
drop policy if exists "profile_reports_insert_own" on public.profile_reports;
create policy "profile_reports_insert_own" on public.profile_reports for insert to authenticated
with check ((select auth.uid())=reporter_id and profile_id<>reporter_id);
drop policy if exists "profile_reports_select_own_or_admin" on public.profile_reports;
create policy "profile_reports_select_own_or_admin" on public.profile_reports for select to authenticated
using ((select auth.uid())=reporter_id or public.is_current_user_admin_or_moderator());
create index if not exists idx_profile_reports_profile_id on public.profile_reports(profile_id);
create index if not exists idx_profile_reports_reporter_id on public.profile_reports(reporter_id);
create index if not exists idx_profile_reports_status on public.profile_reports(status);

alter table public.profiles add column if not exists moderation_status text not null default 'normal' check (moderation_status in ('normal','warned','flagged','suspended'));
alter table public.profiles add column if not exists moderation_note text;
alter table public.profiles add column if not exists moderation_updated_at timestamptz;
alter table public.profiles add column if not exists moderation_updated_by uuid references auth.users(id);
alter table public.profiles add column if not exists interests text;
alter table public.profiles add column if not exists favorite_leagues text;
alter table public.profiles add column if not exists favorite_teams text;
alter table public.profiles add column if not exists experience_summary text;
alter table public.profiles add column if not exists avatar_moderation_status text not null default 'approved' check (avatar_moderation_status in ('pending','approved','rejected'));
alter table public.profiles add column if not exists avatar_moderation_note text;

create or replace function public.admin_moderate_profile(p_profile_id uuid,p_status text,p_note text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v jsonb;
begin
 if not public.is_current_user_admin_or_moderator() then raise exception 'Admin or moderator access required'; end if;
 if p_status not in ('normal','warned','flagged','suspended') then raise exception 'Invalid moderation status'; end if;
 update public.profiles set moderation_status=p_status,moderation_note=nullif(trim(coalesce(p_note,'')),''),moderation_updated_at=now(),moderation_updated_by=(select auth.uid()),updated_at=now()
 where id=p_profile_id returning jsonb_build_object('id',id,'status',moderation_status,'note',moderation_note) into v;
 if v is null then raise exception 'Profile not found'; end if; return v;
end; $$;
revoke execute on function public.admin_moderate_profile(uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_moderate_profile(uuid,text,text) to authenticated;

create or replace function public.admin_update_profile(p_profile_id uuid,p_account_type text default null,p_player_verified boolean default null,p_display_name text default null,p_bio text default null,p_current_country text default null,p_current_team text default null,p_moderation_status text default null,p_moderation_note text default null,p_avatar_moderation_status text default null,p_avatar_moderation_note text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v jsonb;
begin
 if not public.is_current_user_admin_or_moderator() then raise exception 'Admin or moderator access required'; end if;
 if p_account_type is not null and p_account_type not in ('player','coach','scout','agent','fan') then raise exception 'Invalid account type'; end if;
 if p_moderation_status is not null and p_moderation_status not in ('normal','warned','flagged','suspended') then raise exception 'Invalid moderation status'; end if;
 if p_avatar_moderation_status is not null and p_avatar_moderation_status not in ('pending','approved','rejected') then raise exception 'Invalid avatar moderation status'; end if;
 update public.profiles set account_type=coalesce(p_account_type,account_type),player_verified=coalesce(p_player_verified,player_verified),display_name=coalesce(nullif(trim(p_display_name),''),display_name),bio=coalesce(p_bio,bio),current_country=coalesce(p_current_country,current_country),current_team=coalesce(p_current_team,current_team),moderation_status=coalesce(p_moderation_status,moderation_status),moderation_note=case when p_moderation_note is null then moderation_note else nullif(trim(p_moderation_note),'') end,moderation_updated_at=case when p_moderation_status is not null or p_moderation_note is not null then now() else moderation_updated_at end,moderation_updated_by=case when p_moderation_status is not null or p_moderation_note is not null then (select auth.uid()) else moderation_updated_by end,avatar_moderation_status=coalesce(p_avatar_moderation_status,avatar_moderation_status),avatar_moderation_note=case when p_avatar_moderation_note is null then avatar_moderation_note else nullif(trim(p_avatar_moderation_note),'') end,updated_at=now()
 where id=p_profile_id returning jsonb_build_object('id',id,'account_type',account_type,'player_verified',player_verified,'moderation_status',moderation_status,'avatar_moderation_status',avatar_moderation_status) into v;
 if v is null then raise exception 'Profile not found'; end if; return v;
end; $$;
revoke execute on function public.admin_update_profile(uuid,text,boolean,text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.admin_update_profile(uuid,text,boolean,text,text,text,text,text,text,text,text) to authenticated;

create or replace function public.admin_list_users(p_account_type text default null,p_query text default null)
returns table(id uuid,email text,display_name text,username text,account_type text,player_verified boolean,moderation_status text,moderation_note text,avatar_url text,avatar_moderation_status text,bio text,current_country text,current_team text,created_at timestamptz)
language sql security definer set search_path=public as $$
 select p.id,u.email::text,p.display_name,p.username,p.account_type,p.player_verified,p.moderation_status,p.moderation_note,p.avatar_url,p.avatar_moderation_status,p.bio,p.current_country,p.current_team,p.created_at
 from public.profiles p join auth.users u on u.id=p.id
 where public.is_current_user_admin_or_moderator() and (p_account_type is null or p.account_type=p_account_type)
 and (p_query is null or p_query='' or lower(coalesce(u.email,'')) like '%'||lower(p_query)||'%' or lower(coalesce(p.username,'')) like '%'||lower(p_query)||'%' or lower(coalesce(p.display_name,'')) like '%'||lower(p_query)||'%')
 order by p.created_at desc;
$$;
revoke execute on function public.admin_list_users(text,text) from public,anon,authenticated;
grant execute on function public.admin_list_users(text,text) to authenticated;

insert into storage.buckets(id,name,public) values('profile-avatars','profile-avatars',true) on conflict(id) do update set public=true;
drop policy if exists "profile avatars insert own" on storage.objects;
create policy "profile avatars insert own" on storage.objects for insert to authenticated with check(bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select auth.uid()::text));
drop policy if exists "profile avatars update own" on storage.objects;
create policy "profile avatars update own" on storage.objects for update to authenticated using(bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select auth.uid()::text)) with check(bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select auth.uid()::text));
drop policy if exists "profile avatars delete own" on storage.objects;
create policy "profile avatars delete own" on storage.objects for delete to authenticated using(bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select auth.uid()::text));


create or replace function public.prevent_user_moderation_fields()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if (select auth.uid())=new.id and not public.is_current_user_admin_or_moderator() then
  new.moderation_status:=old.moderation_status;
  new.moderation_note:=old.moderation_note;
  new.moderation_updated_at:=old.moderation_updated_at;
  new.moderation_updated_by:=old.moderation_updated_by;
  new.avatar_moderation_status:=old.avatar_moderation_status;
  new.avatar_moderation_note:=old.avatar_moderation_note;
 end if;
 return new;
end; $$;
drop trigger if exists protect_profile_moderation_fields on public.profiles;
create trigger protect_profile_moderation_fields before update on public.profiles for each row execute function public.prevent_user_moderation_fields();

create or replace function public.check_profile_text_safety()
returns trigger language plpgsql security invoker set search_path=public as $$
declare txt text:=lower(coalesce(new.bio,'')||' '||coalesce(new.interests,'')||' '||coalesce(new.experience_summary,'')||' '||coalesce(new.display_name,''));
begin
 if txt ~ '\\m(fuck|shit|bitch|cunt|nigger|nigga|porn|xxx|sexcam|onlyfans)\\M' then
  raise exception 'Profile text contains prohibited language or explicit content';
 end if;
 return new;
end; $$;
drop trigger if exists profile_text_safety on public.profiles;
create trigger profile_text_safety before insert or update on public.profiles for each row execute function public.check_profile_text_safety();
