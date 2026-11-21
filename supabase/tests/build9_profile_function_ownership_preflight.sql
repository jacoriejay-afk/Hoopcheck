-- Read-only gate for replacing the exact public profile signature.
DO $$
DECLARE
  installed record;
  inherits_owner boolean;
  can_set_owner boolean;
  can_create boolean := has_schema_privilege(current_user, 'public', 'CREATE');
BEGIN
  SELECT p.oid, p.proowner INTO installed
  FROM pg_proc p WHERE p.oid = to_regprocedure('public.get_public_player_profile(uuid)');
  IF NOT FOUND THEN
    RAISE NOTICE 'No existing public.get_public_player_profile(uuid); schema CREATE=%', can_create;
    RETURN;
  END IF;

  inherits_owner := pg_has_role(current_user, installed.proowner, 'USAGE');
  can_set_owner := pg_has_role(session_user, installed.proowner, 'SET');
  RAISE NOTICE 'Function %, owner %, current role %, inherits owner %, session can set owner %, schema CREATE %',
    installed.oid::regprocedure, installed.proowner::regrole, current_user, inherits_owner, can_set_owner, can_create;
  IF NOT inherits_owner OR NOT can_create THEN
    RAISE EXCEPTION 'Profile migration blocked: use an existing authorized function-owner migration identity with schema CREATE; preserve the installed function and ACL'
      USING ERRCODE = '42501';
  END IF;
END $$;
