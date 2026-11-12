-- SECURITY-FINAL: DRAFT CLEANUP ONLY. DO NOT EXECUTE ON PRODUCTION.
-- Preflight found one existing self-follow among person targets.
-- Do not remove team/league follows or assume the row is harmless.
-- Inspect count first, then execute the DELETE only after explicit approval.
SELECT count(*) AS self_follow_count
FROM public.follow_relationships
WHERE target_type IN ('player','fan') AND follower_id=target_id;

-- Intentionally commented out. Requires separate production write approval.
-- BEGIN;
-- DELETE FROM public.follow_relationships
-- WHERE target_type IN ('player','fan') AND follower_id=target_id;
-- COMMIT;

-- Verify after authorized cleanup:
-- SELECT count(*) AS remaining_self_follows
-- FROM public.follow_relationships
-- WHERE target_type IN ('player','fan') AND follower_id=target_id;
