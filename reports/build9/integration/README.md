# Build 9 backend integration — 2026-11-21

Release decision: HOLD. This is an integration candidate, not production acceptance.

## Branch reconciliation

New isolated branch `integration/build9-backend-completion-20261121` starts at #752 `201792d7`, which contains #747–#751. Normal merge of #753 `eb5d0435` produced `8c37c382` without conflicts. Existing branches and main were not rewritten. No further visual redesign was introduced. The separate `feature/build9-phase3d-contracts` branch is not incorporated or modified. Existing startup behavior is preserved; owner reports the freeze fixed, physical-device regression evidence remains required.

## Backend implementation

`supabase/candidates/build9_native_profile_editor_write.sql` supplies exactly the 15 native editor UPDATE grants, with a restrictive ownership + MFA policy ANDed with existing policies. It requires RLS, owner RPC, MFA helper and an existing permissive write policy, and rejects unsafe moderation grants. Existing triggers remain in force. No unrestricted UPDATE, private SELECT expansion, production DDL or data writes.

`profile_private_fields.sql` now executes that candidate and verifies a complete native field save with RETURNING id, moderation-write denial and verified-factor AAL1 write denial, alongside existing cross-account/privacy/search tests. This remains synthetic SQL: actual deployed field-lock triggers and PostgREST behavior need staging acceptance.

The Supabase CLI could not generate a migration because it tries to create `/home/agent/.supabase` on a read-only filesystem. The tested SQL remains explicitly a candidate, outside automatic migrations. Promotion into migration history is an outstanding tooling/release preparation task.

## Schema parity and migration dependencies

The missing objects have existing definitions; do not create substitute tables or weaken authorization:

1. Existing subscription schema, private subscriber helper, profile schema, authorization policies and field-lock triggers must be inventoried first.
2. `20261118162456_opted_in_mfa_enforcement.sql`: installs MFA helper, restrictive policies and guarded PostgREST hook. Review any existing hook before execution.
3. `20261119043244_storekit_membership_sources.sql`: defines membership sources, authorizations and security-invoker entitlements view; depends on subscription/private helper contracts. Preserve billing rows and source ownership.
4. `20261119074537_profile_private_field_boundary.sql`: defines owner-read and public-profile/search boundaries.
5. `20261119075626_restrict_private_profile_columns.sql`: removes private raw reads after compatible owner-read clients exist. Build 7 compatibility is excluded.
6. Rehearse the editor write candidate; run the integration gate and write preflight plus real owner/non-owner AAL1/AAL2 PostgREST requests before accepting hosted parity.

Connected Supabase tools were discovered and used for isolated-project metadata and rollback-only rehearsal. Local fixtures demonstrate selected migration contracts; they do not prove complete hosted schema parity or a full historical migration replay.

## Features preserved in integrated source

Existing Home dashboard/team/feed previews, feed posts/replies/reactions/polls/share, games/chat, groups, player research and Passport lifecycle, search/directories and membership preview are inherited from #747–#752. No new fabricated statistics, rosters or awards. Canonical backend contract gaps identified in prior reports remain disabled. Integration does not establish real-data acceptance for every feature.

## Membership/payment verification

Local entitlement matrix and server tests cover existing roles/tiers, trial eligibility/recovery, StoreKit ownership/source synchronization, checkout policy, ambassador invoice/refund adjustments and webhook handling. Isolated SQL covers StoreKit sources, trial reservation uniqueness and ambassador lifecycle. Read-only Stripe test-mode catalog and Tax API calls were performed (details below). No Stripe checkout/payment mutations, Apple Sandbox purchases, renewal, cancellation or restore on a physical device were performed. Those remain acceptance blockers; production billing was untouched.

## iOS release preparation and manual acceptance

Source identity: `online.hoopcheck.app`, version `0.2.0`, associated domain `applinks:hoopcheck.online`; App Store ID `6835366982`. EAS uses remote version counters and production autoIncrement. Current signing credentials, revocation, remote build number and installed binary are unverified. Linux cannot run Xcode unsigned compilation; exact integration commit must pass the macOS CI workflow.

Physical iPhone: cold launch and relaunch, background/foreground, login/reset/logout and account switching, enrolled MFA AAL1/AAL2, profile editing/privacy, all tabs/deep links, feed/media/polls, game refresh/chat, group join/leave/moderation, Passport PDF/share cancellation and cleanup, light/dark/system theme, VoiceOver/large text, touch/scroll/keyboard/loading/error states.

Apple Sandbox: verify eligible seven-day monthly trials and ineligible repeat/yearly cases, each approved product/tier, activation, renewal, cancel/expire, refund/revoke, restore after reinstall, account-switch ownership, duplicate/out-of-order notifications and entitlement synchronization. Confirm sandbox environment and test credentials before any purchase. No real charges.

Final approval gates: hosted schema/ACL/hook inventory and reviewed isolated migration rehearsal; hosted JWT/PostgREST and sandbox payment acceptance; final exact-commit CI including unsigned iOS; current signing/counter evidence; physical iPhone acceptance. No EAS, TestFlight, production deployment/migration or main merge authorized.

## Fresh local verification results

- Root and mobile TypeScript PASS (logs `root-types.log`, `mobile-types.log`).
- Native unit tests PASS: 215/215 (`native-tests.log`). Initial restricted execution failed child-process spawning with EPERM; rerun with process/network permission passed without source changes.
- Thirteen backend/server test scripts PASS: membership reader/matrix, Apple association, Stripe trial/recovery, StoreKit server, bootstrap, MFA, ambassador Stripe, provider validation, checkout policy, feed RLS safeguards and theme arithmetic (`test-*.log`). The initial blanket runner included SQL-negative scripts before their local DB prerequisites and failed; prerequisite-aware reruns below supersede that invocation.
- Eight isolated SQL suites PASS: profile private fields/editor, player privacy, MFA, StoreKit sources, feed RLS, organization visibility, ambassador lifecycle and trial uniqueness. Fixtures use local PostgreSQL 17.12 only, never hosted data.
- Profile, compatibility and MFA deliberate negative controls PASS (`*-negative.log`). These reject the omitted privacy repair, legacy projection regressions and conflicting MFA hook.
- Website production build PASS (`web-build.log`); invalid synthetic Supabase URL causes expected sitemap fetch warnings. Root production audit: zero vulnerabilities. Full audit: seven moderate dev vulnerabilities, no high/critical (`*-audit.log`).
- ESLint PASS: zero errors, 125 inherited warnings. Surface and paired-theme audits PASS.
- iOS and mobile web bundle exports PASS; generated iOS permission/bundle identity check PASS (`ios-export.log`, `mobile-web-export.log`, `ios-permissions.log`). Export is not native compilation or device verification.
- Twelve native web browser suites PASS using synthetic intercepted data: membership, MFA, profiles, profile research/Passport, media, editor, groups, games, feed, discovery, theme preference and design/navigation. See `verify-*-browser.log` and `discovery-rerun.log`. Initial discovery text selector timed out; fixed to target the visible directory test ID and assert the route. This is a test correction, not an app redesign.
- Implementation commit `dd8ddda4`; integration merge `8c37c382`. Draft PR #755: https://github.com/jacoriejay-afk/Hoopcheck/pull/755. Existing #747–#753 remain open/unmodified. Final CI must be checked against the final report/test-selector commit, not substituted from the implementation commit.

Design browser initially timed out in its injected 503 error-state assertion; a final rerun using a terminal 400 rejection passed both themes (`design-final.log`). This separately tests explicit retry UI without transport retries racing the assertion. Original failures remain in diagnostic logs. No remaining failure in the final local verification runs. This does not remove the migration-tooling, hosted acceptance, credential, native compilation, device or release-approval gates above. No claim that all requested Build 9 work is complete.


## Connected isolated environment findings

Supabase `HoopCheck-PR17-Test` (`vcprqpjkyubzzcjatdpx`) is ACTIVE_HEALTHY. Fresh metadata confirms missing `membership_entitlements`, `get_own_profile()`, MFA helper, account deletion requests and Apple billing config. Contrary to older reports, `private.is_active_subscriber()` is present. Recent hosted migrations include `20261121062342 isolate_profile_auth_uid_helper_and_restrict_owner_v2`, newer than the repository profile boundary.

The installed `get_public_player_profile(uuid)` is SECURITY DEFINER, owned by `hoopcheck_public_profile_reader`, with empty search_path. A BEGIN/ROLLBACK rehearsal of the existing MFA → StoreKit → profile boundary → restrictions → editor candidate failed with `42501: must be owner of function get_public_player_profile`. A rollback-only ownership reconciliation attempt was denied too. No persistent hosted schema or rows changed; subsequent inventory confirmed missing objects remained absent. Do not overwrite this newer security work. A connection able to act as the actual function owner, plus reconciliation of this installed scoped-definer contract, is required before schema parity can be restored. This is an authorization/environment blocker, not evidence that local synthetic SQL passed on hosted infrastructure.

Read-only Stripe account selection explicitly used `livemode=false`. Six active USD recurring test prices: Pro $4.99/month, $25.45/six months, $53.89/year; Premium $9.99/month, $50.95/six months, $107.89/year. All six API records are test mode. No prices or approved rules changed. Trial periods are null on Price records; seven-day eligibility is applied by checkout policy and must still be accepted end to end. Tax settings are active with default tax behavior `inferred_by_currency` and tax code `txcd_10000000`; per-price behavior is unspecified. No missing-tax-default defect is established. Product-to-environment deployment bindings and actual checkout tax calculations remain unverified.

CI checked for `1755c298`: root CI, Mobile App Checks, NATIVE-2 Security Tests, entitlement matrix and launch gate SUCCESS; unsigned iOS IN_PROGRESS. Subsequent fixture/evidence commit requires its own CI and is not automatically cleared by these results.

## Scoped-owner continuation

See [the scoped profile reconciliation and hosted handoff](scoped-profile-reconciliation.md) for the catalog comparison, rollback evidence and versioned candidate.
