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

## Phase 3/4 continuation — 2026-11-19

### Frozen screen investigation

Owner identifies the affected hardware as iPhone 14 Pro, iOS 26.6.2, TestFlight
0.2.0 (7); interface rendered, taps/navigation failed and onboarding could not be
completed. No device console or Sentry issue ID is available. Issue #699 remains
open. The exact physical freeze root cause is **not established**.

Expo reports production Build 7 `346afb80-2759-4bd1-95ec-87a4698dee07` finished,
source `fe9691b7d619e92370ac498169f7b36d8b64d1c2`. This is not the current branch.
The crash connector returns “No crash submissions found” as an error response;
that is not evidence of a crash-free app. Sentry requires an issue ID not supplied
here. No runtime logs could be inspected. The existing simulator binary at
`579a495c` was deliberately not used as current-source evidence.

Reviewed Router root/redirects, splash deadline/dismissal, auth bootstrap and
serialized credential storage, AppState/Face ID, route animation/gesture root,
MFA, onboarding and modal ownership. Existing repairs mount Stack on first render,
bound session/settings reads, keep auth callbacks synchronous, and give AppLock
sole ownership of native startup presentation. These repairs remain intact.

Confirmed additional defect: during startup recovery, normal-sign-in failure set
`message` but the loading branch never rendered it. A real-component regression
with rejected/errored sign-out fails before the fix and passes afterward. The
alert now renders in both recovery and unlock states; recovery announces pending
sign-in. Concealment and real SIGNED_OUT requirements remain unchanged. Credential
writes are not timed out or abandoned. This is not claimed as Build 7's cause.

Current-source RN Web tests now cover fresh launch and restored auth with
unfinished onboarding: Skip dismisses the modal, dashboard scroll reaches Sign
out, directory link and Home tab accept input, in both themes. Mock team-directory
responses now preserve array versus object response shapes. No UIKit/Face ID or
physical-device success is inferred from browser/component tests.

### Native/website verification matrix

All browser traffic is intercepted with synthetic accounts/data on localhost.

| Area | Evidence | Still required |
| --- | --- | --- |
| Startup and touch | New fresh/restored onboarding, scroll, directory/tab tests in light/dark; component hydration/lock/identity/deadline regressions | Current iOS runtime and physical iPhone reproduction |
| Login/Google | 14 existing auth integration cases: normalization, PKCE URL/exchange, denied/missing callback, return destinations, pending font navigator | Live Google/account sign-in on device |
| Signup/password reset | Source reviewed; configuration/route isolation retained | Live verification email/recovery deep-link lifecycle; not claimed end-to-end verified |
| Home/navigation/team/league | Native discovery and design browser suites pass, including narrow viewport and artwork/fallback | iOS gestures/safe areas/keyboard |
| Player profiles/editor | Role/privacy, owner RPC, save-error retained drafts, avatar moderation and locked identity pass | Actual target RPCs and test accounts |
| HoopFeed | Post moderation, draft/reply/check/save/poll/Reels, alerts/account/search/home pass; denied membership starts no protected query | Physical playback/permissions and live integration |
| Live Games/chat | Fan Pro both themes; player/free/fan/coach gates, predictions, send/error/draft/report/mute/restore/block pass | Live provider/Realtime/iOS behavior |
| HoopGroups | Both themes: discovery/join/moderated post/draft/comment/report/leave/privacy pass | Hosted integration |
| Membership/MFA | Unsupported module/restore safeguards, role gates, MFA challenge/recovery/enrollment/removal pass | Real StoreKit and authenticator/device checks |
| Themes/states | Native theme overrides, persistence, system changes, failed saves, empty/error/retry cases pass | Physical Dynamic Type/VoiceOver |

Material website defect found by strict CI: small “Use device setting” text used
brand orange on white. Switched that rule to existing `--hc-accent-text`, preserving
layout and native design. Media CI fixture now mocks authenticated `get_own_profile`
instead of assuming raw profile reads. No entitlement or real count logic changed.

Local checks: all 27 native test files pass, mobile TypeScript pass, auth/URL
integration pass, targeted ESLint zero errors (one existing AppLock cleanup-ref
warning), web production build/bundle/theme pairing/Apple trust-root tracing pass.
Native web export passes. Full production theme sweeps are recorded below when
complete. Screenshots remain local under `/tmp/hoopcheck-native-ui` and CI artifacts.

### Expo identity and signing

Repository config: owner `hoopcheck`, slug `hoopcheck-mobile`, project ID
`62f822cb-ab9a-42ba-8456-007d2822ef70`, SDK 54, version 0.2.0, bundle
`online.hoopcheck.app`; associated domain `applinks:hoopcheck.online`.
Production profile selects production environment/channel with autoIncrement;
remote app version source and requireCommit are enabled. Submission App Store
ID is 6835366982. These are source/config checks, not remote ownership/signing proof.

CLI `whoami` returns Not logged in. Remote `build:version:get --platform ios
--profile production --json` fails requiring an Expo account. `project:info` and
simulator availability also fail (config subprocess exit 7). No authenticated
CLI release configuration, credentials validity/expiry, team ID, remote counter,
or current simulator session is verified. Connector build metadata works but does
not expose signing proof. Earlier failed Build 7 attempt lacked Associated Domains;
its later successful build alone cannot prove current signing capability.

Read-only request to the live canonical AASA URL returned HTTP 404. The candidate
AASA route exists and its automated contract passes, but deployment plus verified
app identifier prefix is required for universal links. No production change made.

### Environment, backend and Apple release gates

Native build needs public `EXPO_PUBLIC_SUPABASE_URL`,
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_HOOPCHECK_API_URL` targeting
the same prepared environment; optional `EXPO_PUBLIC_SENTRY_DSN` enables telemetry.
Never embed service-role, Stripe or Apple private keys in EXPO_PUBLIC variables.
Actual remote production variable presence/values are unverified without CLI access.

Backend needs Supabase URL/publishable/service-role configuration, provider-correct
Stripe settings, `HOOPCHECK_IOS_APP_IDENTIFIER_PREFIX` for AASA, and the five
migration files in the order above. Full production-schema rehearsal is **still
required**, including role inheritance, hooks, views/RPC signatures and retained
Stripe/manual memberships and Ambassador commissions. Isolated synthetic fixtures
are not that rehearsal. Earlier catalog read found no db_pre_request in applicable
authenticator/database role settings; recheck immediately before deployment.

Apple remains disabled. Sandbox requires an isolated nonproduction backend and
`APPLE_IAP_ENVIRONMENT=Sandbox`, API key ID/issuer/private key in protected backend
configuration, enabled isolated database config, matching products/group/pricing/
trial metadata, notifications endpoint and authenticated owner-bound sync routes.
The code intentionally rejects Sandbox against the production database. Never
turn it on there to test. Verify purchase/success/cancel/pending, restore, account
switch ownership, cancellation retaining paid-through access, expiry, refund/
revocation, notification replay/order, upgrades/downgrades, trial eligibility,
API-lag acknowledgement and both Apple/Stripe tier overlaps. Preserve provider-
specific billing controls and commission financial sources. None of these live
Sandbox cases has been performed here.

Decision: **not ready for approval to merge and start a production build** until
physical freeze/runtime evidence, CI/unsigned compilation, target backend rehearsal
and rollout, live account/Sandbox checks, signing/version/env and AASA gates close.
No production EAS build, submission, merge, OTA, production migration or billing
change was performed.

### Verification snapshot for product source `a8831d81e8747bf2ed272e092ac7ecf1342c4c4b`

Local English **78/78** and Spanish **78/78** strict website route/theme checks
pass, with guest/system-theme navigation and live language switching. All eleven
native browser suites pass, including the expanded startup scenarios. Modal cases:
17/17; auth integration: 14/14. StoreKit server, website membership reader and
checkout policy tests pass. These are current-source results, not old artifact tests.

| GitHub check | Run | Observed result |
| --- | --- | --- |
| Mobile App Checks | [44547930288](https://github.com/jacoriejay-afk/Hoopcheck/actions/runs/44547930288) | PASS, including all browser suites, Expo doctor, iOS permissions and Hermes export |
| Native security | [44547929965](https://github.com/jacoriejay-afk/Hoopcheck/actions/runs/44547929965) | PASS |
| Entitlement matrix | [44547929980](https://github.com/jacoriejay-afk/Hoopcheck/actions/runs/44547929980) | PASS |
| Launch gate | [44547930195](https://github.com/jacoriejay-afk/Hoopcheck/actions/runs/44547930195) | PASS |
| Main CI | [44547930946](https://github.com/jacoriejay-afk/Hoopcheck/actions/runs/44547930946) | IN PROGRESS at snapshot; SQL/security/lint/build/profile checks already pass; remaining browser/theme steps pending |
| Unsigned iOS | [44547930097](https://github.com/jacoriejay-afk/Hoopcheck/actions/runs/44547930097) | IN PROGRESS at xcodebuild; Swift product tests, prebuild, permissions and Pods pass; compilation success not claimed |

For comparison, source `93541ea6` main CI failed the account contrast assertion
(run 44545943182) and Mobile failed the obsolete media fixture (44545942913).
Both failures were reproduced/repaired and their local replacement suites pass.
A documentation-only follow-up records this snapshot without rerunning builds;
product verification is pinned to `a8831d81`, not inferred for a different code tree.
