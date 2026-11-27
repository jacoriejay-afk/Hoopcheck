-- Review-only candidate. Validate against the full Step 4 baseline before
-- generating a forward migration. Leave the existing API reservation in place.
BEGIN;

LOCK TABLE public.reviews, public.womens_team_reviews IN SHARE ROW EXCLUSIVE MODE;

CREATE SCHEMA IF NOT EXISTS hoopcheck_review_security;
REVOKE ALL ON SCHEMA hoopcheck_review_security FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE hoopcheck_review_security.submission_windows (
  author_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_at timestamptz[] NOT NULL CHECK (cardinality(accepted_at) BETWEEN 1 AND 5)
);
ALTER TABLE hoopcheck_review_security.submission_windows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON hoopcheck_review_security.submission_windows FROM PUBLIC, anon, authenticated, service_role;

-- Preserve recent submissions across rollout, including reviews no longer
-- published. Future or invalid legacy values must not consume future quota.
WITH cutoff AS (
  SELECT statement_timestamp() AS installed_at
), entries AS (
  SELECT author_id, created_at FROM public.reviews
  UNION ALL
  SELECT author_id, created_at FROM public.womens_team_reviews
), recent AS (
  SELECT entries.author_id, entries.created_at,
    row_number() OVER (PARTITION BY entries.author_id ORDER BY entries.created_at DESC) AS position
  FROM entries CROSS JOIN cutoff
  JOIN auth.users ON users.id = entries.author_id
  WHERE entries.created_at > installed_at - interval '24 hours' AND entries.created_at <= installed_at
)
INSERT INTO hoopcheck_review_security.submission_windows(author_id, accepted_at)
SELECT author_id, array_agg(created_at ORDER BY created_at)
FROM recent WHERE position <= 5 GROUP BY author_id;

CREATE FUNCTION hoopcheck_review_security.enforce_submission_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
  caller_role text := auth.jwt()->>'role';
  submission_at timestamptz := statement_timestamp();
  recorded boolean;
BEGIN
  -- Owner/server maintenance runs without an end-user credential.
  IF caller_role = 'service_role' OR (caller_role IS NULL AND actor IS NULL) THEN
    RETURN NEW;
  END IF;

  IF caller_role IS DISTINCT FROM 'authenticated' OR actor IS NULL OR NEW.author_id IS DISTINCT FROM actor
     OR NOT EXISTS (
       SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id = p.id
       WHERE p.id = actor AND u.email_confirmed_at IS NOT NULL
         AND coalesce(p.moderation_status, 'normal') NOT IN ('suspended', 'banned', 'removed')
     )
  THEN
    RAISE EXCEPTION 'Account cannot submit a review' USING ERRCODE = '42501';
  END IF;

  -- The row lock taken by ON CONFLICT serializes concurrent inserts from both
  -- review tables. The quota write rolls back with the review on any failure.
  INSERT INTO hoopcheck_review_security.submission_windows AS current_window(author_id, accepted_at)
  VALUES (actor, ARRAY[submission_at])
  ON CONFLICT (author_id) DO UPDATE
  SET accepted_at = ARRAY(
    SELECT value FROM unnest(current_window.accepted_at) AS previous(value)
    WHERE value > submission_at - interval '24 hours'
  ) || submission_at
  WHERE (SELECT count(*) FROM unnest(current_window.accepted_at) AS previous(value)
    WHERE value > submission_at - interval '24 hours') < 5
  RETURNING true INTO recorded;

  IF recorded IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Review submission rate limit reached' USING ERRCODE = 'PT429';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION hoopcheck_review_security.enforce_submission_window() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER enforce_review_submission_window AFTER INSERT ON public.reviews
FOR EACH ROW EXECUTE FUNCTION hoopcheck_review_security.enforce_submission_window();
CREATE TRIGGER enforce_review_submission_window AFTER INSERT ON public.womens_team_reviews
FOR EACH ROW EXECUTE FUNCTION hoopcheck_review_security.enforce_submission_window();

COMMIT;
