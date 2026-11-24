# HoopCheck Build 8 — final release readiness

Updated 2026-11-19. PR [#741](https://github.com/jacoriejay-afk/Hoopcheck/pull/741),
branch `release/build8-final`. Previous tested product baseline:
`cd61713919d9b98cdfcb8b54f88141b8ee078610`. The compatibility follow-up below
changes migration 4 and regression coverage; historical CI is not proof for it.

## Compatibility follow-up after production catalog audit

Migration 4 now preserves legacy username matching, men's directory separation,
signatures/defaults and masked country filtering. The new boolean-only
`is_player_country_public(uuid)` RPC reuses canonical player-profile visibility,
moderation and MFA authorization. Its public wrapper is an invoker; the private
helper has an empty search path and no PUBLIC execution grant. It returns false
for absent/hidden/suspended/MFA-denied targets and never returns a country value.

Fresh read-only production metadata was restored into an isolated PostgreSQL 17
database: 101 tables, 110 functions, actual role/column/function/schema ACLs and
policies, synthetic records only. All five candidate migrations passed and rolled
back, preserving Stripe/manual membership access and seeded application records;
Apple remained disabled. No production migrations or records were changed.

Local validation passed: both privacy SQL suites, StoreKit SQL suite, production
catalog rehearsal, root/mobile TypeScript, all 27 native test files (including
eight player-profile cases). Negative controls prove the suite rejects removed
username matching, mixed directories, missing consent authorization and omitted
private-column restrictions. CI now runs these compatibility negative controls.
Remote CI for this follow-up must be checked on its own commit, not inferred from
the six successful workflows on `8c53ea8b`.

Remaining gates: migration 5 still breaks old raw-private-column clients. Exact
Build 7 source was unavailable in the prior audit; minimum-version/support policy
and physical-device validation remain required. Deploy prepared APIs and compatible
web/native readers before separately approving migration 5. MFA activation needs
enrollment/recovery compatibility validation. No merge or hosted rollout is implied.

**Decision: not ready for owner approval to merge and start a production build.**
Automated and isolated database evidence is recorded below. Physical iPhone
startup/touch, live staging/Sandbox, remote version/environment checks and
approved backend rollout/live AASA verification remain gates. Owner-supplied
verified signing evidence is recorded below. No merge, EAS build,
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

## Current PR and release-gate classification (2026-11-19)

Audited PR head: `963ac76c15c7380871814b3e4bd9fcab5fe439a7`.
Latest main: `9e11cb7bf6976174a49562cabf21dddee2f40ffb`.
The audited head differs from tested product source `cd617139` only in two
documentation files. This report update is also documentation-only.

| Check | Classification | Evidence / remaining work |
| --- | --- | --- |
| Product-source CI | VERIFIED | All six linked Actions runs rechecked: completed/success on `cd617139`. |
| Exact audited head Actions | PENDING / NOT RUN | Zero Actions runs on `963ac76c`; historical runs are not exact-head runs. |
| Vercel at audited head | VERIFIED | `hoopcheck`, `hoopcheck-stripe-sandbox`, `next.js`: successful deployments. `app`, `hoopcheckk`: success statuses with “Canceled by Ignored Build Step”. Preview Comments check succeeds. Not native validation. |
| GitHub mergeability | VERIFIED WITH FRESHNESS LIMIT | true / clean, draft; response base SHA remains old main `5f3de0f9`. Synthetic merge also references old main, so this is not a fresh latest-main calculation. |
| Latest-main content integration | VERIFIED | Main advanced only by #742; both added blobs are identical on PR head. No content conflict found. |
| Required-check enforcement | OBSERVED, LIMITED | Prior audit found branch metadata protection disabled and no rulesets; protection-detail API returned 403. Mergeability does not establish release readiness. |
| Apple signing evidence | VERIFIED (owner-supplied) | Identity, entitlement, profile and expiry below; eventual archive and certificate checks remain separate. |
| EAS counter / production variable names | PENDING | Authenticated read-only access unavailable; latest Build 7 history is not counter proof. |
| Live AASA and backend/client rollout | PENDING | #742 is merged; verify live HTTP response and hosted staging compatibility. No production mutation here. |
| Real isolated StoreKit Sandbox | PENDING | Real purchase, restore, cancellation, refund, ownership and sync need isolated backend/configuration. |
| Physical iPhone startup / touch / native UI | PHYSICAL DEVICE ONLY | Test affected iPhone 14 Pro / iOS 26.6.2 and capture freeze logs. Browser and unsigned compile tests do not establish UIKit touch, Face ID, safe areas, keyboard or native lifecycle behavior. |

Keep PR draft. No merge, EAS build, TestFlight submission, production mutation or
Apple credential change was performed for this update.

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
| 4 | `20261119074537_profile_private_field_boundary.sql` | `34215c632e55b582f7331d2f563c19371130d77cec00ce6e60df6d4c6da49e0b` |
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

PR #742 is merged into latest main `9e11cb7bf6976174a49562cabf21dddee2f40ffb`.
Its helper `lib/apple-app-site-association.ts` (blob `a106e2f6`) and single
`app/.well-known/apple-app-site-association/route.ts` (blob `c725e2c7`) are
byte-identical on this PR. No duplicate route, reversion or conflict repair is
needed. The previous production 404 observation concerned old main `5f3de0f9`;
it is historical, not a current live-domain check. Fresh origin HTTP 200 JSON
and Apple CDN/device association verification remain pending.

Verified signing evidence supplied by the owner on 2026-11-19:

| Signing check | Status | Evidence |
| --- | --- | --- |
| Application identifier | VERIFIED (owner-supplied) | `Y778LM35G5.online.hoopcheck.app` |
| Associated Domains entitlement | VERIFIED (owner-supplied) | `com.apple.developer.associated-domains` present |
| Provisioning profile | VERIFIED (owner-supplied) | `K6289M66P8`, expires November 16, 2027 |

This incorporates owner-supplied verified evidence; this audit did not download
or independently decode the profile. Current certificate validity/revocation and
the eventual signed Build 8 archive's identity/entitlements remain separate checks.
No Apple credential was regenerated or changed.

Source configuration: owner `hoopcheck`, project
`62f822cb-ab9a-42ba-8456-007d2822ef70`, SDK 54, version 0.2.0, bundle
`online.hoopcheck.app`, `applinks:hoopcheck.online`. Production profile selects
production environment/channel, remote versioning, autoIncrement and requireCommit;
App Store app ID `6835366982`.

Current remote iOS counter: **PENDING / UNVERIFIED**. Read-only Expo build
history rechecked on 2026-11-19 shows latest production STORE build FINISHED
Build 7 (`346afb80-2759-4bd1-95ec-87a4698dee07`). History does not establish the
current remote version counter. Production autoIncrement would turn 7 into 8,
but the exact next build number is not confirmed.

EAS production variable names: **PENDING / UNVERIFIED**. Available Expo tools
expose neither remote app-version counters nor environment listings. There is
no installed/cached EAS CLI, EXPO_TOKEN is absent, and runtime metadata lists no
configured secrets. Authenticated read-only queries could not be made. No EAS
build or environment mutation was attempted; no secret values were requested,
decrypted, printed or committed.

Expected native names from the release contract (not a verified EAS production
inventory): `EXPO_PUBLIC_SUPABASE_URL`,
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_HOOPCHECK_API_URL`.
Optional telemetry: `EXPO_PUBLIC_SENTRY_DSN`. The config also reads
`SENTRY_ORG` and `SENTRY_PROJECT`. Names/presence alone do not prove valid
values or matching backend configuration.

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
