# Build 9 completion candidate — 2026-11-20

DRAFT / RELEASE BLOCKED. Source is the user-approved clean #746 head
`acbd66b5fae33e7b4b4c530382f8fe53b69834da`, verified against GitHub before
creating `completion/build9-20261120`. No lost-commit reconstruction or alternate
privacy implementation was stacked. All five migration SHA-256 values still
match `../phase1/migration-sha256.txt`; no migration file changed.

## Changes and hosted diagnosis

Production `hoopcheck.online` still resolves to deployment
`dpl_Hc62CWyFuX4jqNiDWsMwEXhWoN2j`, main `9e11cb7`. Fresh unauthenticated GETs
to `/api/membership` and `/api/mobile/purchases/config` both return HTML 404.
That deployed source lacks these routes. This branch builds both routes and
local HTTP probes return JSON 401 `sign_in`, `Cache-Control: private, no-store`.
Production routes were not changed; hosted 404s are not claimed fixed.

The candidate config handler previously initialized Apple signing services even
when billing was disabled. A verified disabled DB config now returns private JSON
with no products, `canPurchase:false` and null environment, without constructing
signing services. Missing schema/config and enabled billing without credentials
remain failures. Purchase/restore authorization and entitlement readers are not
relaxed. The native catalog accepts null environment only for an explicitly
disabled response, verifies owner identity, and never requests priced products in
that state. The membership screen clears obsolete notices on refresh; both-theme
component regressions cover recovery. Existing design, role rules and data readers
are retained.

## Isolated security and compensation

Fresh PostgreSQL 17 container, network none, no published ports, repository read-only.
Seven transaction-based suites pass with zero remaining public tables: private
profile fields, player privacy, MFA, StoreKit, ambassador, Stripe trial claims and
legacy projection design. Organization feed visibility and a fresh-cluster feed
RLS smoke suite also pass. Logs (trailing whitespace normalized) are adjacent. SQL negative controls detect
deliberate privacy/legacy/consent/MFA regressions.

`scripts/rehearse-build9-compensation.py --synthetic` now makes the limited
post-commit containment test reproducible in CI. It commits synthetic forward
fixtures, separately commits a new-purchase-intent privilege pause twice, and
compares every public/billing row, effective entitlements and function definitions.
Existing Apple/Stripe access and sync/notification privileges are retained. It
does not disable billing config, erase financial records, or undo all five migrations.
Wrong-database and TCP preflights reject execution before fixture DDL. The new CI
step exercises the successful socket case and wrong-database rejection.

Synthetic mode explicitly omits the catalog-only current_country ACL assertion
(that fixture lacks the column); independent private-field suites cover privacy.
Default catalog mode retains the assertion. Production-compatible catalog restore,
installed-client compatibility, PITR/restore drill and approved compensating SQL
remain release gates. Local synthetic success does not close them.

## Fresh local verification

- 197 native tests; 16 auth/URL tests; 97 root/backend/security tests: pass.
- Root/mobile TypeScript: pass. Lint: zero errors, 125 inherited warnings.
- All eleven native browser suites pass: membership, MFA, profiles, media, profile
  editing, club groups, Live Games, HoopFeed, discovery, theme preference and design.
  Both-theme membership captures are in screenshots/. Browser fixtures do not
  establish physical-device, real OAuth or hosted acceptance.
- Website production build, bundle/trust-root tracing, hub theme pairing and
  static security/theme/release checks pass. Website discovery/profile/membership
  browser checks and English/Spanish computed-theme checks pass.
- Mobile full/production audits: zero. Root production: zero. Root full: zero
  high/critical, seven moderate development findings. Raw audit JSON is adjacent.
- Vendored dependency provenance against upstream: pass. Expo Doctor: 18/18.
- Local iOS and Android Hermes exports and web export: pass. Agent CLI exports
  omitted synthetic EXPO_PUBLIC configuration; direct Expo CLI with explicit
  synthetic targets and clean Metro cache corrected the fixture. This was a tool
  fallback; application startup/auth protections were not bypassed.

Initial local failures were harness issues: restricted subprocesses, absent local
SQL wrappers, smoke-test role reuse, organization-test working directory, and the
agent export configuration omission. Final tests use subprocess access and wrappers
forwarding only to the networkless database container; no hosted DB is contacted.
Final-head remote CI is recorded in the draft PR, not inferred from #746's checks.

## Approved hosted target readiness — read-only inspection

User approved HoopCheck-PR17-Test (`vcprqpjkyubzzcjatdpx`) and preview-only
`hoopcheck-stripe-sandbox` (`prj_TalEGlZgWszUAeot43ivOICtkbAZ`). Supabase is
ACTIVE_HEALTHY. The Vercel project exists; its latest attempt is CANCELED, while
older READY previews use earlier sources, including `e8bafa4d`, not this head.

Privately inspected preview public URL configuration points to the approved test
Supabase ref, and the Stripe test-target guard matches it. Checkout mode is test;
checkout is already enabled in the preview configuration and was not changed.
The sensitive Stripe secret value is not disclosed by the connector, so key mode
cannot be independently verified. Secret values were not logged or committed.

Test schema inspection finds profiles/subscriptions but lacks membership_entitlements,
apple_billing_config, get_own_profile and public player profile/search RPCs. The
profile schema also lacks candidate reader fields such as position/free_agent,
and account_deletion_requests is absent. Candidate migrations cannot be treated
as an alignment plan for this historical partial fixture without dependency review.
No hosted migrations, accounts, billing records or environment values were changed.

Hosted signup/confirmation/Google/reset and synthetic Player Free/Pro/Premium,
Fan/admin membership acceptance remain BLOCKED at schema and credential readiness.
Next backend action: review/restore the test schema prerequisites in isolation,
compare ACLs/triggers/hooks/RPC contracts, then apply reviewed candidates only to
the named test target. Next sandbox action: privately confirm the Stripe key is
test-only and webhook/prices match; publish the reviewed SHA as a preview only,
then run synthetic auth and subscription acceptance. Never use production as a
fallback. Google sign-in/email completion needs owner-operated test identities.

## iOS preparation and remaining owners

Configuration retains SDK54/RN0.81.5, bundle `online.hoopcheck.app`, project
`62f822cb-ab9a-42ba-8456-007d2822ef70`, remote version source and production
autoIncrement. New `.easignore` excludes secret/key/generated files and preserves
module native sources by anchoring only top-level /ios and /android exclusions.

Read-only Expo listing confirms finished store build 0.2.0 (8),
`f0dd9cd3-cee2-49a7-b541-5485144f377e`, source `c0b77ba3`. EAS CLI whoami
returns Not logged in. Current remote counter and managed certificate/profile
revocation cannot be verified here; next number 9 is conditional on counter 8,
not asserted. Expo/Apple owner must privately verify counter, signing/team/bundle,
entitlements, store history and secure production environment before a separately
authorized build. No signing credential was accessed or changed.

DBA/security/data owners: supply reviewed protected schema-only catalog metadata,
resolve restore fidelity, replay actual installed clients, and approve exact
migration/compensation/PITR procedures. QA/design owner: physical iPhone touch,
startup, lock/MFA, accessibility and both-theme acceptance; real Sandbox purchase
lifecycle and Stripe coexistence remain unrun. UI fixture success is not final
design or device sign-off.

No merge, deployment, hosted schema/data mutation, purchase enablement, EAS build,
update, submission, or production modification was performed. Root/mobile Vercel
configs disable automatic deployment for this completion branch.


## Exact-head CI continuation

Initial head ecfc2d76 passed entitlement, NATIVE-2 and Launch Test checks. Its root
CI successfully executed the committed compensation assertions, then failed at
the negative-control log check because the Ubuntu runner has no rg executable.
The follow-up uses standard grep -Fq for that fixed-string check. This is a runner
portability fix; no application or migration behavior changes. Remote workflows
must verify the follow-up head; initial-head results are not final clearance.
