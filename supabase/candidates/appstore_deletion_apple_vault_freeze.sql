-- REVIEW ONLY. Install after the reviewed Apple vault and account freeze candidates.
-- Guard the actual vault write, not merely the calling HTTP route. No hosted execution.
CREATE OR REPLACE FUNCTION hoopcheck_apple_private.reject_frozen_authorization()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.apple_subject IS DISTINCT FROM OLD.apple_subject THEN
   RAISE EXCEPTION 'Apple authorization owner cannot change' USING ERRCODE='42501';
  END IF;
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.owner_id::text,17001));
 IF EXISTS(SELECT 1 FROM hoopcheck_deletion_private.frozen_accounts f WHERE f.owner_id=NEW.owner_id) THEN
  RAISE EXCEPTION 'Account deletion is processing' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION hoopcheck_apple_private.reject_frozen_authorization() FROM public,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS reject_frozen_authorization ON hoopcheck_apple_private.authorization_vault;
CREATE TRIGGER reject_frozen_authorization BEFORE INSERT OR UPDATE
 ON hoopcheck_apple_private.authorization_vault FOR EACH ROW
 EXECUTE FUNCTION hoopcheck_apple_private.reject_frozen_authorization();
-- DELETE remains available to the already fenced revocation acknowledgment.
