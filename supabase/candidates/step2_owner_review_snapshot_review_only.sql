-- REVIEW ONLY: owner-bound review projection for the disabled account snapshot.
-- Apply only after independent full-schema and role verification; no grant
-- revocation, historical migration replay, or provider activation here.
BEGIN;
SET LOCAL lock_timeout='4s';
SET LOCAL statement_timeout='25s';
DO $pre$
BEGIN
 IF to_regprocedure('public.confirm_active_account_session()') IS NULL
 OR to_regprocedure('hoopcheck_security.mfa_satisfied()') IS NULL
 OR to_regclass('auth.users') IS NULL
 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE oid='public.reviews'::regclass AND relrowsecurity)
 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE oid='public.womens_team_reviews'::regclass AND relrowsecurity)
 THEN RAISE EXCEPTION 'Review export prerequisites missing'; END IF;
END $pre$;

CREATE SCHEMA hoopcheck_review_private;
REVOKE ALL ON SCHEMA hoopcheck_review_private FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA hoopcheck_review_private TO authenticated;

-- No caller-supplied account or review IDs, no dynamic SQL, no writes.
-- This narrowly scoped definer is needed to keep owner filtering functional
-- after author_id SELECT is removed from authenticated table grants.
-- Existing reviewed session/MFA proof is checked explicitly; RLS is not
-- relied on inside this function. Full real-role acceptance is mandatory.
CREATE FUNCTION hoopcheck_review_private.own_review_snapshot()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $snapshot$
DECLARE v_owner uuid := auth.uid(); v_men jsonb; v_women jsonb;
BEGIN
 IF v_owner IS NULL
 OR auth.jwt()->>'role' IS DISTINCT FROM 'authenticated'
 OR coalesce(auth.jwt()->>'is_anonymous','false') <> 'false'
 OR (auth.jwt() ? 'client_id')
 OR NOT coalesce(public.confirm_active_account_session(),false)
 OR NOT coalesce(hoopcheck_security.mfa_satisfied(),false)
 OR NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=v_owner AND u.email_confirmed_at IS NOT NULL)
 OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=v_owner
   AND coalesce(p.moderation_status,'') NOT IN ('suspended','banned','removed'))
 THEN RAISE EXCEPTION 'Verified active owner required' USING ERRCODE='42501'; END IF;

 SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]'::jsonb) INTO v_men FROM (
  SELECT author_id,id,title,body,status,overall_rating,player_season,team_id,coach_id,league_id,is_anonymous,created_at
  FROM public.reviews WHERE author_id=v_owner ORDER BY id LIMIT 101
 ) r;
 SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]'::jsonb) INTO v_women FROM (
  SELECT author_id,id,title,body,status,overall_rating,womens_team_id,is_anonymous,created_at
  FROM public.womens_team_reviews WHERE author_id=v_owner ORDER BY id LIMIT 101
 ) r;
 RETURN jsonb_build_object('owner_id',v_owner,'reviews',v_men,'womens_reviews',v_women);
END $snapshot$;
REVOKE ALL ON FUNCTION hoopcheck_review_private.own_review_snapshot() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hoopcheck_review_private.own_review_snapshot() TO authenticated;
CREATE FUNCTION public.get_own_review_snapshot()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $wrapper$
 SELECT hoopcheck_review_private.own_review_snapshot()
$wrapper$;
REVOKE ALL ON FUNCTION public.get_own_review_snapshot() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_own_review_snapshot() TO authenticated;
COMMIT;
