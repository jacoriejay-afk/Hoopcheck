-- REELS-1 SECURITY: read-only preflight for profile UPDATE hardening.
-- Run against target environment before any grants migration.
select
  has_table_privilege('authenticated','public.profiles','UPDATE') as broad_profile_update,
  has_column_privilege('authenticated','public.profiles','account_type','UPDATE') as role_mutable,
  has_column_privilege('authenticated','public.profiles','identity_verification_status','UPDATE') as identity_status_mutable,
  has_column_privilege('authenticated','public.profiles','player_verified','UPDATE') as player_verified_mutable,
  has_column_privilege('authenticated','public.profiles','coach_verified','UPDATE') as coach_verified_mutable,
  has_column_privilege('authenticated','public.profiles','moderation_status','UPDATE') as moderation_mutable,
  has_column_privilege('authenticated','public.profiles','display_name','UPDATE') as display_name_mutable,
  has_column_privilege('authenticated','public.profiles','notification_preferences','UPDATE') as notification_preferences_mutable;

-- Inspect grants and effective policy:
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema='public' and table_name='profiles'
  and grantee in ('authenticated','service_role')
order by grantee, privilege_type;

select policyname,cmd,qual,with_check
from pg_policies
where schemaname='public' and tablename='profiles';

-- Confirm production schema before applying grant candidate:
select column_name
from information_schema.columns
where table_schema='public' and table_name='profiles'
order by ordinal_position;

-- Acceptance after migration:
-- authenticated broad_profile_update=false;
-- role_mutable, identity_status_mutable, player_verified_mutable,
-- coach_verified_mutable, moderation_mutable=false;
-- display_name_mutable, notification_preferences_mutable=true;
-- service_role privileged updates still succeed;
-- real JWT user A cannot modify user B's profile;
-- signup, profile editing, identity verification, and Google onboarding pass.
