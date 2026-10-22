-- Keep admin profile updates aligned with the visibility values supported by
-- the account settings UI and profiles_profile_visibility_check.
create or replace function public.admin_update_profile(
 p_user_id uuid,
 p_display_name text default null,
 p_player_verified boolean default null,
 p_bio text default null,
 p_position text default null,
 p_current_country text default null,
 p_current_team text default null,
 p_account_type text default null,
 p_moderation_status text default null,
 p_avatar_url text default null,
 p_avatar_moderation_status text default null,
 p_profile_visibility text default null,
 p_free_agent boolean default null,
 p_experience_summary text default null,
 p_admin_note text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
 if not public.is_current_user_admin_or_moderator() then
  raise exception 'Admin or moderator access required';
 end if;
 if p_account_type is not null and p_account_type not in ('player','coach','scout','agent','fan') then
  raise exception 'Invalid account type';
 end if;
 if p_moderation_status is not null and p_moderation_status not in ('normal','warned','flagged','suspended') then
  raise exception 'Invalid moderation status';
 end if;
 if p_avatar_moderation_status is not null and p_avatar_moderation_status not in ('pending','approved','rejected') then
  raise exception 'Invalid avatar moderation status';
 end if;
 if p_profile_visibility is not null and p_profile_visibility not in ('public','private','players_only') then
  raise exception 'Invalid profile visibility';
 end if;
 update public.profiles set
  account_type=coalesce(p_account_type,account_type),
  player_verified=coalesce(p_player_verified,player_verified),
  display_name=coalesce(nullif(trim(p_display_name),''),display_name),
  bio=coalesce(p_bio,bio),
  position=coalesce(p_position,position),
  current_country=coalesce(p_current_country,current_country),
  current_team=coalesce(p_current_team,current_team),
  moderation_status=coalesce(p_moderation_status,moderation_status),
  avatar_url=coalesce(p_avatar_url,avatar_url),
  avatar_moderation_status=coalesce(p_avatar_moderation_status,avatar_moderation_status),
  profile_visibility=coalesce(p_profile_visibility,profile_visibility),
  free_agent=coalesce(p_free_agent,free_agent),
  experience_summary=coalesce(p_experience_summary,experience_summary),
  admin_note=coalesce(p_admin_note,admin_note),
  updated_at=now()
 where id=p_user_id;
 if not found then raise exception 'Profile not found'; end if;
end;
$$;

revoke execute on function public.admin_update_profile(uuid,text,boolean,text,text,text,text,text,text,text,text,text,boolean,text,text) from public, anon;
grant execute on function public.admin_update_profile(uuid,text,boolean,text,text,text,text,text,text,text,text,text,boolean,text,text) to authenticated;
