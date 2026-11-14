# REELS-1 — production follow-policy security finding (2026-11-14)

Verified via read-only production catalog queries:

- `profiles`: RLS enabled, 3 policies.
- `follow_relationships`: RLS enabled, 1 policy: `followers manage own` FOR ALL authenticated, USING and WITH CHECK `auth.uid() = follower_id`.
- Authenticated has SELECT/INSERT/UPDATE/DELETE grants on `follow_relationships`.
- `profiles_own_update` FOR UPDATE checks only `auth.uid() = id` at the row level; check column-level grants, triggers, and server role validation before allowing `creator` in account_type.
- `follow_relationships` lacks a policy-level check for valid person target, block status, or privacy.

## Safe implementation requirements

1. Do not add creator to the DB follow-target constraint until INSERT/UPDATE validation rejects nonexistent targets, mismatched account_type, self-follow, and either-direction blocks.
2. Validate creator role assignment/verification server-side. Never treat self-edited profile fields as verification evidence.
3. Preserve existing team/league/player/fan follows. Test all four existing target types after changes.
4. Enforce private creator visibility in get_follow_count and reel read policies.
5. Confirm follow count privacy and SELECT behavior with real JWTs.
6. Do not broaden existing policies by adding a permissive OR without checking effective combined policies.
7. Only after tests pass, deploy a versioned migration with reversible change notes.

## Current status

The FollowButton TypeScript union now accepts creator in this PR, but production rejects creator follows by constraint. No migration has been applied. This is an intentional staged change, not a completed feature.
