-- TEAMHQ directory scoping, additive first stage.
-- Existing claims are empty in production as of audit; default preserves legacy team claim writes.
ALTER TABLE public.profile_claim_requests
  ADD COLUMN IF NOT EXISTS team_directory text;

UPDATE public.profile_claim_requests
SET team_directory = 'men'
WHERE entity_type = 'team' AND team_directory IS NULL;

ALTER TABLE public.profile_claim_requests
  ALTER COLUMN team_directory SET DEFAULT 'men';

ALTER TABLE public.profile_claim_requests
  DROP CONSTRAINT IF EXISTS profile_claim_team_directory_check;

ALTER TABLE public.profile_claim_requests
  ADD CONSTRAINT profile_claim_team_directory_check
  CHECK (
    (entity_type = 'team' AND team_directory IN ('men', 'women'))
    OR (entity_type = 'coach' AND team_directory IS NULL)
  );

-- A future change must require the directory in every team-claim ownership check.
-- Do not grant new Team HQ rights from this column alone.
