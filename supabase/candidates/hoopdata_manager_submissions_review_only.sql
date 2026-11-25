-- HOOPDATA-1 REVIEW ONLY. Pending suggestions never alter canonical scores.
BEGIN;
CREATE TABLE public.hoopdata_manager_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id),
  opponent_team_id uuid NOT NULL REFERENCES public.teams(id),
  league_id uuid NOT NULL REFERENCES public.leagues(id),
  scheduled_at timestamptz NOT NULL,
  kind text NOT NULL CHECK (kind IN ('schedule','result')),
  team_score integer CHECK (team_score BETWEEN 0 AND 300),
  opponent_score integer CHECK (opponent_score BETWEEN 0 AND 300),
  evidence text NOT NULL CHECK (length(btrim(evidence)) BETWEEN 1 AND 2000),
  request_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  review_note text,
  UNIQUE(submitted_by,request_id),
  CHECK(team_id<>opponent_team_id),
  CHECK((kind='schedule' AND team_score IS NULL AND opponent_score IS NULL) OR
        (kind='result' AND team_score IS NOT NULL AND opponent_score IS NOT NULL AND team_score<>opponent_score)),
  CHECK((status='pending' AND reviewed_by IS NULL AND reviewed_at IS NULL) OR
        (status IN ('approved','rejected') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND reviewed_by<>submitted_by))
);
ALTER TABLE public.hoopdata_manager_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hoopdata_manager_submissions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.hoopdata_manager_submissions TO authenticated;
GRANT INSERT(team_id,opponent_team_id,league_id,scheduled_at,kind,team_score,opponent_score,evidence,request_id) ON public.hoopdata_manager_submissions TO authenticated;
GRANT SELECT,UPDATE ON public.hoopdata_manager_submissions TO service_role;
CREATE POLICY hoopdata_manager_read_own ON public.hoopdata_manager_submissions FOR SELECT TO authenticated
USING(submitted_by=(SELECT auth.uid()));
CREATE POLICY hoopdata_manager_submit_own_verified_team ON public.hoopdata_manager_submissions FOR INSERT TO authenticated
WITH CHECK(
  submitted_by=(SELECT auth.uid()) AND status='pending' AND reviewed_by IS NULL AND reviewed_at IS NULL AND review_note IS NULL
  AND EXISTS(SELECT 1 FROM public.profile_claim_requests c WHERE c.requester_id=(SELECT auth.uid()) AND c.entity_type='team' AND c.entity_id=team_id AND c.status='approved')
  AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.account_type IN ('manager','club_admin'))
  AND EXISTS(SELECT 1 FROM public.teams t JOIN public.teams o ON o.id=opponent_team_id
    JOIN public.leagues l ON l.id=hoopdata_manager_submissions.league_id
    WHERE t.id=hoopdata_manager_submissions.team_id AND t.active AND o.active AND l.active
      AND t.league_id=l.id AND o.league_id=l.id AND t.basketball_type=o.basketball_type AND l.basketball_type=t.basketball_type)
  AND ((kind='schedule' AND scheduled_at>=now()-interval '1 day' AND scheduled_at<=now()+interval '18 months')
    OR (kind='result' AND scheduled_at<=now() AND scheduled_at>=now()-interval '30 days'))
);
COMMIT;
