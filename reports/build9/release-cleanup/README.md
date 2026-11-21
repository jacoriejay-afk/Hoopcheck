# Build 9 final integration cleanup — release HOLD

Continuation of PR #755 at b26156af. Verified backend security candidates, SQL, RLS and ownership reconciliation are unchanged. Phase 2 and main are unchanged. No deployment, EAS build, production migration or billing mutation authorized or performed.

## Changes

Compatible root development lockfile update: TypeScript ESLint 8.71.0 → 8.73.0 removes the vulnerable nested minimatch chain (GHSA-g3hv-75wg-m249). The seven moderate entries were one advisory propagated through seven packages. Current root audit is zero at every severity. No runtime package manifest, Expo SDK 54, React Native 0.81.5, mobile lockfile or iOS dependency changes.

Webhook fixes: missing price IDs no longer match missing annual/six-month environment variables; tier resolution recognizes six-month and annual environment price IDs as well as monthly. Existing subscription metadata fallback remains. New executed regression covers six configured tier/term mappings and absent configuration. Root CI runs it.

## Stripe read-only reconciliation

Account acct_1ULNpCPfOHVXLGd2, explicitly livemode=false. Six active USD licensed recurring prices across two active products. No additional pages. Approved source: lib/plan-comparison.ts and matching checkout lookup-key/amount guard.

| Tier / term | Existing test ID | Actual USD | Approved USD | Result |
| --- | --- | ---: | ---: | --- |
| Pro monthly | price_1UQT7DPfOHVXLGd245gLa1l3 | 4.99 | 4.99 | matches |
| Pro six months | price_1UQT7LPfOHVXLGd2lHGbiY1o | 25.45 | 26.95 | stale |
| Pro annual | price_1UQT7vPfOHVXLGd27U23LzyF | 53.89 | 50.90 | stale |
| Premium monthly | price_1UQT7xPfOHVXLGd2sr4WVG6I | 9.99 | 9.99 | matches |
| Premium six months | price_1UQT7zPfOHVXLGd2JEj6uJ24 | 50.95 | 53.95 | stale |
| Premium annual | price_1UQT81PfOHVXLGd2BDBotjwN | 107.89 | 101.90 | stale |

Products: Pro prod_VRLo9SxXgOliBZ; Premium prod_VRLopePrdSHHgH. Recurrence is month/1, month/6, year/1 as intended. All price trial_period_days are null; policy supplies seven days only for eligible monthly player subscriptions with verified email, no prior subscription/promo, complete customer lookup and enabled rollout. Do not enable the held rollout prematurely.

Recommended owner correction: create four replacement test prices using approved amounts and lookup keys hoopcheck_pro_6_month_2695_2026, hoopcheck_pro_year_5090_2026, hoopcheck_premium_6_month_5395_2026, hoopcheck_premium_year_10190_2026. Review environment mappings and webhook IDs together; checkout currently fails closed for unavailable approved term keys. Do not substitute stale amounts to make checkout succeed. No Stripe writes performed, including test catalog changes. Live prices were not inspected or changed.

Tax settings active, inferred_by_currency default behavior, default txcd_10000000; products have no tax_code and prices unspecified behavior. Active test registrations list is empty (has_more=false). Therefore tax collection is not verified: no tax is collected without the applicable active registration. Checkout automatic_tax is currently restricted to eligible trials, leaving non-trial checkouts outside that path. Owner must establish approved tax scope and appropriate product classification/registrations before a reviewed change; do not assume account status means tax collection. Actual tax calculations and end-to-end payment/refund acceptance remain open.

Executed server tests cover trial eligibility/recovery, checkout role/source policy, StoreKit synchronization, membership reader, Ambassador invoice/refund/dispute adjustments and webhook safeguards. These fixtures do not prove hosted entitlement synchronization, actual refunds or commission payouts. Deployed secrets/price bindings are unverified.

## Feature integration

Fresh full native unit suite: 215/215; server regression suite: 73/73; auth integration and URL tests pass. Root/mobile TypeScript pass. ESLint zero errors, 125 inherited warnings. Root dependency audit zero. Detailed logs adjacent.

| Surface | Verified contract coverage | Remaining acceptance |
| --- | --- | --- |
| Home | bootstrap, startup recovery, navigation, membership | hosted user dashboard/session data |
| HoopFeed | canonical feed client, moderation/media, polls, RLS safeguards | hosted posting and realtime/media permissions |
| Live Games | games client, score/chat permission and failure contracts | current provider data and hosted chat |
| HoopGroups | directory, join/leave, moderated posting contracts | hosted membership/RLS interactions |
| Player Profiles | scoped owner/public reads, privacy/editor tests | hosted reconciled schema and real JWT matrix |
| Player Passport | profile projections, lifecycle, PDF/share cancellation tests | physical iPhone PDF/share/cleanup |
| Search/directories | search/team/roster client contracts and privacy guards | deployed search and canonical data availability |

Prior b26156af browser suites and local authenticated SQL/HTTP evidence remain valid within their documented fixture limits; no claim of complete hosted feature acceptance. No invented rosters, statistics or backend data; unfinished contracts remain disabled.

## Supabase exact handoff

Keep reports/build9/integration/scoped-profile-reconciliation.md authoritative. Authorized isolated migration runner must already be able to replace public.get_public_player_profile(uuid) as its actual owner hoopcheck_public_profile_reader, have public schema CREATE and grant the narrow MFA helper access. Current postgres has neither SET nor INHERIT into that NOLOGIN scoped reader, and the reader lacks schema CREATE. A managed administrator's catalog presence grants no authorization to this session. Use the read-only ownership preflight and supported project-operator/Supabase path. Do not force ownership, grant role membership or weaken RLS.

Reconcile canonical follow_relationships and installed profile-lock trigger baseline; replay MFA → StoreKit → reviewed profile boundary splice with the scoped candidate replacing both detail definitions/ACL blocks → private-column restriction → editor candidate. Preserve function OID, scoped owner, ACL, SECURITY DEFINER, empty search_path, country consent and avatar/suspension/player-only guards. Rollback rehearsal/catalog assertions precede approved isolated application and migration history. Then repeat hosted owner/non-owner, unenrolled/enrolled AAL1/AAL2 sign-ins, all 15 editor fields, moderation-write denial and cross-owner isolation. No hosted DDL repeated this session.

## Native identity and acceptance

apps/mobile/app.json: online.hoopcheck.app, version 0.2.0, associated domain applinks:hoopcheck.online. App Store ID 6835366982. EAS project 62f822cb-ab9a-42ba-8456-007d2822ef70; remote counters, requireCommit=true, production autoIncrement=true. No local buildNumber proves current remote counter or installed CFBundleVersion. Read-only EAS whoami returned Not logged in; build:version:get --platform ios --profile production --non-interactive --json failed because an Expo account/EXPO_TOKEN is required. Signing validity, team/profile, remote build counter and installed binary require current authenticated evidence. No signing modification.

Physical-iPhone acceptance (pending): record device/iOS, binary version/build/source, cold/relaunch/background, account switch, MFA, owner editing/privacy, Home, feed posting/media/polls, games refresh/chat, groups join/leave/moderation, profiles/search/directories, Passport PDF/share cancellation and file cleanup, light/dark/system, VoiceOver/large text, keyboard/scroll/error/retry.

Apple Sandbox acceptance (pending): record environment, product IDs and sandbox tester; monthly eligible seven-day trial and repeat/six-month/annual exclusions; Pro/Premium approved terms; purchase/activate/renew/cancel/expire/refund/revoke/restore/reinstall; source ownership on account switch; duplicate/out-of-order notifications; server entitlement and Ambassador adjustments. Do not infer Sandbox acceptance from unsigned simulator compilation.

## CI and release recommendation

All six workflows passed on b26156af (baseline-ci.json), including unsigned iOS simulator compilation. Changes require fresh exact-head CI; final results will be recorded on PR #755. Native compilation runs through the existing macOS workflow, not EAS. Local Linux has no Xcode.

Recommendation: HOLD. Remaining external gates: four stale test prices and environment bindings; tax scope/configuration/calculation; actual payment/refund/commission acceptance; authorized hosted migration runner and hosted JWT verification; signing/counter evidence; physical-iPhone and Apple Sandbox acceptance. No merge or release approval implied by green CI.


## Additional final local evidence

Production build and included bundle/theme/Apple trust-root tracing checks PASS. Mobile full and production audit: zero vulnerabilities. Fresh local prebuild and generated iOS bundle/permission assertions PASS. Checkout regression exercises all six approved prices and explicitly rejects all four stale catalog amounts before billing. The complete server script collection was rerun directly, with individual assertions in hoop-server-final.log; the earlier Node runner summary counts file-level tests as well as named cases. Additional privacy/business/moderation checks pass (27 tests). No native module or mobile dependency changes.
