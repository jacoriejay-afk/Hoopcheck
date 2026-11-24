# Build 9 reverse-block root-cause diagnostics — 2026-11-21

The canonical reverse-block failure was reproduced without throwing an exception, in a rollback-only isolated transaction. A fan A followed a public player, fan B blocked A using canonical `user_blocks` RLS, then A invoked the guarded follower-list candidate with simulated authenticated identity.

Diagnostic SELECT returned: `current_user=authenticated`, `auth.uid()=A`, direct `user_blocks` visible row count `0` (correct reverse-block privacy), `get_public_follow_list('following',...,A)` row count `1` (**incorrect**), and the function's `pg_proc.proowner=postgres`. The `postgres` database role has `rolbypassrls=true`; `authenticated` does not.

This confirms the failure and the function owner, **but does not yet prove the precise reason** the SECURITY DEFINER function's block predicate fails. Potential SQL planner/security-context effects require isolated investigation; do not infer that changing the function owner or widening SELECT grants is safe. The candidate remains unapproved.

The entire diagnostic transaction rolled back. No production/persistent changes. Build 9 HOLD.
