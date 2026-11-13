# SECURITY-FINAL release disposition — 2026-11-12

**Decision: HOLD. Draft PR #527 is not merge-ready.**

## Verified
- Production read-only catalog check: `follow_relationships` exists; `follower_id` and `target_id` are UUID.
- `user_blocks` does not yet exist in production.
- No non-internal triggers on `follow_relationships` at time of inspection.
- Production person-to-person follow data: 1 self-follow; 0 missing follower auth users; 0 missing person-target auth users.
- At commit `4f709a1004b7b8607fd5fb5339d1644a5f7a20f7`, all four workflows passed: Security Final Static Tests, VERIFY-1 entitlement matrix, HoopCheck Launch Test (Final Gate), and HoopCheck CI.
- `main` now includes `supabase/migrations/20261112163000_admin_only_membership_grants.sql` and corresponding regression tests. This supersedes the older admin-only membership *candidate* for code review purposes; production application and authenticated behavior remain unverified.

## Unverified release blockers
1. The blocking SQL is **unexecuted** and needs isolated PostgreSQL tests with real authenticated and anonymous roles, including concurrent follow/block requests, opposite-direction blocks, follow-before-block, unblock/refollow, and rollback behavior. Static checks cannot establish race freedom.
2. The proposed `user_blocks` RLS and `SECURITY DEFINER` trigger permissions require privilege escalation and anonymous-access tests.
3. Service-role API routes, chat/message writes, and privileged social RPCs must enforce blocks before any user-facing block feature ships. The candidate only guards `follow_relationships`.
4. The existing self-follow must be reviewed and removed only under separately approved production write access.
5. The admin-only membership migration has been merged into `main`, but production application and real admin/moderator/user JWT behavior have not been verified. Do not execute the older candidate SQL on top of it.
6. Re-run all required CI and deployment checks on the final candidate commit.

## Change controls
- No merge, deploy, paid infrastructure, or production write is authorized by this document.
- Keep PR #527 draft and block release until all gates above have passing evidence.
- Existing Stripe subscription semantics, membership entitlements, and permanent unified feed behavior must remain unchanged.
