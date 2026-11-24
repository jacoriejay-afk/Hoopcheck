# Build 9 historical public follow-list ACL review — 2026-11-21

Isolated project `vcprqpjkyubzzcjatdpx` only.

Created the historical `20261113161000_public_follow_list_privacy.sql` function with the rollback-only canonical follow table. Catalog query inside the transaction returned:
- `has_function_privilege('anon', ..., 'EXECUTE') = true`
- `has_function_privilege('authenticated', ..., 'EXECUTE') = true`
- `pg_proc.prosecdef = true` (SECURITY DEFINER).

This can be consistent with intentional public follower discovery, but means the function's internal privacy checks and definer privileges require careful review before any persistent rollout. Do not grant/revoke or change function security mode solely from this finding.

A subsequent anonymous-role regression attempt **failed** with `P0001 Authentication required` in existing trigger `prevent_user_privileged_profile_fields()` while setting up a private test profile. **Do not count anonymous private follower-list behavior as verified.** The SQL error aborted the transaction. Independent post-query confirmed the follow table and list function were absent.

Next: isolate fixture setup under an authorized profile owner with the required claims, then run anonymous list queries; review function ACL and SECURITY DEFINER ownership. No persistent or production changes.
