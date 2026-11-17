-- SECURITY-FINAL #579: isolated synthetic authorization matrix.
-- Safe to run on a staging database with no production accounts.
-- This checks the *predicate* shared by PRs #580 and #581, not the
-- actual RPC execution; live-session tests remain mandatory before release.
DO $$
DECLARE
  owner_ok boolean;
  admin_ok boolean;
  allowed boolean;
  case_name text;
BEGIN
  FOR case_name, owner_ok, admin_ok, allowed IN
    SELECT * FROM (VALUES
      ('approved owner admin',true,true,true),
      ('unapproved admin',false,true,false),
      ('approved non-admin',true,false,false),
      ('moderator',false,false,false),
      ('team manager',false,false,false),
      ('regular user',false,false,false),
      ('anonymous',false,false,false)
    ) AS cases(name,owner_approved,is_admin,expected)
  LOOP
    IF ((owner_ok IS TRUE) AND (admin_ok IS TRUE)) IS DISTINCT FROM allowed THEN
      RAISE EXCEPTION 'Authorization matrix failed for %',case_name;
    END IF;
  END LOOP;
END $$;
