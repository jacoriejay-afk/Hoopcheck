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

-- The historical trigger grants men's fan-group moderator rights by team_id.
-- Only explicitly men's claims may enter that legacy fan-group namespace.
-- Preserve platform moderators; they must not be deleted on approval.
CREATE OR REPLACE FUNCTION public.transfer_team_fan_group_moderator()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
      IF OLD.entity_type = 'team' AND OLD.team_directory = 'men' AND OLD.status = 'approved'
         AND (NEW.entity_type IS DISTINCT FROM 'team'
              OR NEW.status IS DISTINCT FROM 'approved'
              OR NEW.entity_id IS DISTINCT FROM OLD.entity_id
              OR NEW.requester_id IS DISTINCT FROM OLD.requester_id
              OR NEW.team_directory IS DISTINCT FROM OLD.team_directory) THEN
        DELETE FROM public.team_fan_group_moderators m
        WHERE m.team_id = OLD.entity_id
          AND m.user_id = OLD.requester_id
          AND m.moderator_type = 'club_admin'
          AND NOT EXISTS (
            SELECT 1 FROM public.profile_claim_requests c
            WHERE c.id <> NEW.id
              AND c.entity_type = 'team'
              AND c.team_directory = 'men'
              AND c.entity_id = OLD.entity_id
              AND c.requester_id = OLD.requester_id
              AND c.status = 'approved'
          );
      END IF;
    END IF;
    IF NEW.entity_type = 'team' AND NEW.status = 'approved' AND NEW.team_directory = 'men' THEN
      INSERT INTO public.team_fan_group_moderators(team_id,user_id,moderator_type)
      VALUES(NEW.entity_id,NEW.requester_id,'club_admin')
      ON CONFLICT(team_id,user_id) DO UPDATE
      SET moderator_type='club_admin';
    END IF;
  RETURN NEW;
END;
$function$;

-- Re-evaluate moderator assignment if any ownership dimension changes.
DROP TRIGGER IF EXISTS profile_claim_team_fan_group_moderator
  ON public.profile_claim_requests;
CREATE TRIGGER profile_claim_team_fan_group_moderator
AFTER INSERT OR UPDATE OF status, entity_type, entity_id, requester_id, team_directory
ON public.profile_claim_requests
FOR EACH ROW EXECUTE FUNCTION public.transfer_team_fan_group_moderator();
