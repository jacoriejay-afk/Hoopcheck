-- Enforce the owner-only verification decision across direct profile writes
-- and the older admin editor RPC. Preserve trusted service-role verification.

create or replace function public.prevent_user_privileged_profile_fields()
returns trigger
language plpgsql
set search_path = 'pg_catalog', 'public'
as $function$
begin
  -- Allow trusted server-side service-role operations, but never treat a
  -- missing end-user identity alone as proof of trust.
  if coalesce((select auth.role()), '') = 'service_role' then
    return new;
  end if;

  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if (new.player_verified is distinct from old.player_verified
      or new.player_verified_at is distinct from old.player_verified_at
      or new.selected_team_verified is distinct from old.selected_team_verified)
     and (not public.is_approved_claim_owner()
          or public.get_current_user_admin_role() is distinct from 'admin') then
    raise exception 'Only approved owner administrators may change player verification'
      using errcode = '42501';
  end if;

  if public.is_current_user_admin_or_moderator() then
    return new;
  end if;

  if new.account_type is distinct from old.account_type then
    raise exception 'Account type can only be changed through an authorized workflow';
  end if;

  -- Unverified players may choose/update their intended team during onboarding.
  -- Once verified, team affiliations are locked against self-service changes.
  if old.player_verified is true
     and (
       new.selected_team_id is distinct from old.selected_team_id
       or new.selected_womens_team_id is distinct from old.selected_womens_team_id
     ) then
    raise exception 'Verified player team affiliation can only be changed through an authorized workflow';
  end if;

  if new.coach_profile_id is distinct from old.coach_profile_id
     or new.coach_verified is distinct from old.coach_verified
     or new.coach_verified_at is distinct from old.coach_verified_at then
    raise exception 'Coach verification can only be changed through an authorized workflow';
  end if;

  if new.profile_claimed is distinct from old.profile_claimed
     or new.claimed_at is distinct from old.claimed_at then
    raise exception 'Profile claim status can only be changed through an authorized workflow';
  end if;

  if new.identity_verification_status is distinct from old.identity_verification_status
     or new.stripe_identity_verification_session_id is distinct from old.stripe_identity_verification_session_id then
    raise exception 'Identity verification can only be changed through the verification workflow';
  end if;

  -- Moderation decisions and audit attribution are admin-controlled. Ordinary
  -- users may edit their profile content, but cannot approve/reject themselves
  -- or rewrite moderation notes and attribution.
  if new.moderation_status is distinct from old.moderation_status
     or new.moderation_note is distinct from old.moderation_note
     or new.moderation_updated_at is distinct from old.moderation_updated_at
     or new.moderation_updated_by is distinct from old.moderation_updated_by
     or new.avatar_moderation_status is distinct from old.avatar_moderation_status
     or new.avatar_moderation_note is distinct from old.avatar_moderation_note then
    raise exception 'Profile moderation fields can only be changed through an authorized moderation workflow';
  end if;

  if new.basketball_type is distinct from old.basketball_type
     and (old.player_verified is true or new.player_verified is true) then
    raise exception 'Basketball type cannot be changed after player verification';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_profile(p_profile_id uuid, p_account_type text DEFAULT NULL::text, p_player_verified boolean DEFAULT NULL::boolean, p_display_name text DEFAULT NULL::text, p_bio text DEFAULT NULL::text, p_current_country text DEFAULT NULL::text, p_current_team text DEFAULT NULL::text, p_moderation_status text DEFAULT NULL::text, p_moderation_note text DEFAULT NULL::text, p_avatar_moderation_status text DEFAULT NULL::text, p_avatar_moderation_note text DEFAULT NULL::text, p_profile_visibility text DEFAULT NULL::text, p_free_agent boolean DEFAULT NULL::boolean, p_interests text DEFAULT NULL::text, p_favorite_leagues text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v jsonb;
begin
 if not public.is_current_user_admin_or_moderator() then raise exception 'Admin or moderator access required' using errcode = '42501'; end if;
 if p_player_verified is not null and (not hoopcheck_security.is_approved_owner()
     or public.get_current_user_admin_role() is distinct from 'admin') then
   raise exception 'Only approved owner administrators may change player verification' using errcode = '42501';
 end if;
 if p_account_type is not null
   and not exists (
     select 1 from public.admin_roles ar
     where ar.user_id = (select auth.uid())
       and lower(trim(coalesce(ar.role,''))) = 'admin'
   ) then
   raise exception 'Only admins may change account type' using errcode = '42501';
 end if;
 if p_account_type is not null and p_account_type not in ('player','coach','manager','scout','agent','fan') then raise exception 'Invalid account type'; end if;
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
end; $function$;

revoke all on function public.admin_update_profile(uuid,text,boolean,text,text,text,text,text,text,text,text,text,boolean,text,text) from public,anon;
grant execute on function public.admin_update_profile(uuid,text,boolean,text,text,text,text,text,text,text,text,text,boolean,text,text) to authenticated,service_role;

-- Service-role identity callbacks have no end-user JWT subject.
CREATE OR REPLACE FUNCTION public.prevent_user_moderation_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
 if (select auth.role()) = 'service_role' then return new; end if;
 if (select auth.uid()) is distinct from new.id and not public.is_current_user_admin_or_moderator() then
   raise exception 'Unauthorized profile update';
 end if;
 if (select auth.uid()) = new.id and not public.is_current_user_admin_or_moderator() then
   new.moderation_status:=old.moderation_status;
   new.moderation_note:=old.moderation_note;
   new.moderation_updated_at:=old.moderation_updated_at;
   new.moderation_updated_by:=old.moderation_updated_by;
   new.avatar_moderation_status:=old.avatar_moderation_status;
   new.avatar_moderation_note:=old.avatar_moderation_note;
 end if;
 return new;
end; $function$
;

