# Build 9 Phase 3D — deployed contract audit and simulator sharing

Draft, release blocked. Exact requested baseline: #752 201792d799ac2c8f1e86be84f4b5adc63a81d820. Phase 3C report was read and clean tree confirmed before creating feature/build9-phase3d-contracts. No missing master was recovered or replaced. Existing branches remain untouched; automatic deployment is disabled for this branch. No merge, deploy, EAS, production DDL/DML, policy/grant change, billing or subscription operation is authorized/performed.

## Hosted audit — metadata only, READ ONLY transaction

Connected HoopCheck project identified by project metadata. The audit used PostgreSQL catalog SELECTs inside BEGIN TRANSACTION READ ONLY / ROLLBACK. No player/customer records, secrets, provider API responses or production data rows were read/exported. Relevant tables/columns, RLS flags/policies, function definitions/signatures and column privileges are retained in checks/hosted-catalog-audit.json. Full public table/function names were enumerated for discovery; evidence minimizes unrelated metadata.

Important correction to source-only assumptions: the hosted public schema has fan_live_games, a service-only provider-team mapping table and season-labelled team_league_memberships, but **no player_career_stops or team_roster_spots**. No public player box-score or verified-award table/RPC was found. The distinct username/owner/country-consent bridge RPCs in the pending source migration are also absent. Canonical hosted get_public_player_profile moderates avatar output and filters visibility; it still returns raw current_country, which native readers already mask unless a separate consent proof succeeds. Legacy directory search returns private country without that newer masking boundary. The audited anonymous/authenticated column grants also allow raw current_country and moderation_note reads. These inherited privacy/installed-client rollout findings remain release blockers; no grants or RLS were changed and no raw fallback was added.

## Reviewed integrations

- app/api/cron/live-basketball/route.ts uses API-Sports date-scoped **team games/scores** with provider-team IDs/mappings and private service credentials. Its GET performs upserts; it was inspected, **not invoked**. It supplies neither provider-player identity mappings nor player stat/award contracts. The provider mapping table has RLS and no client read policy.
- app/api/cron/balldontlie-validation/route.ts is a secret-gated read-only NBA games smoke endpoint; it returns coverage/status counts with persisted:false. No player-box-score/award ingestion or client projection exists in that path. It was not invoked; no provider key was read.
- Source career/roster migrations remain candidates absent hosted. New current rosters cannot be inferred from profile text, public career links, team scores or name-matched provider teams. Professional verification is not a playing award.

## Implemented supported scope

- League clubs now support an exact season filter through the deployed public-read team_league_memberships contract. Explicit historical seasons query only matching membership rows, including inactive historical links allowed by RLS, and never union current direct team links. Current mode preserves active links plus active directory teams. Historical inactive directory clubs remain excluded and copy describes the result as active directory clubs recorded for that season. Inputs are bounded literal text, not inferred calendar seasons or numeric statistics. Loads/errors/empty states, cancellation, retry, bounded results and cross-season stale-response guards are explicit.
- Source-only roster/career candidates are **disabled by default** after confirming their absence hosted. Existing fixture/approved rollout opt-in is EXPO_PUBLIC_ROSTER_RESEARCH_CANDIDATE=1; it grants no permissions and existing role/connection/RLS checks remain in force. Positive browser fixture exports set it only on synthetic localhost builds. Default-build component tests assert zero candidate reads. Box scores, current rosters and awards stay disabled rather than calling nonexistent or unapproved contracts.
- The deployed player_team_affiliations table permits owner/admin reads and admin-only mutations. A new owner-only player-profile panel reads only that owner’s verified, relationship=current records within their recorded start/end dates, hydrates public team names, and excludes evidence_url. Authentication is rechecked before/after loading; cancellation, timeout, retry, empty and capped states are explicit. This is a private verified affiliation record, not a public current roster or a season-statistics claim. It does not add records to Passport or expose verification-request documents. Metadata evidence is in checks/hosted-affiliation-audit.json.
- Added an isolated CI-only simulator entry and XCUITest target using the real Expo Print, Expo Sharing and FileSystem modules plus the production share coordinator/HTML. It verifies a native PDF header/page count/bytes, presents a UIKit activity sheet, dismisses without choosing an external recipient and checks original-file deletion in light/dark simulator appearance. Only the identity adapter is a synthetic fixture; no production auth/data is used. Production package main and Router/auth remain unchanged. The CI runner temporarily changes its own main for the harness and restores it afterward. No test-only auth bypass route is shipped.

## Native evidence boundaries

This Linux workspace has no xcrun. The existing macOS-15 GitHub runner provides the available iOS simulator infrastructure; no billed Expo/EAS simulator is started. The simulator job uploads xcresult bundles, native screenshots, Metro/test diagnostics and a SHA-bound result.json. Adding the harness is not a PASS claim. Actual run results will be recorded separately. A passing harness establishes native module/PDF/activity-controller integration with a fixture identity, not live authentication, full native app design acceptance or physical-iPhone behavior. Build 7 physical freeze verification remains incomplete.

## Release checklist

- [x] Requested baseline preserved; Phase 3C report reviewed; hosted metadata audited read-only.
- [x] No raw-profile or service-role client fallback, provider inference, fake current roster, box score or trophy.
- [x] Season-aware league-club queries, owner-only verified affiliations and default-off undeployed contracts implemented.
- [ ] Actual final-head local/CI checks and simulator runtime evidence recorded/passed.
- [ ] Compatible approved current-player mapping, box-score projection and verified-award provenance/season/permissions contract.
- [ ] Hosted privacy bridge/catalog rehearsal and installed Build 7/old-client compatibility approval.
- [ ] Expo Doctor network gates; real hosted runtime authorization and purchase acceptance.
- [ ] Physical-iPhone touch/keyboard/VoiceOver/performance/freeze verification and independent release approval.


## Simulator attempt history

Run 44890859250 at implementation 5dabe0b7 compiled the unsigned app but failed
before test execution: the generated UI-test bundle resolved an empty PRODUCT_NAME,
producing duplicate -Runner.app/PlugIns/.xctest outputs. No native runtime/share-sheet
PASS or native screenshot is claimed for that attempt. The follow-up sets explicit
product/module names and test-host association, and prints test failure diagnostics.
The original artifact is retained by GitHub Actions; local artifact download through
the shell was proxy-denied, while the GitHub connector retrieved the same artifact.


## Local implementation verification

At implementation e81f2d68 (UI/data code 4d401456), root/mobile TypeScript pass;
223 native behavioral tests pass; 47 auth/billing/permission tests and 14 native
sign-in/callback tests pass. The entitlement matrix passes 10 role/tier cells and
22 entitlements. Full lint has zero errors and 125 inherited warnings. All 12
candidate-fixture browser suites plus the new default-off season/affiliation suite
pass (13 total), in light/dark themes. Native subprocess/browser checks required
execution outside the restricted command sandbox; the completed behavioral suite
was rerun there rather than treating file-level sandbox failures as product results.
Website build/bundle/certificate checks, zero-hardcoded-surface audit and 38 theme
tokens/21 authored pairs pass; website application code is unchanged by this phase.
Candidate/default web exports and default iOS Hermes export pass. Local iOS prebuild
and generated-permission assertions pass. No new protected permission is requested.
Raw logs, baseline CI and screenshot hashes are in checks/; actual default-build
browser screenshots and interpretation are in screenshots/README.md.

Expo Doctor was rechecked: **16/18**, config schema fetch ECONNREFUSED and React
Native Directory unexpected server response remain failed network gates. Nothing
was ignored or marked passed. Final draft-head CI and corrected simulator attempt
are live on #754; this evidence commit does not assert their outcome in advance.
The PR description records the subsequently observed exact-head results and links
to native artifacts. All physical-device gates remain unchecked.
