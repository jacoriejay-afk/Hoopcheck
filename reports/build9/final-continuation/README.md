# Build 9 continuation — 2026-11-20

PR #744 remains draft and unmerged. Started at remote head
`4d882de952034153fad0dd66b0e8a37a2c990a2f`; latest main
`9e11cb7bf6976174a49562cabf21dddee2f40ffb` is already an ancestor.

## Permission and recovery evidence

Expanded `profile_private_fields.sql` with explicit authenticated player username
results and fan denial, supplementing existing anonymous, players-only, suspended,
hidden-country, owner edit and MFA AAL1/AAL2 assertions. Commit 13281b12's helper
works without restoring broad profiles SELECT. No additional permission grant is
needed based on this rehearsal.

Ran the suite through Supabase MCP ONLY on HoopCheck-PR17-Test
(`vcprqpjkyubzzcjatdpx`). `scripts/build9-scoped-profile-fixture.py` prints the
exact expanded SQL used. It uses temporary schema names, synthetic identities,
and a transaction ending in ROLLBACK. It omits server-wide hook configuration and
rewrites storage/realtime policy targets to synthetic namespaces too. This verifies
function/policy behavior, not live PostgREST integration or a production catalog.
Result: PASS. Follow-up catalog query returned zero `build9_fixture_%` schemas.
No fixtures remain. Production project was never queried or modified.

Added malformed HTML, empty body and truncated JSON membership reader tests:
all fail closed and recover on a fresh valid response. Existing owner-read,
profile-editor and discovery native tests pass; no new application fix justified
by these tests. Hosted P0 reproduction remains unverified.

## Local checks

- Root and mobile TypeScript: PASS.
- ESLint: PASS, zero errors, 125 existing warnings.
- Native Node suite: PASS, 27 test files.
- Seven security/bootstrap/membership/checkout/StoreKit/AASA/theme test files: PASS.
- Additional membership malformed-body regression: PASS.
- Entitlement matrix: PASS, 10 role/tier cells, 22 entitlements.
- Next production build, bundle audit, theme pairing and Apple certificate tracing: PASS.
  Initial sandbox attempt could not download Google fonts; network-enabled retry passed.
- Metro/Hermes iOS export: PASS, 7.2 MB HBC. Also exported synthetic endpoint bundles.
- Root production audit: zero advisories. Mobile production audit: 4 high, 13 moderate.
  No safe new override verified. Existing dependency-review reproducers show patched
  decode-uri-component breaks CommonJS and image-size 2 breaks Metro filename input.
  Lockfiles, Expo SDK 54, RN 0.81.5 and Metro are unchanged.

Logs beside this report are fresh local evidence. Browser and final CI status are
reported separately at completion; earlier screenshot evidence is historical.

## Backend and design release gates

Reviewed all five unapplied candidates in `../inherited-migrations.txt` and the
staged rollout in `../continuation-release-review.md`. Prepare owner/search RPCs
and compatible readers before private-column restriction. Older installed clients
that directly read private columns remain incompatible with candidate five. MFA
hook reconciliation, catalog hashes, installed-client coverage and separate owner
rollout approval are still mandatory. No migration applied to production and no
hosted migration ledger inferred from source files.

Preserved current Courtside tokens/tab bar and existing five-surface styling.
Full native iPhone visual acceptance in light/dark and large text remains open;
web fixtures cannot establish UIKit, physical keyboard or physical-device polish.
No claim that the complete premium native design is finished.

TestFlight readiness: BLOCKED by native visual acceptance, exact-head unsigned
compile/CI evidence, mobile advisories and backend/installed-client rollout gates.
No merge, EAS, OTA, production migration, billing or subscription change performed.

## Browser recovery checks

Clean-cache synthetic endpoint export: PASS. Edit Profile passed player light/dark,
fan light and coach dark, including failure-retained drafts, save, cover, navigation
and reload. Membership passed player/fan light/dark restore and unsupported-module
safeguards. Home/search/team/league/tab/directory permission checks passed both
themes. Initial cached exports reached sign-in rather than the seeded account;
clearing Metro's cache and rebuilding with explicit fixture endpoints fixed the
harness. These are intercepted synthetic localhost tests, not production tests.

Starting-head remote Actions: HoopCheck CI (44699523031), Mobile App Checks
(44699523104), NATIVE-2 (44699523234), entitlements (44699523123), Launch Test
(44699523117) all PASS. Unsigned compile (44699523038) was cancelled at Xcode;
retried that job and observed StoreKit, permissions and pods pass, Xcode in progress.
No previous-head result is a final-commit CI result.

## Concurrent branch integration

The first push was rejected because the owner branch advanced to `808e6c42`.
Rebased only this new local regression/evidence commit onto that remote head;
preserved all three concurrent commits, including `90c5bcb0` (scrollable group
header/pagination and bounded artwork loading). See `../final-pass/README.md`
for their separate evidence. No force push or history rewrite of remote work.
Fresh local browser results above used starting-head application code; player
profiles, feed, live games and groups also passed their synthetic role/theme
suites. These results must not be substituted for the integrated source's native
iPhone review. Integrated source received another mobile typecheck/native suite.
