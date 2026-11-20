\set ON_ERROR_STOP on
-- Synthetic read-contract prototype ONLY. Not a migration or a Build 7 pass.
BEGIN;
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA build9_compat_design;
REVOKE ALL ON SCHEMA build9_compat_design FROM PUBLIC;
GRANT USAGE ON SCHEMA build9_compat_design TO anon,authenticated;
CREATE TABLE build9_compat_design.records(id uuid PRIMARY KEY,current_country text,country_public boolean,theme_preference text,moderation_note text,visible boolean,suspended boolean);
CREATE TABLE build9_compat_design.factors(user_id uuid PRIMARY KEY);
ALTER TABLE build9_compat_design.records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA build9_compat_design FROM PUBLIC,anon,authenticated;
INSERT INTO build9_compat_design.records VALUES
 ('11111111-1111-4111-8111-111111111111','Private France',false,'dark','private note',true,false),
 ('22222222-2222-4222-8222-222222222222','Public Spain',true,'light','other note',true,false),
 ('33333333-3333-4333-8333-333333333333','Hidden',true,'dark','hidden note',false,false),
 ('44444444-4444-4444-8444-444444444444','Suspended',true,'dark','suspended note',true,true);
-- Deliberate definer projection: base-table reads are unavailable to clients.
-- Explicit field list and owner/MFA/visibility predicates replace raw exposure.
CREATE FUNCTION build9_compat_design.projected_profiles()
RETURNS TABLE(id uuid,current_country text,theme_preference text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH claims AS (SELECT coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) j),
 viewer AS (SELECT nullif(j->>'sub','')::uuid uid,
 j->>'role'='authenticated' AND coalesce(j->>'is_anonymous','false')='false' owner_allowed,
 j->>'role' IN ('anon','authenticated') AND coalesce(j->>'aal','aal1') IN ('aal1','aal2') AND (coalesce(j->>'aal','aal1')='aal2' OR NOT EXISTS(SELECT FROM build9_compat_design.factors f WHERE f.user_id=nullif(j->>'sub','')::uuid)) mfa_allowed FROM claims)
 SELECT r.id,CASE WHEN (v.owner_allowed AND r.id=v.uid) OR (r.visible AND NOT r.suspended AND r.country_public) THEN r.current_country END,
 CASE WHEN v.owner_allowed AND r.id=v.uid THEN r.theme_preference END
 FROM build9_compat_design.records r CROSS JOIN viewer v
 WHERE v.mfa_allowed AND ((v.owner_allowed AND r.id=v.uid) OR (r.visible AND NOT r.suspended));
$$;
REVOKE ALL ON FUNCTION build9_compat_design.projected_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION build9_compat_design.projected_profiles() TO anon,authenticated;
CREATE VIEW build9_compat_design.profiles WITH(security_invoker=true,security_barrier=true) AS SELECT * FROM build9_compat_design.projected_profiles();
GRANT SELECT ON build9_compat_design.profiles TO anon,authenticated;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims','{"role":"anon"}',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM build9_compat_design.profiles)<>2 THEN RAISE EXCEPTION 'hidden/suspended row exposure'; END IF;
 IF EXISTS(SELECT FROM build9_compat_design.profiles WHERE current_country='Private France' OR theme_preference IS NOT NULL) THEN RAISE EXCEPTION 'private projection/filter leak'; END IF;
 IF NOT EXISTS(SELECT FROM build9_compat_design.profiles WHERE current_country='Public Spain') THEN RAISE EXCEPTION 'opt-in country lost'; END IF;
 BEGIN PERFORM * FROM build9_compat_design.records; RAISE EXCEPTION 'raw base readable'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111","aal":"aal1"}',true);
DO $$ BEGIN
 IF (SELECT current_country FROM build9_compat_design.profiles WHERE id='11111111-1111-4111-8111-111111111111') IS DISTINCT FROM 'Private France' THEN RAISE EXCEPTION 'owner raw-shaped country read lost'; END IF;
 IF (SELECT theme_preference FROM build9_compat_design.profiles WHERE id='22222222-2222-4222-8222-222222222222') IS NOT NULL THEN RAISE EXCEPTION 'cross-owner preferences exposed'; END IF;
 BEGIN UPDATE build9_compat_design.profiles SET theme_preference='light'; RAISE EXCEPTION 'unreviewed write accepted'; EXCEPTION WHEN insufficient_privilege OR object_not_in_prerequisite_state THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111","is_anonymous":true}',true);
DO $$ BEGIN
 IF EXISTS(SELECT FROM build9_compat_design.profiles WHERE current_country='Private France' OR theme_preference IS NOT NULL) THEN RAISE EXCEPTION 'anonymous Auth owner bypass'; END IF;
END $$;
RESET ROLE;
INSERT INTO build9_compat_design.factors VALUES('11111111-1111-4111-8111-111111111111');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111","aal":"aal1"}',true);
DO $$ BEGIN IF EXISTS(SELECT FROM build9_compat_design.profiles) THEN RAISE EXCEPTION 'MFA bypass'; END IF; END $$;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111","aal":"aal2"}',true);
DO $$ BEGIN IF (SELECT theme_preference FROM build9_compat_design.profiles WHERE id='11111111-1111-4111-8111-111111111111') IS DISTINCT FROM 'dark' THEN RAISE EXCEPTION 'MFA owner recovery lost'; END IF; END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: synthetic legacy-shaped masked reads; production name/write/FK compatibility NOT established' result;
