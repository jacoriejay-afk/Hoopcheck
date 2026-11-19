# HoopCheck Build 8 — final release readiness

Updated 2026-11-19. PR [#741](https://github.com/jacoriejay-afk/Hoopcheck/pull/741),
branch `release/build8-final`. Product source: `cd61713919d9b98cdfcb8b54f88141b8ee078610`.
Documentation-only follow-ups do not change that product source.

**Decision: not ready for owner approval to merge and start a production build.**
Automated and isolated database evidence is recorded below. Physical iPhone
startup/touch, live staging/Sandbox, owner signing/version/environment checks and
approved production backend/AASA rollout remain gates. No merge, EAS build,
TestFlight submission, OTA, production deployment/migration/data/billing change,
credential mutation or paid service provisioning was performed.

## Integrated source and compatibility repair

Based on main `5f3de0f9` (already includes #738), with #733, #732, #734, #735 and
#736 reconciled. #737 is an issue. #739's competing private-country implementation
was inspected but excluded in favor of #735's broader protected profile boundary.
Existing Stripe financial source selection, subscriptions, team/review records
and Ambassador commission handling are retained.

The production-catalog rehearsal exposed a deployment failure hidden by earlier
fixtures: replacing the legacy five-argument search RPC removed production
parameter defaults, which PostgreSQL rejects. Restoring defaults while sharing
the name with the new username API also makes partial calls ambiguous.

Unapplied migrations now preserve `search_public_players` and its defaults and
use `search_public_players_by_username` for new native/web username clients.
No deployed production RPC is dropped/renamed. CI now creates production's
legacy signature before migration and checks zero-argument, partial positional,
full and named username calls. Both privacy SQL suites pass locally.

Other retained fixes: a single native startup modal; first-render navigator;
bounded startup/settings reads; synchronous auth callbacks; identity-bound lock/
MFA state; error recovery. The final startup-recovery fix exposes sign-out errors
that were previously hidden in the loading branch. Media fixtures use the
protected owner RPC. Website theme text uses the existing accessible accent token.
No entitlement/count logic or unrelated design was changed.

## Verification on product source cd617139

| Check | Evidence | Result |
| --- | --- | --- |
| Main CI | [44554658610](https://github.com/jacoriejay-afk/Hoopcheck/actions/runs/44554658610) | PASS |
| Mobile checks | [44554658647](https://github.com/jacoriejay-afk/Hoopcheck/actions/runs/44554658647) | PASS |
| Unsigned iOS compilation | [44554658692](https://github.com/jacoriejay-afk/Hoopcheck/actions/runs/44554658692) | PASS |
| Native security | [44554658620](https://github.com/jacoriejay-afk/Hoopcheck/actions/runs/44554658620) | PASS |
| Entitlement matrix | [44554658605](https://github.com/jacoriejay-afk/Hoopcheck/actions/runs/44554658605) | PASS |
| Launch gate | [44554658573](https://github.com/jacoriejay-afk/Hoopcheck/actions/runs/44554658573) | PASS |

Local checks after the compatibility fix: root/mobile TypeScript, all 27 native
test files, native web export, affected player/discovery browser suites, both
privacy SQL suites and production application-catalog rehearsal pass. Targeted
ESLint: zero errors, two existing image warnings. Previous full lint: zero errors,
125 warnings. The root production dependency audit is blocking in CI; the mobile
install's previously reported dependency advisories are not claimed resolved.

Earlier product source `a8831d81` also passed all six workflows, including Main
[44547930946](https://github.com/jacoriejay-afk/Hoopcheck/actions/runs/44547930946)
and iOS [44547930097](https://github.com/jacoriejay-afk/Hoopcheck/actions/runs/44547930097).
Its eleven native browser suites and English/Spanish strict theme sweeps each
passed 78/78. Tests use synthetic accounts and intercepted localhost traffic.

## Database rehearsal and deployment dependencies

Read-only target: HoopCheck `ucbdceaieyenljcwlhnj`, PostgreSQL 17.11. History has
`20261119142453 stripe_trial_claims_production_20261119`; the five candidate
migrations below are absent. Production still exposes raw current_country and
lacks the new membership views. No real personal/payment records were queried
or copied. Applicable authenticator/database role settings contained no existing
PostgREST pre-request hook; recheck before deployment.

The completed local PostgreSQL 17.12 application-catalog rehearsal restores 101
tables, 110 functions, 202 row policies, actual ACLs/role memberships/default
privileges and relevant constraints/triggers. All five migrations run in order
inside a rolled-back transaction. Assertions cover raw-column denial, masked
search, owner edits, cross-owner denial, Stripe membership RLS/access, AAL1 MFA
denial/AAL2 recovery, prevention of client Apple enablement, and byte-preserved
seeded team/review/Stripe rows. Commission tables remain unchanged; existing
isolated suites cover commission lifecycle and invoice/refund behavior.

This completes the captured **application catalog** migration rehearsal. It is
not a full hosted Supabase clone: platform-owned triggers/services, unrelated
Auth/Storage/Realtime relations, partition routing, nonconstraint indexes,
extension binaries, performance and historical user data are not reproduced.
Hosted staging smoke tests remain required; refresh/rehearse if schema drifts.
See [rehearsal scope, commands and hashes](BUILD8-CATALOG-REHEARSAL.md).

Apply only with explicit owner approval, in this order:

| Order | Migration | SHA-256 |
| --- | --- | --- |
| 1 | `20261118162305_player_profile_country_privacy.sql` | `bea4ed8b6256ce32d0a155b71a61939b336731b1d23e9d3dc7a15c94f4328349` |
| 2 | `20261118162456_opted_in_mfa_enforcement.sql` | `212beab0423eae69baa0fe8416b45b6c35fbe1c42cf793ac66bc14fedf1f62a5` |
| 3 | `20261119043244_storekit_membership_sources.sql` | `c6c48c49769d25c903bb29bd8efa7c7781038a6c87b2e520d22974c26348a708` |
| 4 | `20261119074537_profile_private_field_boundary.sql` | `26fd5ef663c71c3b4c6cff64ed21adc5b8df4d86a5208986f243c58a1cc217ec` |
| 5 | `20261119075626_restrict_private_profile_columns.sql` | `d4c7392ddd914de521ee93ee128318e34b62fb3aa89552baed2e038595ebdb63` |

First four prepare APIs/MFA/membership. Deploy compatible owner and username
readers before separately approving #5's restriction; old raw-column clients
will fail afterward. Decide minimum supported client version. Reconcile any new
MFA hook instead of overwriting it. Keep Apple disabled. Use reviewed deployment
that records exact versions; historical names/versions diverge, so do not blanket
push all repository SQL. Verify prepared API/native bootstrap and existing
Stripe/manual memberships before approving a device build.

Rollback: capture approved schema/ACL/function/hook definitions and a backup/PITR
point first. Failed transactions roll back. After commit, use reviewed reverse-
dependency compensating migrations from that snapshot; never invent prior grants
or rewrite migration history. Prefer repairing protected APIs/clients over
restoring raw SELECT (which reopens privacy exposure and needs approval). Retain
APIs while released clients depend on them. Restoring old MFA policies/hooks
weakens protection and needs approval. Disable Apple entry points on billing
failure but retain transaction/ownership/trial/notification records; never drop
source tables or overwrite Stripe/commission records as rollback.

## Apple association and Expo/signing status

Live canonical domain is verified on Vercel project
`prj_E9zgRLvBt6FcxgwNZ0q9USmrup7s`. Production deployment
`dpl_E7AdYPsgwTcSvTGvDSQHGjaHrEMg` serves main `5f3de0f9`, which lacks AASA.
The origin returns HTTP 404 HTML (proxy CONNECT 200 is not the origin status).
The candidate route returns HTTP 200 JSON locally for
`Y778LM35G5.online.hoopcheck.app`. The concrete fix is an owner-approved deployment
of the reviewed candidate, followed by live response and signed-identity checks.
No production promotion, domain mutation or workaround was made.

Source configuration: owner `hoopcheck`, project
`62f822cb-ab9a-42ba-8456-007d2822ef70`, SDK 54, version 0.2.0, bundle
`online.hoopcheck.app`, `applinks:hoopcheck.online`. Production profile selects
production environment/channel, remote versioning, autoIncrement and requireCommit;
App Store app ID `6835366982`.

EAS CLI is unauthenticated. Build-log connector failed `Transport closed`.
Current managed certificate/profile expiry, Apple team/prefix/capability, remote
counter and native production env remain unverified. Prior Build 7 FINISHED
metadata is not current signing proof. No keys were downloaded or changed.

Vercel variable names/targets, without decryption, show production Supabase URL/
publishable/service-role, Stripe secret/webhook/Pro/Premium prices, checkout
configuration and site URL entries. This does not validate values or EAS env.
Native needs the three matching public Supabase/API variables; optional public
Sentry DSN enables telemetry. Backend/Stripe/Apple secrets must never be native
public variables. Apple-specific entries were absent from returned Vercel
metadata; billing remains disabled by default.

## Frozen-screen evidence and physical test gate

Owner reports iPhone 14 Pro / iOS 26.6.2, Build 7: rendered UI, taps/navigation
unresponsive, onboarding could not be completed. Physical root cause remains
unconfirmed. Build 7 source metadata is `fe9691b7`; it is not this candidate.
No device console/Sentry issue ID supplied. TestFlight crash and screenshot
feedback tools return no submissions; Observe error lookup requires an EAS
subscription. These responses do not establish a crash-free app. No plan change.

Reviewed startup, Router/redirects, splash dismissal, auth/storage, AppState,
gesture/animation roots, lock/MFA and overlay ownership. Source-confirmed modal
and loading defects are repaired. Real-component modal tests (17 cases), auth
integration (14 cases), deadline/account-switch tests and current RN Web startup
scenarios pass. Fresh/restored unfinished onboarding releases input, dashboard
scroll and directory/tab navigation work in both themes. This does not verify
UIKit modal dismissal, native touch, Face ID or absence of a JS/native stall on
the affected iPhone. No outdated simulator artifact was used.

## Remaining owner/live verification

The exact signing checks, approval sequence, iPhone test and freeze-log collection
are in [the final iPhone/Sandbox runbook](BUILD8-IPHONE-AND-SANDBOX-RUNBOOK.md).
Core physical testing keeps billing disabled. Live signup/verification/recovery,
Google PKCE, app lock/MFA, safe areas/keyboard, media, VoiceOver/large text and
real backend integration remain physical/staging gates despite browser coverage.

TestFlight StoreKit is Sandbox. The backend deliberately rejects Sandbox on the
production database/environment. Use a separately approved isolated backend and
test configuration with protected Apple credentials, matching products/group and
signed notifications. Verify purchase/cancel/pending, restore/reinstall/account
ownership, expiry/cancellation/refund, replay/order/API lag, trial eligibility and
both Apple/Stripe tier overlaps on native and web. Production enablement needs
separate approval. No live Sandbox transaction has been claimed passed here.
