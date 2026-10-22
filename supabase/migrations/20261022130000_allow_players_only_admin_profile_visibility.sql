-- Allow the admin profile editor to save the same visibility values as
-- account settings and the profiles table constraint.
create or replace function public.admin_update_profile(
 p_profile_id uuid,
 p_account_type text default null,
 p_player_verified boolean default null,
 p_display_name text default null,
 p_bio text default null,
 p_current_country text default null,
 p_current_team text default null,
 p_moderation_status text default null,
 p_moderation_note text default null,
 p_avatar_moderation_status text default null,
 p_avatar_moderation_note text default null,
 p_profile_visibility text default null,
 p_free_agent boolean default null,
 p_interests text default null,
 p_favorite_leagues text default null
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v jsonb;
begin
 if not public.is_current_user_admin_or_moderator() then raise exception 'Admin or moderator access required'; end if;
 if p_account_type is not null and p_account_type not in ('player','coach','scout','agent','fan') then raise exception 'Invalid account type'; end if;
 if p_moderation_status is not null and p_moderation_status not in ('normal','warned','flagged','suspended') then raise exception 'Invalid moderation status'; end if;
 if p_avatar_moderation_status is not null and p_avatar_moderation_status not in ('pending','approved','rejected') then raise exception 'Invalid avatar moderation status'; end if;
 if p_profile_visibility is not null and p_profile_visibility not in ('public','private','players_only') then raise exception 'Invalid profile visibility'; end if;
 update public.profiles set
  account_type=coalesce(p_account_type,account_type), player_verified=coalesce(p_player_verified,player_verified),
  display_name=coalesce(nullif(trim(p_display_name),''),display_name), bio=coalesce(p_bio,bio),
  current_country=coalesce(p_current_country,current_country), current_team=coalesce(p_current_team,current_team),
  moderation_status=coalesce(p_moderation_status,moderation_status),
  moderation_note=case when p_moderation_note is null then moderation_note else nullif(trim(p_moderation_note),'') end,
  moderation_updated_at=case when p_moderation_status is not null or p_moderation_note is not null then now() else moderation_updated_at end,
  moderation_updated_by=case when p_moderation_status is not null or p_moderation_note is not null then auth.uid() else moderation_updated_by end,
  avatar_moderation_status=coalesce(p_avatar_moderation_status,avatar_moderation_status),
  avatar_moderation_note=case when p_avatar_moderation_note is null then avatar_moderation_note else nullif(trim(p_avatar_moderation_note),'') end,
  profile_visibility=coalesce(p_profile_visibility,profile_visibility), free_agent=coalesce(p_free_agent,free_agent),
  interests=coalesce(p_interests,interests), favorite_leagues=coalesce(p_favorite_leagues,favorite_leagues), updated_at=now()
 where id=p_profile_id
 returning jsonb_build_object('id',id,'account_type',account_type,'player_verified',player_verified,'moderation_status',moderation_status,'avatar_moderation_status',avatar_moderation_status,'profile_visibility',profile_visibility,'free_agent',free_agent) into v;
 if v is null then raise exception 'Profile not found'; end if; return v;
end; $$;
revoke execute on function public.admin_update_profile(uuid,text,boolean,text,text,text,text,text,text,text,text,text,boolean,text,text) from public,anon,authenticated;
grant execute on function public.admin_update_profile(uuid,text,boolean,text,text,text,text,text,text,text,text,text,boolean,text,text) to authenticated;
