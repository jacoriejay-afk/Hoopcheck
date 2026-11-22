# Build 9 — current main reconciliation, 2026-11-22

## Status: isolated review candidate, NOT release approval

The 2026-11-22 comparison from protected Build 9 integration `7ed57d881db4fa5e5292ab14a01249de9a09faed` to website/security `main` `11792fb0ee7eeb7daac8b44696a1b3946c052e2e` (common ancestor `f8e457055f50abfe1388c82292f05a3f88363f5f`) found **122 main-changed files** and **15 files edited by both sides**.

This isolated candidate staged **107 main-only paths** by exact Git blobs, without overwriting any shared path. Three dependency manifests were then deliberately restored from the protected integration branch after the first Mobile App Checks failed at `npm ci`: main's `apps/mobile/package.json` required Sharp 0.34.5 and incompatible optional binary packages while Build 9's mobile lock pinned 0.35.5; root `package.json` and `package-lock.json` also differed across branches. The integration manifest and lockfile set remains the tested baseline, **not an accidental downgrade of app functionality**. Any new main dependencies must be reviewed as one manifest+lockfile update before approval.

### Seven shared files with disjoint line edits reconciled

- `.github/workflows/ci.yml`: include both independent checks.
- `app/api/stripe/webhook/route.ts`: preserve all independent webhook validation and state-transition checks, including main trial redemptions.
- `app/feed/page.tsx`, `app/layout.tsx`, `app/live-games/page.tsx`, `app/settings/page.tsx`: keep independent web UI/role/locale improvements.
- `apps/mobile/components/FeedMedia.tsx`: preserve both native media behavior and UI changes.

All seven had **zero overlapping diff hunks** against the exact common ancestor, and both edit streams were applied; compile and behavioral tests are still required for semantic compatibility.

### Eight shared paths with overlapping edits manually reconciled

- `app/account/page.tsx`, `app/dashboard/page.tsx`, `app/profile/page.tsx`, `app/players/[id]/page.tsx`: use production-compatible `readOwnProfile` for owner views (live `get_own_profile()` is still absent). Keep protected Build 9 `getEffectiveMembership`, owner-only checks and profile editor field allowlists.
- `app/api/stripe/webhook/create-checkout/route.ts`: preserve Build 9 Apple-versus-Stripe double-billing protection, deletion and moderation gates and fan-no-price hold; add latest-main shared supported-account validation. **Trial rollout remains explicitly disabled** pending actual sandbox acceptance.
- `app/membership/page.tsx`: preserve Build 9 effective entitlement/Apple/Stripe separation, signed billing actions, account-switch safety and the fan paid-product hold; clarify that planned one-time monthly trial is **not currently available at public checkout**.
- `app/search/page.tsx`: deliberately **retain the server-authorized `search_public_players_by_username` RPC** (installed in production by migration `20261122040018`) rather than reverting to a direct raw-profile username lookup. The new dual-path privacy test asserts masked opt-out country, approved-only avatar, hidden/suspended profile exclusion and exact username matching.
- `apps/mobile/app/feed.tsx`: preserve colorful Arena layout, polling and media composer **and** add latest-main persisted per-user Reel hide/mute, report and account blocking, with blocked-creator reads failing closed before Reels can play.

### Prohibited shortcuts / remaining release gates

This is a **source-level reconciliation candidate**, not a completed Git branch merge or tested TestFlight build. Run exact-head root/mobile CI, entitlement, browser, unsigned Xcode compile and iOS Passport tests. The signed production iOS app still requires real iPhone testing, Apple Sandbox purchase/restore/cancel, Apple/Expo signing and build-counter verification, real Auth-issued owner/nonowner AAL1/AAL2 HTTP tests, production-schema-equivalent PostgreSQL 17 rollback rehearsal and legacy Build 7/8 country-column compatibility. Production `profiles.current_country` direct SELECT is not revoked and the protected owner RPC remains absent. Avoid applying the candidate migrations, changing billing, starting EAS, or merging PR #755 until external release gates are independently approved.

Actual real iOS Passport PDF/share-sheet/cleanup simulator tests passed in both themes on [PR #813](https://github.com/jacoriejay-afk/Hoopcheck/pull/813), which was merged into the *protected integration* separately. That simulator result is **not a physical-iPhone or Apple Sandbox pass**.

## CI failure remediation — exact-head follow-up

The imported `Verify scoped Build8 owner profile RPC` step duplicated the existing Build9 `Verify staged owner RPC` and attempted `createdb hoopcheck_build8_owner_test` twice in one workflow, causing the second create to error. Removed only the duplicate import step; the original fail-closed real PostgreSQL test remains intact and unchanged. Root CI must be rerun on this new head; no test is disabled or production database changed.

## Website membership + test reconciliation

The six failing imported test expectations were tied to an older website page. The Build9 source retains provider-isolated Apple/Stripe management, authentication-epoch guards and disabled Fan purchase flow. Adapted the six tests to assert actual source contracts without dropping eligibility, downgrade, cancellation or privacy safeguards. Added an owner billing-support link for manual grants and gated purchase cards behind a verified nonloading account. Public trial-status endpoint is explicitly disabled to mirror the currently hard-off checkout; still checks the canonical production gate, so no environment flag can advertise an unavailable trial. No live Stripe or Supabase setting was changed. Exact-head CI required.

## Native feed browser fixture contract — reconciliation repair

The production native `parseNativeAccount` requires boolean `canUseLiveGameChat` and `canSwitchBasketballSide` fields alongside the other entitlements. The latest-main native Feed/Reels browser fixture replaced Build 9's entitlement mock and omitted those two fields. The real parser correctly denied account access, so protected posts were never fetched; mobile CI correctly failed. Restored the two required boolean fields to the **isolated fixture only**. Preserved main's cross-account Reel hide/block tests and production fail-closed parsing. No real authorization check or membership tier was weakened. New exact-head CI required.

## Real production Reel block privilege fix

Read-only production PostgreSQL confirmed `public.user_blocks` has RLS on and authenticated grants `SELECT=true`, `INSERT=true`, `UPDATE=false`, with **no UPDATE RLS policy** and unique `(blocker_id, blocked_id)`. Thus an `upsert(... onConflict)` would fail against the intentional permissions even though the synthetic browser fixture accepted POST. Replaced the native operation with a plain **INSERT** (allowed by owner-only INSERT policy); duplicate `23505` resolves as success only after an owner-scoped SELECT verifies the exact block row. Other errors remain fail-closed, and existing owner/account identity checks stay enforced. Added a guard preventing this source regression. No production SQL or user data was changed. Real Auth-issued HTTP verification is still required before release.

## Web Reels block RLS hotfix parity

Exact reviewed Git blobs for `app/reels/ReelsViewer.tsx` and its Phase 5 safety guard were carried from independent website hotfix [#825](https://github.com/jacoriejay-afk/Hoopcheck/pull/825) to this Build9 isolated source candidate, to preserve web/native parity. Both files were byte-identical to latest main before the copy; no conflicting Build9 edits were overwritten. Both web and native now INSERT owner-only block rows and verify exact owner-scoped duplicates instead of requiring unavailable UPDATE. Production RLS/grants unchanged. Native/browser and web root CI must pass on new exact head.

## Posts/Reels scope transition native-list fix

The expanded native browser fixture reached a blank Reel view after switching `FlatList` from Posts to Reels while its `viewabilityConfig` and `onViewableItemsChanged` callbacks change. React Native VirtualizedList should not have those props changed on the same mounted list. Keyed `FlatList` by the existing owner+tab `scope` so a tab or account switch creates a fresh list instance and the correct 30%/75% viewability rules are established at mount; also clear stale visible IDs on scope changes. No auth, Reel account block, subscription, RLS, or media access check was relaxed. The fixture now logs only sanitized request paths and JS exceptions on failures, not tokens or post bodies. Exact-head native tests remain required.

## Directory hydration acceptance — CI timing fix

Root CI at `bde22fbe` compiled and reached `scripts/check-team-discovery-browser.mjs`; first-frame Coaches grid link count returned zero before the client directory navigation was mounted. `DirectoryLayout` source still declares four public guest categories (Men, Women, Coaches, Leagues) plus conditional player category. The browser test now waits for four DOM links in the mounted grid before asserting **four accessible links**, selected route and dimensions, preserving every existing visual/layout/route assertion. An actually missing link remains a timeout failure. No server route, page visibility, or permissions changed.
