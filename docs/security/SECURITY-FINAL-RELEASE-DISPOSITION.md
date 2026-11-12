# SECURITY-FINAL release disposition — 2026-11-12

**Decision: HOLD. Draft PR #527 is not merge-ready.**

## Verified
- Production read-only catalog check: `follow_relationships` exists; `follower_id` and `target_id` are UUID.
- `user_blocks` does not yet exist in production.
- No non-internal triggers on `follow_relationships` at time of inspection.
- Production person-to-person follow data: 1 self-follow; 0 missing follower auth users; 0 missing person-target auth users.
- Static security tests and entitlement matrix passed at commit `5d05f24`.
- Main CI and launch final gate were in progress when last checked; do not assume they passed.

## Unverified release blockers
1. The blocking SQL is **unexecuted** and needs isolated PostgreSQL tests with real authenticated and anonymous roles, including concurrent follow/block requests, opposite-direction blocks, follow-before-block, unblock/refollow, and rollback behavior. Static checks cannot establish race freedom.
2. The proposed `user_blocks` RLS and `SECURITY DEFINER` trigger permissions require privilege escalation and anonymous-access tests.
3. Service-role API routes, chat/message writes, and privileged social RPCs must enforce blocks before any user-facing block feature ships. The candidate only guards `follow_relationships`.
4. The existing self-follow must be reviewed and removed only under separately approved production write access.
5. The admin-only membership candidate has not been applied or verified with real admin/moderator/user JWT sessions.
6. Re-run all required CI and deployment checks on the final candidate commit.

## Change controls
- No merge, deploy, paid infrastructure, or production write is authorized by this document.
- Keep PR #527 draft and block release until all gates above have passing evidence.
- Existing Stripe subscription semantics, membership entitlements, and permanent unified feed behavior must remain unchanged.
