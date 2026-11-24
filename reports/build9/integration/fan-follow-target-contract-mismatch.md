# Build 9 fan follower-count contract mismatch — 2026-11-21

Isolated project `HoopCheck-PR17-Test` only. Attempted a rollback-only combined follow-table + private RPC candidate rehearsal with two existing fan test profiles, inserting a `target_type='fan'` follow to exercise the fan privacy branch.

**Result: FAILED by expected canonical CHECK constraint.** PostgreSQL SQLSTATE `23514`: `follow_relationships_target_type_check` rejects the fan target. The canonical historical table restricts `target_type IN ('team','player','league')`, while the current private count RPC includes a `('player','fan')` visibility condition. That fan branch cannot be reached by a stored fan follow record under the canonical table contract.

Do **not** silently add `fan` to the CHECK constraint or relax the eligibility RPC; that would introduce a new follow target type without approved product semantics and downstream privacy review. Keep this as an explicit contract decision: either confirm fans are not followable targets and document the defensive fan privacy branch as unreachable, or separately approve and design fan following with all associated RLS, API, notifications, list endpoints and privacy checks.

Independent post-failure query confirmed `public.follow_relationships` absent and `private.get_follow_count` still the null-returning stub. No persistent data/schema changes. This is a blocked test, not a passing fan privacy verification.
