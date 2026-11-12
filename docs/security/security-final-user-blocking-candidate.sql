-- SECURITY-FINAL: DRAFT ONLY. DO NOT EXECUTE ON PRODUCTION.
-- Minimal database-enforced person-to-person block foundation.
-- Not a complete product release: privileged reads, messaging, and feed routes
-- still require server-side block enforcement and isolated tests.
BEGIN;

CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT user_blocks_no_self CHECK (blocker_id <> blocked_id)
);
CREATE INDEX IF NOT EXISTS user_blocks_blocked_id_idx ON public.user_blocks(blocked_id);
-- Idempotent creation does not automatically establish a secure ownership
-- policy on an existing table; production preflight must verify the schema.

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_blocks FROM PUBLIC, anon;
GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
DROP POLICY IF EXISTS user_blocks_select_own ON public.user_blocks;
CREATE POLICY user_blocks_select_own ON public.user_blocks FOR SELECT TO authenticated
USING (blocker_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS user_blocks_insert_own ON public.user_blocks;
CREATE POLICY user_blocks_insert_own ON public.user_blocks FOR INSERT TO authenticated
WITH CHECK (blocker_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS user_blocks_delete_own ON public.user_blocks;
CREATE POLICY user_blocks_delete_own ON public.user_blocks FOR DELETE TO authenticated
USING (blocker_id = (SELECT auth.uid()));

-- Both block creation and person-to-person follows acquire the same
-- transaction-scoped pair lock BEFORE reading or changing the relationship.
-- IMPORTANT: the lock helper runs as the function owner and is only called
-- through internal triggers, not exposed as a user-callable RPC.
-- A hash collision only serializes unrelated pairs; it cannot bypass checks.
CREATE OR REPLACE FUNCTION public.security_final_lock_user_pair(p_a uuid, p_b uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $lock$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      least(p_a::text, p_b::text) || ':' ||
      greatest(p_a::text, p_b::text), 0
    )
  );
END
$lock$;
REVOKE ALL ON FUNCTION public.security_final_lock_user_pair(uuid,uuid)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.security_final_lock_block_pair()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $lock$
BEGIN
  PERFORM public.security_final_lock_user_pair(NEW.blocker_id, NEW.blocked_id);
  RETURN NEW;
END
$lock$;
REVOKE ALL ON FUNCTION public.security_final_lock_block_pair()
FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS security_final_lock_block_pair ON public.user_blocks;
CREATE TRIGGER security_final_lock_block_pair
BEFORE INSERT ON public.user_blocks
FOR EACH ROW EXECUTE FUNCTION public.security_final_lock_block_pair();

-- SECURITY DEFINER trigger avoids relying on the caller's limited RLS visibility
-- of the *other* user's block records.
CREATE OR REPLACE FUNCTION public.security_final_reject_blocked_follow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
BEGIN
  IF NEW.target_type IN ('player','fan') THEN
    PERFORM public.security_final_lock_user_pair(NEW.follower_id, NEW.target_id);
    IF NEW.follower_id = NEW.target_id THEN
      RAISE EXCEPTION 'Cannot follow your own account' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE (b.blocker_id = NEW.follower_id AND b.blocked_id = NEW.target_id)
         OR (b.blocker_id = NEW.target_id AND b.blocked_id = NEW.follower_id)
    ) THEN
      RAISE EXCEPTION 'Follow not permitted' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END
$fn$;
REVOKE ALL ON FUNCTION public.security_final_reject_blocked_follow() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS security_final_reject_blocked_follow ON public.follow_relationships;
CREATE TRIGGER security_final_reject_blocked_follow
BEFORE INSERT OR UPDATE OF follower_id, target_type, target_id
ON public.follow_relationships
FOR EACH ROW EXECUTE FUNCTION public.security_final_reject_blocked_follow();

-- Block creation removes existing person-to-person follows in both directions.
-- Both block and follow writes now share the same transaction-scoped pair lock.
CREATE OR REPLACE FUNCTION public.security_final_block_cleanup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
BEGIN
  DELETE FROM public.follow_relationships fr
  WHERE fr.target_type IN ('player','fan')
    AND ((fr.follower_id = NEW.blocker_id AND fr.target_id = NEW.blocked_id)
      OR (fr.follower_id = NEW.blocked_id AND fr.target_id = NEW.blocker_id));
  RETURN NEW;
END
$fn$;
REVOKE ALL ON FUNCTION public.security_final_block_cleanup() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS security_final_block_cleanup ON public.user_blocks;
CREATE TRIGGER security_final_block_cleanup
AFTER INSERT ON public.user_blocks
FOR EACH ROW EXECUTE FUNCTION public.security_final_block_cleanup();

COMMIT;

-- RELEASE BLOCKER: validate concurrent block/follow transactions in isolated tests.
-- RELEASE BLOCKER: test existing trigger interactions and role grants.
-- RELEASE BLOCKER: audit SECURITY DEFINER social RPCs and service-role routes.
