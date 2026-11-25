-- REVIEW ONLY. Requires hoopdata_manager_submissions_review_only.sql.
-- No canonical fixture or score write. Existing RLS verifies role and active team claim.
BEGIN;
CREATE FUNCTION public.hoopdata_submit_manager_game(p_team uuid,p_opponent uuid,p_league uuid,p_tipoff timestamptz,p_kind text,p_team_score integer,p_opponent_score integer,p_evidence text,p_request uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $intake$
DECLARE result_id uuid; result_status text;
BEGIN
 IF auth.uid() IS NULL OR p_team IS NULL OR p_opponent IS NULL OR p_league IS NULL OR p_request IS NULL OR p_tipoff IS NULL OR p_kind IS NULL OR p_kind NOT IN ('schedule','result')
  OR p_evidence IS NULL OR length(btrim(p_evidence)) NOT BETWEEN 1 AND 2000 THEN RETURN NULL; END IF;
 INSERT INTO public.hoopdata_manager_submissions(team_id,opponent_team_id,league_id,scheduled_at,kind,team_score,opponent_score,evidence,request_id)
 VALUES(p_team,p_opponent,p_league,p_tipoff,p_kind,p_team_score,p_opponent_score,btrim(p_evidence),p_request)
 ON CONFLICT(submitted_by,request_id) DO NOTHING RETURNING id,status INTO result_id,result_status;
 IF result_id IS NULL THEN
   SELECT id,status INTO result_id,result_status FROM public.hoopdata_manager_submissions
   WHERE submitted_by=auth.uid() AND request_id=p_request AND team_id=p_team AND opponent_team_id=p_opponent AND league_id=p_league
   AND scheduled_at=p_tipoff AND kind=p_kind AND team_score IS NOT DISTINCT FROM p_team_score
   AND opponent_score IS NOT DISTINCT FROM p_opponent_score AND evidence=btrim(p_evidence);
 END IF;
 IF result_id IS NULL THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('id',result_id,'status',result_status);
END;
$intake$;
REVOKE ALL ON FUNCTION public.hoopdata_submit_manager_game(uuid,uuid,uuid,timestamptz,text,integer,integer,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hoopdata_submit_manager_game(uuid,uuid,uuid,timestamptz,text,integer,integer,text,uuid) TO authenticated;
COMMIT;
