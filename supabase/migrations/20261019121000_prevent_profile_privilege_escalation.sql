-- Prevent self-service profile updates from granting verification or changing
-- authorization-relevant account classification. Admin/moderator workflows and
-- trusted server-side service-role operations remain able to make these changes.
-- This migration is for review; it is not applied to production by this change.

create or replace function public.prevent_user_privileged_profile_fields()
returns trigger
language plpgsql
set search_path = 'public', 'pg_catalog'
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

  if public.is_current_user_admin_or_moderator() then
    return new;
  end if;

  if new.account_type is distinct from old.account_type then
    raise exception 'Account type can only be changed through an authorized workflow';
  end if;

  if new.player_verified is distinct from old.player_verified
     or new.player_verified_at is distinct from old.player_verified_at
     or new.selected_team_verified is distinct from old.selected_team_verified then
    raise exception 'Player verification can only be changed through verification';
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

  if new.basketball_type is distinct from old.basketball_type
     and (old.player_verified is true or new.player_verified is true) then
    raise exception 'Basketball type cannot be changed after player verification';
  end if;

  return new;
end;
$function$;

drop trigger if exists prevent_user_privileged_profile_fields on public.profiles;
create trigger prevent_user_privileged_profile_fields
before update on public.profiles
for each row
execute function public.prevent_user_privileged_profile_fields();
