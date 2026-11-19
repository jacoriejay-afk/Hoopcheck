# Build 8 final candidate — 2026-11-19

Status: draft release candidate, NOT verified for TestFlight. Branch
`release/build8-final`, PR #741. No production writes or migrations performed.

## Reconciliation

Based on main `5f3de0f95d6dcec6c996d04703dbfbbc7dd693d5`, including #738.
Integrated #733 (`02d01c97`), #732 (`6607f2df`), #734 (`6635e6e8`),
#735 (`2cc510c6`) and #736 (`8ece4ff8`). Git resolved these stacks without
text conflicts. #737 is an issue, not a PR. #739 (`3cd0cdf1`) now includes
an alternative private-country implementation beyond its audit-only description;
its attempted merge conflicted with #735 and was aborted. Select #735's broader
private-field/owner projection, not both competing owner APIs. #736 repairs the
earlier legacy search overload; #735 subsequently installs the protected boundary.

The checkout policy fixture now loads #738's real trial helper modules. Trial
activation remains disabled. Existing financial source selection and Ambassador
commission code are retained; no records are rewritten during reconciliation.

## Read-only production findings

Target: HoopCheck `ucbdceaieyenljcwlhnj`, PostgreSQL 17.11. Catalog inspection
confirmed five-argument search and six-argument paged search; the proposed owner
profile API and effective membership views are absent. `anon` and `authenticated`
retain SELECT on raw `current_country`. Thus the production privacy issue is
still open. The session-level `pgrst.db_pre_request` setting returned null;
inspect authenticator/database role settings before concluding no hook exists.

Migration history includes `20261119142453 stripe_trial_claims_production_20261119`.
The five candidate migrations below are absent from that history. Do not run a
blanket push of all repository migrations: historical versions/names diverge.
No live personal records were queried or copied.

## Proposed deployment order (approval still required)

1. Export the target schema, role/column ACLs, policies, function definitions,
   PostgREST hook settings and migration history through protected tooling.
   Restore schema only to disposable PostgreSQL 17 with synthetic records and
   rehearse the following exact files, including combined ordering. Existing
   synthetic fixtures passing is not a full production-schema rehearsal.
2. `20261118162305_player_profile_country_privacy.sql` — including legacy search.
3. `20261118162456_opted_in_mfa_enforcement.sql` — reconcile any existing hook;
   never overwrite another pre-request hook. Verify AAL1 denial/AAL2 allowance.
4. `20261119043244_storekit_membership_sources.sql` — keep Apple enablement false;
   verify raw Stripe/manual memberships and commissions remain authoritative for
   financial writes, and source-specific cancellation cannot revoke another source.
5. `20261119074537_profile_private_field_boundary.sql` — additive protected APIs.
6. Deploy compatible API/web/native owner readers. Verify all old-client read
   dependencies and decide minimum supported native version before restriction.
7. `20261119075626_restrict_private_profile_columns.sql` — separately approve only
   after compatible-client rollout. Verify effective inherited privileges, direct
   SQL/PostgREST denial, owner editing, public opt-in search, feed and admin access.
8. Verify backend readiness before a signed device build. Separately configure
   Apple Sandbox credentials/notifications and test purchase, restore, pending,
   refund and cross-provider overlaps before enabling Apple billing.

## Rollback requirements

Before deployment capture an approved schema/ACL/hook snapshot and backup/PITR
recovery point. Rehearse forward and reverse operations on the disposable clone.
Within a failed migration transaction, roll back that transaction. After commit,
use reviewed compensating migrations based on the captured definitions, in reverse
dependency order; do not fabricate prior grants or rewrite migration history.

If column restriction breaks clients, pause rollout and prefer repairing the
protected API/client. Restoring captured private-column grants reopens the leak
and requires explicit approval; never grant blanket table SELECT. Keep additive
APIs while any released client depends on them. Restore the exact prior MFA hook
and policies only with approval, recognizing the security regression. Disable
Apple purchase entry points on billing failure but preserve ownership, transaction,
trial and notification records; never drop membership source tables or overwrite
Stripe subscriptions/commissions as a rollback. Restore legacy RPC definitions
only after dependent clients are rolled back, recognizing renewed privacy risk.

## Local verification and remaining gates

- Root/mobile TypeScript pass. ESLint: zero errors, 125 existing warnings.
- All 27 native test files pass.
- Eight backend test files pass after the checkout fixture reconciliation.
- Six isolated PostgreSQL 17 suites pass: player_profile_privacy,
  profile_private_fields, opted_in_mfa, storekit_membership_isolated,
  stripe_trial_claims_isolated, ambassador_hq_isolated. These use synthetic
  schemas/roles/data, not a production schema clone or live Stripe/Apple accounts.
- Full CI, browser suites, entitlement matrix and unsigned iOS compilation are
  running on the PR; previous source-branch successes do not verify this branch.
- Full target-schema rehearsal, protected deletion lifecycle, real authenticated
  account checks, signing/remote build identity, physical iPhone freeze reproduction
  and Apple Sandbox verification remain release gates. No signed EAS build,
  TestFlight submission, OTA, production deployment or main merge was performed.

Local execution logs: `/tmp/hoop-build8-results/`. CI is the durable check record.
Do not call this a completed or verified release until the remaining gates pass.
