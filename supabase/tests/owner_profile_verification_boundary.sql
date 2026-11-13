-- Run against an isolated HoopCheck schema with synthetic profile rows.
-- Fixtures and mutations roll back together.
BEGIN;
INSERT INTO auth.users (id, email, raw_user_meta_data)
SELECT fixture.id, fixture.email, jsonb_build_object(
  'username', fixture.username, 'account_type', 'player', 'birthdate', '1990-01-01',
  'gender', 'prefer_not_to_say', 'position', 'PG', 'agreed_to_terms', true)
FROM (VALUES
  ('ad912000-0000-4000-8000-000000000001'::uuid,'hc_ver_owner@example.invalid','hc_ver_owner'),
  ('ad912000-0000-4000-8000-000000000002'::uuid,'hc_ver_admin@example.invalid','hc_ver_admin'),
  ('ad912000-0000-4000-8000-000000000003'::uuid,'hc_ver_mod@example.invalid','hc_ver_mod'),
  ('ad912000-0000-4000-8000-000000000004'::uuid,'hc_ver_user@example.invalid','hc_ver_user')
) fixture(id,email,username);
INSERT INTO hoopcheck_security.owner_accounts (user_id) VALUES ('ad912000-0000-4000-8000-000000000001');
INSERT INTO public.admin_roles (user_id,role) VALUES
  ('ad912000-0000-4000-8000-000000000001','admin'),
  ('ad912000-0000-4000-8000-000000000002','admin'),
  ('ad912000-0000-4000-8000-000000000003','moderator');

SET LOCAL ROLE authenticated;
DO $test$
DECLARE
  actor uuid;
  target constant uuid := 'ad912000-0000-4000-8000-000000000004';
  owner constant uuid := 'ad912000-0000-4000-8000-000000000001';
BEGIN
  FOREACH actor IN ARRAY ARRAY['ad912000-0000-4000-8000-000000000002'::uuid,
    'ad912000-0000-4000-8000-000000000003'::uuid, target] LOOP
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub',actor,'role','authenticated')::text,true);
    BEGIN
      UPDATE public.profiles SET player_verified=true WHERE id=actor;
      RAISE EXCEPTION 'Direct player verification bypass for %', actor;
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
      PERFORM public.admin_update_profile(p_profile_id=>target,p_player_verified=>true);
      RAISE EXCEPTION 'RPC player verification bypass for %', actor;
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END LOOP;

  PERFORM set_config('request.jwt.claims','{"sub":"ad912000-0000-4000-8000-000000000003","role":"authenticated"}',true);
  IF public.admin_update_profile(p_profile_id=>target,p_moderation_status=>'flagged')->>'moderation_status'
     IS DISTINCT FROM 'flagged' THEN
    RAISE EXCEPTION 'Moderator lost profile moderation access';
  END IF;

  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner,'role','authenticated')::text,true);
  IF public.admin_update_profile(p_profile_id=>target,p_player_verified=>true)->>'player_verified'
     IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Owner admin verification failed';
  END IF;
END;
$test$;

RESET ROLE;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
UPDATE public.profiles SET player_verified=false
WHERE id='ad912000-0000-4000-8000-000000000004';
RESET ROLE;
DO $test$
BEGIN
  IF (SELECT player_verified FROM public.profiles WHERE id='ad912000-0000-4000-8000-000000000004')
     IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Trusted service verification failed';
  END IF;
END;
$test$;
SELECT 'Owner profile verification boundary passed' AS result;
ROLLBACK;
