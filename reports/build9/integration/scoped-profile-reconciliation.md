# Build 9 scoped player profile reconciliation

Reviewed on 21 November 2026 for PR #755. Hosted target is HoopCheck-PR17-Test (`vcprqpjkyubzzcjatdpx`).

## Catalog comparison

| Contract | Installed on isolated Supabase | Repository profile-boundary migration | Reconciliation candidate |
| --- | --- | --- | --- |
| RPC identity | `public.get_public_player_profile(uuid)`, scoped `SECURITY DEFINER`, empty search path | Same named API and return fields, public invoker delegating to an internal definer | Preserves the installed OID, signature, owner, ACL and definer context |
| Audience | Public players and eligible players-only viewers, with scoped reader RLS and a caller-UID helper | Public and players-only; excludes anonymous Auth sessions from players-only | Retains scoped RLS and adds the anonymous Auth check |
| Moderation | Suspended players filtered; avatars masked unless approved | Same result filters | Preserves both filters |
| Current country | Visible only after explicit opt-in, including when caller owns the target profile | Owner exception in player detail | Preserves opt-in-only detail. Private country for the owner is available through the MFA-protected `get_own_profile()` projection |
| MFA | No in-function check; no configured hosted pre-request MFA hook | Detail checks opted-in MFA | Uses the repository boolean MFA helper. Country consent delegates through the same scoped detail API |

Installed ACL grants execute to the owner, anon, authenticated and service_role. There is no PUBLIC execute grant. The reader is NOLOGIN and NOBYPASSRLS. Migration guard checks the observed function body, signature, ownership, ACL, search path and scoped role before replacement. The candidate adds schema usage and execution of the boolean MFA helper for the existing reader. It makes no change to role membership, table grants, RLS policies or profile records.

## Isolated rehearsal

- The SQL connector acts as `postgres`, which is not a superuser. The observed administrative membership edge into the reader has both SET and INHERIT disabled. The scoped reader itself lacks CREATE on `public`.
- A transaction containing MFA and the reconciliation candidate failed at its owner authorization guard with SQLSTATE `42501`. The isolated function was left untouched.
- A rollback-only replay excluding the protected RPC DDL progressed through MFA and StoreKit into the profile boundary. It then failed because `public.follow_relationships` is absent (`42P01`).
- A second rollback-only rehearsal omitted that RPC DDL and the social-suggestions and follower-feed definitions that depend on the missing table. It reached the integration gate after MFA, StoreKit, owner/public profile support, private-column restrictions and the editor write candidate. That is partial catalog evidence.
- The local PostgreSQL 17.12 scoped regression passed real SQL execution with synthetic claims. It covers an idempotent candidate rerun, public country opt-in, owner detail masking, suspended/private rows, pending avatars, anonymous Auth and enrolled AAL1/AAL2.

## Hosted handoff

1. Have the authorized Supabase project operator arrange an existing owner-capable migration execution context for the isolated project. Ask Supabase Support for the supported path if the available project runner is the same `postgres` identity. The executor must already be authorized to replace this function, have schema CREATE and be able to grant the narrowly scoped helper access. The catalog shows a platform-managed administrator as owner-capable. Its presence does not grant this session access. Use the read-only ownership preflight to verify the proposed executor.
2. Reconcile the isolated social prerequisite from the reviewed canonical migration history. `20261006102000_phase8_community_womens_profile_controls.sql` introduces `follow_relationships` together with unrelated data/schema work. Verify the later follow contracts and use a reviewed baseline before any hosted replay. The partial rollback run excluded the dependent APIs rather than constructing substitute tables.
3. In one isolated transaction, replay MFA and StoreKit, then reconcile the profile boundary using the historical migration's owner projection and discovery/social definitions. Where that migration defines `hoopcheck_security.player_profile(uuid)` and the public detail function, substitute `supabase/candidates/20261121103148_reconcile_scoped_public_player_profile.sql` for both definitions and their ACL statements, before the boolean-consent definition. This retains the scoped reader as the sole detail data path. Catalog assertions and dry-run rollback must pass before recording reviewed migration history. Rehearse the separately gated private-column restriction and editor candidate against compatible callers.
4. After approved application in isolation, sign in with disposable owner and unrelated fixtures. Verify owner RPC identity and private field exclusions, country opt-in/opt-out, moderation and players-only visibility, cross-account writes, and every editor field allowed by the installed locks. Confirm enrolled AAL1 receives `mfa_required`, verified TOTP issues an AAL2 session, and an unenrolled AAL1 session retains its intended access. Capture response statuses and redacted assertions without saving tokens.

The candidate is versioned and held outside automatic migration discovery. Exact hosted migration history and hosted authenticated acceptance remain open. Production release remains on hold.
