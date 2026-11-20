-- Opt-in MFA is enforced independently of application UI and editable metadata.
-- UNAPPLIED release candidate: stage and verify before any production rollout.
-- Do not silently replace an existing organization-wide hook.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_db_role_setting s, LATERAL unnest(s.setconfig) setting
    WHERE s.setrole IN (0, (SELECT oid FROM pg_roles WHERE rolname='authenticator'))
      AND s.setdatabase IN (0, (SELECT oid FROM pg_database WHERE datname=current_database()))
      AND setting LIKE 'pgrst.db_pre_request=%'
      AND split_part(setting, '=', 2) NOT IN ('', 'hoopcheck_security.require_mfa')
  ) THEN
    RAISE EXCEPTION 'Existing PostgREST pre-request hook must be reconciled before MFA rollout';
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS hoopcheck_security;
REVOKE ALL ON SCHEMA hoopcheck_security FROM PUBLIC;
GRANT USAGE ON SCHEMA hoopcheck_security TO anon, authenticated, service_role;

-- SECURITY DEFINER is needed only to inspect Auth's private factor records.
-- It returns a boolean for the caller's own verified identity, never factor data.
CREATE OR REPLACE FUNCTION hoopcheck_security.mfa_satisfied()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN auth.jwt()->>'role' IS DISTINCT FROM 'authenticated'
    WHEN coalesce(auth.jwt()->>'aal', 'aal1') NOT IN ('aal1', 'aal2') THEN false
    WHEN auth.jwt()->>'aal' = 'aal2' THEN true
    ELSE NOT EXISTS (
      SELECT 1 FROM auth.mfa_factors f
      WHERE f.user_id = (SELECT auth.uid()) AND f.status = 'verified'
    )
  END;
$$;
REVOKE ALL ON FUNCTION hoopcheck_security.mfa_satisfied() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION hoopcheck_security.mfa_satisfied() TO anon, authenticated, service_role;

-- Restrictive policies AND with existing membership/ownership/moderation rules.
-- Storage and Realtime do not execute the PostgREST pre-request hook.
DO $$ DECLARE target record; BEGIN
  FOR target IN
    SELECT n.nspname, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('r','p') AND c.relrowsecurity
      AND (n.nspname='public' OR (n.nspname='storage' AND c.relname='objects')
        OR (n.nspname='realtime' AND c.relname='messages'))
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS hoopcheck_opted_in_mfa ON %I.%I', target.nspname, target.relname);
    EXECUTE format('CREATE POLICY hoopcheck_opted_in_mfa ON %I.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT hoopcheck_security.mfa_satisfied())) WITH CHECK ((SELECT hoopcheck_security.mfa_satisfied()))', target.nspname, target.relname);
  END LOOP;
END $$;

-- A global Data API hook also protects SECURITY DEFINER RPCs that bypass RLS.
CREATE OR REPLACE FUNCTION hoopcheck_security.require_mfa()
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF auth.jwt()->>'role' = 'authenticated' AND NOT hoopcheck_security.mfa_satisfied() THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Verify your authenticator to continue.', HINT='mfa_required';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION hoopcheck_security.require_mfa() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION hoopcheck_security.require_mfa() TO anon, authenticated, service_role;

ALTER ROLE authenticator SET pgrst.db_pre_request = 'hoopcheck_security.require_mfa';
NOTIFY pgrst, 'reload config';
