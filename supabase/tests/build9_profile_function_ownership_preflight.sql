-- Build 9 hosted function ownership preflight (read-only).
-- Run before replaying profile boundary migration; never change owner to bypass this gate.
DO $$
DECLARE f record; caller_name text := current_user;
BEGIN
 FOR f IN
  SELECT p.oid::regprocedure::text AS signature,
         pg_get_userbyid(p.proowner) AS owner_name,
         pg_has_role(current_user,p.proowner,'USAGE') AS can_act_as_owner
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='get_public_player_profile'
 LOOP
  RAISE NOTICE 'Installed function %, owner %, current role %, owner-role membership %',
   f.signature,f.owner_name,caller_name,f.can_act_as_owner;
  IF NOT f.can_act_as_owner THEN
   RAISE EXCEPTION 'Profile migration blocked: current role cannot replace % owned by %. Use authorized owner-controlled migration process; preserve installed function and ACL.',f.signature,f.owner_name
    USING ERRCODE='42501';
  END IF;
 END LOOP;
END $$;
