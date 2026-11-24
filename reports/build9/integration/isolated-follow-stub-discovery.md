# Isolated follow RPC placeholder discovery — 2026-11-21

Read-only `pg_get_functiondef` inspection on HoopCheck-PR17-Test establishes that the two public invoker RPCs are **wrappers**, not independently implemented business logic:

- `public.can_user_follow_target(uuid,text,uuid)` delegates to `private.can_user_follow_target($1,$2,$3)`.
- `public.get_follow_count(text,uuid)` delegates to `private.get_follow_count($1,$2)`.
- The private functions are SECURITY DEFINER, owned by postgres, with empty search paths and explicit postgres/authenticated/service_role execute ACLs.
- **Both private implementations are stubs**: `select null::boolean` and `select null::bigint`, respectively.

Therefore a successful function lookup does not imply functional readiness. The earlier invoker-vs-definer mismatch is explained by the wrapper/implementation split, but **the underlying behavior is still missing**.

## Required safe implementation

1. Compare installed wrappers and private stubs against reviewed canonical eligibility/count semantics and current privacy requirements.
2. Reconcile the canonical follow table and downstream privacy contracts first, preserving RLS, blocked-user filtering and follower-only visibility.
3. Replace only reviewed private stub implementations in an isolated, authorized migration. Keep public signatures, explicit ACLs and empty search paths stable. Do not introduce anonymous EXECUTE, broaden owner permissions or bypass existing row policies.
4. Run owner/non-owner/anonymous integration tests for eligible targets, private profile counts, self-follow restrictions, blocked users and cross-account visibility. Validate non-NULL responses for allowed cases and denial/masking for disallowed cases.
5. The separate `hoopcheck_public_profile_reader` ownership blocker remains open; this finding does not authorize changing that function.

No SQL writes or migrations were executed during this inspection.
