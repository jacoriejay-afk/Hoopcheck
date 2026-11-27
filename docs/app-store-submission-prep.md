# HoopCheck — App Store release preparation

**Status: HOLD — release preparation, not Apple certification.** Updated 2026-11-27. No production activation, additional signed build or public review submission is authorized by this document. The current tracker is [#1073](https://github.com/jacoriejay-afk/Hoopcheck/issues/1073).

## Actual distribution architecture

- Next.js website: https://hoopcheck.online
- Native Expo SDK 54 application: `apps/mobile`, bundle ID `online.hoopcheck.app`, iPad support enabled.
- App Store Connect app ID: 6835366982. Version 0.2.0, TestFlight build 16, signed from `d6b5e7eae08482c3b2aed6cef7e4b29882142e99`. [EAS build](https://expo.dev/accounts/hoopcheck/projects/hoopcheck-mobile/builds/7200a88d-9695-4ec0-9573-c4843a7f0e1c). Do not infer the installed binary contains later commits.
- Compliance integration branch: `integration/appstore-compliance-candidate`. Keep the signed build and concurrent Build 16/17 changes separate; reconcile exact SHAs before any new signed archive.
- Supabase Auth/database/storage, Stripe web billing and native Apple StoreKit. No wrapper migration needed.

## Draft App Store metadata (owner approval required)

| Field | Draft |
| --- | --- |
| Name | HoopCheck |
| Subtitle | Basketball Beyond the Court |
| Primary category | Sports |
| Secondary category | Social Networking |
| Keywords | basketball,overseas,teams,players,leagues,scores,reviews,scouting,career,community,hoops |
| Promotional text | Discover basketball teams, explore player experiences, build your basketball identity and stay connected to the game with HoopCheck. |
| Marketing URL | https://hoopcheck.online |
| Privacy URL | https://hoopcheck.online/privacy |
| Support URL | https://hoopcheck.online/support |
| Support email | HoopCheck@outlook.com (owner to confirm publication and delivery) |
| Terms | https://hoopcheck.online/terms |

### Description draft

HoopCheck brings basketball research and community together for players and fans.

Explore teams, leagues and player experiences before your next career decision. Build your basketball profile, follow teams, discover basketball conversations in HoopFeed and connect with communities. Access game information and schedules where coverage is available.

Membership features vary by account type and plan. Available prices, renewal terms and subscription management are shown in the app. Community reviews reflect contributors' experiences and should be considered alongside independent research and direct verification. Game coverage and updates vary by league and data source.

Before using this copy, confirm each advertised feature on the exact submission build. Do not claim comprehensive coverage, real-time data guarantees, guaranteed contracts or independently verified review outcomes.

### Screenshot storyboard

Use only actual running-app captures with consented or synthetic demo accounts and no personal data. No generated mock screenshots. Validate all required iPhone and iPad display sizes in App Store Connect.

1. Home — Basketball Beyond the Court
2. Team reviews — Know Before You Sign
3. Career profile — Own Your Basketball Journey
4. HoopFeed — Connect Through HoopFeed
5. Games — Stay Close to the Game
6. HoopGroups — Find Your Community
7. Directory — Explore Basketball Worldwide
8. Dark theme — Your Game. Your Style.

Exclude any feature not accepted on the exact archive. Verify app icon, launch screen and accessibility.

## Apple membership catalog

Group: HoopCheck Membership. USD reference prices only; use localized StoreKit pricing and actual offer eligibility.

| Product ID | USD reference | Period | Introductory offer policy |
| --- | ---: | --- | --- |
| hoopcheck.pro.monthly | 4.99 | month | 7 days once if eligible |
| hoopcheck.pro.6month | 26.95 | 6 months | none |
| hoopcheck.pro.annual | 50.90 | year | none |
| hoopcheck.premium.monthly | 9.99 | month | 7 days once if eligible |
| hoopcheck.premium.6month | 53.95 | 6 months | none |
| hoopcheck.premium.annual | 101.90 | year | none |

Do not infer current App Store Connect offer configuration from source constants. Verify all six products, localization, tax category, subscription group, review screenshots, introductory eligibility, purchase, restore, renew, expire, refund/revoke, cross-account rejection and Stripe coexistence using sandbox only. Fan pricing is not authorized by this catalog. Coach and manager purchases are Premium-only in the candidate. No actual payment test without approval.

## Exact-head evidence snapshot

- #1074 and #1076 merged: authentication intent safety and Apple pending-signup database candidate.
- #1077 merged into compliance candidate at `7a7b3455b75e428b1e7450cd18e794df04ca8953`, native social onboarding.
- #1080 head `19a564eb7ac53e228fcbdba82011708d07a9fcb0`: five GitHub workflows passed; unsigned iOS pending; one Vercel preview passed, four rate-limited.
- #1081 head before this documentation update `59ae00d49f65aa168c8e722f2d6c9c9f91f03bbb`: SQL rehearsal [45858070180](https://github.com/jacoriejay-afk/Hoopcheck/actions/runs/45858070180) and orchestration, including actual Apple crypto integration [45858070155](https://github.com/jacoriejay-afk/Hoopcheck/actions/runs/45858070155), passed. Other current-head verification not complete. Synthetic tests do not prove real account erasure or mail delivery.
- #1084 head `bbbbba406c83e72f37e5329dfaef203f8f47eac5`: StoreKit SQL rehearsal and web CI passed; Vercel rate-limited.
- Recheck every exact head, base, merge status and review before integrating. Do not mark preview failure as success or change branch protections. A candidate merged with an infrastructure exception still needs final deployment acceptance.

### Verified integration checkpoint — 2026-11-27

Candidate commit `7d17538964f9578a689bc90bf2bd07550555aa14` includes #1080, #1081, #1084, #1110, #1116 and #1111. The earlier evidence snapshot above is historical, not current PR status.

- #1110 merged schema preflight; 67 missing public tables, five test-only tables and 13 shared-table discrepancies remain. A reviewed schema-only baseline is required; no hosted restore is authorized.
- #1116 merged Apple vault freeze guard after [deletion fixture](https://github.com/jacoriejay-afk/Hoopcheck/actions/runs/45913288433) and [StoreKit fixture](https://github.com/jacoriejay-afk/Hoopcheck/actions/runs/45913288410) passed on head `3cba5153e56c39f80ab74d667fb32e726a25123c`.
- #1111 merged after [real light/dark Passport simulator tests](https://github.com/jacoriejay-afk/Hoopcheck/actions/runs/45915262120), unsigned native compilation, mobile and web CI passed on reconciled head `fa7776d21dac323c3954e4a8b61aa0ac9b5f9f74`. This supersedes the historical startup failure, not physical-device acceptance.

## P0 acceptance gates

### Sign in with Apple

- [x] #1080 merged into the compliance candidate at `01e81e875c8b89d63fd63a40885fcdebb147ee41`.
- [ ] Confirm the signed archive contains the official native button, entitlement, nonce flow and pending-profile gate.
- [ ] Configure the correct Apple App ID/capability and Supabase provider in an approved test environment. Set server signing key and encrypted vault key through protected environment settings. No credentials in this document.
- [ ] Verify first and returning Apple sign-in, relay addresses, account linking safety, cancellation, MFA, age/terms/role onboarding, Google/email regression, credential revocation and failed-vault recovery.

### Account deletion

- [ ] Complete actual fulfillment. The legacy endpoint intentionally returns 409; do not re-enable unsafe hard-delete logic. Candidate flags remain disabled.
- [ ] Verify native Settings > Account > Delete account and web equivalent, recent provider-aware reauthentication, immediate/30-day options, explicit cancellation, subscription instructions and accurate processing duration.
- [ ] Approve a per-category retention policy: erase identifiable content, reviews, messages, media and derived copies unless legally required; retain only demonstrably non-identifiable aggregates and necessary lawful records. Resolve moderation/report holds before deletion. Never promise preservation of identifiable reviews or auto-cancel subscriptions.
- [ ] Complete immutable approved cleanup plans for all auth/profile foreign keys, non-FK references, third-party data, sole-manager ownership, media/storage versions, external video assets, logs/backups and billing records. Current candidates cover limited preferences, reviews with no unresolved report evidence, selected media and Auth identity. Do not equate partial erasure with completion.
- [ ] Rehearse `supabase/candidates/appstore_deletion_apple_vault_freeze.sql` after both the authorization vault and deletion freeze candidates; require frozen-owner insert/update rejection and preservation of existing encrypted credentials for revocation.
- [ ] Enforce freeze across privileged routes, existing signed media credentials, realtime sockets and callbacks. Revoke sessions through a supported path for scheduled requests without retaining user bearer tokens.
- [ ] Configure and verify approved completion delivery provider, verified non-relay contact or an approved alternative, key management, delivery reconciliation and retention/scrub. Resend adapter is a candidate only; no paid service approved.
- [ ] Wire actual effects into the fenced worker and verify full end-to-end deletion in a disposable environment, including legal holds, retry, scope mismatch, cross-account denial, Apple revocation, identity absence and notification. No scheduler or production activation until acceptance.

### Database and deployment

- [ ] Rehearse complete migration chain on isolated database matching production schema: opted-in MFA, StoreKit sources and coverage, deletion ledger, Apple pending signup/vault/gate and all reviewed deletion candidates. Generate migrations using the approved tooling. Candidate files are not deployed migrations.
- [ ] Verify RLS/ACLs, MFA hooks, REST/RPC access, provider callbacks and rollback/recovery plan. Reconcile production schema drift. Do not apply hosted SQL without owner approval.
- [ ] Resolve Vercel rate limits, verify complete integrated candidate and approve deployment separately. Do not alter quotas, billing or projects without explicit authorization.

## Passport release acceptance (separate from compliance integration)

- Owner approved separating the unrelated Passport simulator runtime check from the account-deletion integration gate. Native compilation, StoreKit Swift tests, permission verification, watchdog tests, web/mobile checks and deletion security rehearsals remain intact.
- Exact prior source head `02283938fccbd1f809b345a7c6c190a68d1ffb09`: [native run 45865627317](https://github.com/jacoriejay-afk/Hoopcheck/actions/runs/45865627317) compiled the simulator app but failed the real Passport UI fixture with `No script URL provided` despite successful Metro bundling. Do not record this run as passed. Preserve diagnostics and retain both light/dark runtime assertions in the dedicated `Passport iOS Runtime Verification` workflow. Other branches retain their existing runtime gates.
- [x] Simulator startup repaired in #1111; both real light/dark runtime tests passed on the reconciled head above.
- [ ] Verify the actual Passport experience on the separately approved signed TestFlight release candidate: PDF content/signature, light/dark rendering, native share sheet, dismissal without external transmission, temporary-file deletion, no unexpected permissions. Record actual evidence; do not claim the failed simulator check passed. Physical-device acceptance is required before public release.

## App Store Connect acceptance

- [ ] Confirm account agreements, banking/tax, trader status/territories and age rating using actual business details.
- [ ] Complete App Privacy survey from exact code and SDK data flows (contact details, user content, identifiers, purchases, diagnostics, analytics, usage and any tracking as actually collected). Verify retention and deletion disclosures and privacy policy match working behavior. No guessed selections.
- [ ] Inspect generated archive for privacy manifests, required-reason API declarations, SDK signatures, permission descriptions, entitlements, encryption/export declarations and current SDK submission requirements.
- [ ] Verify reporting, blocking, moderation, support and published community standards on physical devices. Confirm contact channels are monitored.
- [ ] Provide App Review access through secure App Store Connect fields. Demo accounts must not contain real user data and must permit meaningful review of gated features. Supply clear test instructions and subscription review notes.
- [ ] Confirm physical-device results for account/profile/Owner HQ, HoopFeed, HoopGroups/direct messages, Live Games, HoopReels and notifications; these were unverified in the recorded Build 16 owner test. Re-test all core flows on the final approved signed candidate.
- [ ] Obtain separate approval for any additional EAS build and public submission. No current approval for either.

## Reviewer handoff checklist (draft; not submitted)

Use the exact approved signed archive and a disposable, synthetic reviewer account. Supply credentials only through secure App Store Connect review fields, never GitHub. Before providing review access, confirm the following routes on that archive:

| Review flow | Expected evidence before submission |
| --- | --- |
| Login | Official Apple button, first and returning sign-in, email/Google alternatives, cancellation and onboarding; no unsafe account linking. |
| Account deletion | Settings > Account > Delete account, recent reauthentication, confirmation, actual fulfillment and completion notice; no support-email requirement. Do not invite reviewers to test an inactive or simulated deletion path. |
| Membership | Localized price and renewal disclosures, sandbox purchase and restore, subscription management, terms and privacy links. |
| Community | Reporting and blocking accessible in relevant surfaces, moderation and support contact. |
| Passport | PDF export and native share sheet on physical device, both themes. |

If any flow is unavailable, hold submission rather than describing it as working. Reviewer notes must reflect the accepted archive, not the integration branch. Do not supply real user data or owner credentials. Retention decisions, schema baseline approval, provider activation, signed archive and actual deletion/notification evidence remain separate release gates.

## Google Play (separate release)

Android packaging is native Expo; Android publication is not accepted by this iOS preparation. Verify signed AAB, current target API, Play Billing, Data safety, deletion URLs, content rating, reviewer access, device testing and account-specific closed-testing requirements before any rollout.

## Official references

- https://developer.apple.com/app-store/review/guidelines/
- https://developer.apple.com/support/offering-account-deletion-in-your-app/
- https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple
- https://developer.apple.com/help/app-review/before-submitting-for-review/complete-review/
- https://supabase.com/docs/guides/auth/social-sign-in/auth-apple

This guide records preparation and explicit blockers, not a claim of compliance or store approval.
