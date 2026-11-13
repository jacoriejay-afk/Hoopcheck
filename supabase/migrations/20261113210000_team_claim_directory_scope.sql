-- TEAMHQ additive directory scope: preserve existing coach and team claim submissions.
ALTER TABLE public.profile_claim_requests
  ADD COLUMN IF NOT EXISTS team_directory text;

-- Legacy team claims, if any, are scoped to the historical men's directory.
UPDATE public.profile_claim_requests
SET team_directory = 'men'
WHERE entity_type = 'team' AND team_directory IS NULL;

ALTER TABLE public.profile_claim_requests
  DROP CONSTRAINT IF EXISTS profile_claim_team_directory_check;

ALTER TABLE public.profile_claim_requests
  ADD CONSTRAINT profile_claim_team_directory_check
  CHECK (
    (entity_type = 'team' AND (team_directory IS NULL OR team_directory IN ('men', 'women')))
    OR (entity_type = 'coach' AND team_directory IS NULL)
  );

-- NULL is temporarily allowed for legacy team claim submissions. Never use
-- NULL-scoped claims to grant Team HQ permissions; require an exact directory.
-- Follow-up: update all claim submission paths to send team_directory,
-- then make it mandatory for team claims in a separate validated migration.
