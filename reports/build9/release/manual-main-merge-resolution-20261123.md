# Build 9 — manual main-history reconciliation (2026-11-23)

**DRAFT DEVELOPMENT-ONLY MERGE CANDIDATE. Production NO-GO.**

## Exact inputs / method

- Common ancestor `896c6c608ea062e4330ca76ff5580191bcaad3df`, tree `524d01d16a14255497bf107c38c9bd42a752638e`.
- Production website main `04b2fb6c38d0a220dd5eb08c324fe81cd38e36b7`, tree `a314b4ef64d9daff550ab2eb5128bad592524703`. **Do not change main or promote a deployment.**
- Proposed first parent `908e31ab67c1999a03aeb585aea26514b0a1c684` (Build 9 integration + draft Settings compatibility fix), tree `d02bfc3ed9b9861a8732e99281d7ddd91ea7e25f`.
- All three Git trees were recursively fetched, non-truncated; every blob compared by SHA and mode. **2,002 paths:** 752 unchanged, 61 identical on both sides, 1,170 Build 9-only changes, **zero main-only** changes/deletions, **19 changed differently on both sides**, and **zero identical-SHA mode conflicts**. Paths new to Build 9 must not be removed. This ledger records explicit decisions for the 19, not a blanket merge policy.
- The proposed two-parent commit includes this ledger and **preserves the Build 9 candidate blob for each of the 19 paths after the review below**. Build 9's files already contain main's functionality or deliberately supersede it with safety/Apple-aware behavior. This is a *manual selection* in a separate review branch; it does **not** certify runtime compatibility, RLS, TestFlight or billing.

## Reviewed choices for exactly 19 overlapping files

| Changed path | Explicit source-resolution decision |
| --- | --- |
| `.github/workflows/ci.yml` | Keep Build 9's larger security, billing, native and realtime test matrix; existing production live-game RLS rehearsal step is already present |
| `app/account/page.tsx` | Keep Build 9 compact Account with production career review, cover selection, messaging and appearance panel already carried forward |
| `app/admin/team-logos/page.tsx` | Keep Build 9's authenticated logo studio, rights confirmation, queue, men/women filters and manual publishing; inspected the current production queue and verified equivalent functionality exists in Build 9 |
| `app/dashboard/page.tsx` | Retain production Home Court integration plus Build 9's role-specific personalized dashboard and Apple/Stripe entitlement logic |
| `app/fan-live/page.tsx` | Preserve production 20-second fallback polling, realtime game updates, per-room messages/presence, server-authorized chat write guard; keep Build 9's **postgame flag OFF** rather than unconditionally granting 2-hour postgame chat |
| `app/feed/page.tsx` | Retain production compact HoopFeed UI and Build 9 moderation/membership protections |
| `app/layout.tsx` | Keep global site layout / PWA safe-area changes and Build 9 app styling |
| `app/live-games/page.tsx` | Keep production live directory/provider status work with Build 9 feature flag and fail-closed game-room access |
| `app/profile/page.tsx` | Prefer Build 9 `getEffectiveMembership` (Apple **and** Stripe); **reject production's older Stripe-only raw-subscription gate** for Career Passport |
| `app/settings/page.tsx` | Include draft Settings fix from PR #874: narrow `readOwnProfile` compatibility projection. Avoid Build 9's earlier direct call to absent production `get_own_profile()`; retain modern Settings workspace/security links |
| `components/TeamProfileHero.tsx` | Keep production team hero/compact label behavior plus Build 9 refinements |
| `lib/game-availability.ts` | Retain status normalization and explicit postgame gate; never infer LIVE from stale quarter data |
| `package.json` | Keep Build 9's Apple receipt verification dependency and extended checks, not production's earlier Stripe-only dependency set; preserve equivalent live-game/HoopGroups test coverage |
| `scripts/check-profile-editor-browser.mjs` | Keep Build 9 test fixture for server membership and compact identity header; production's test flow for cover, edit, team review, profile privacy and Settings navigation is still exercised |
| `scripts/theme-browser-check.mjs` | Retain production's accessible themes and Build 9 expanded theme/light-dark audits |
| `app/hc-ios-glass-refinement.css` | Keep production iOS glass refinements, included within extended Build 9 layout styles |
| `app/hoopcheck-passport-mobile-spacing.css` | Keep production `#career-passport` scroll target handling and added Build 9 Career Journey/editor mobile safe-area rules |
| `scripts/check-profile-groups-live-accessibility.mjs` | Preserve production compact Profile/Groups/Live accessibility checks and Build 9 extended assertions |
| `scripts/test-live-chat-realtime.mjs` | Keep production realtime and 60-minute pregame/closed-game controls; retain Build 9 explicit disabled postgame semantics |

## Negative controls / minimum exact-head CI

- Only an **isolated branch** may point to the candidate merge. No force pushes; use an exact-old-head lease, with first parent equal to that branch's current head and second parent equal to the verified production main SHA.
- A clean Git graph relative to main means only **source ancestry** was reconciled. The GitHub PR to protected integration must remain draft until source code, CI and reviewers accept this actual tree. Do not claim that the existence of a two-parent commit proves correct behavior.
- Require independently SUCCESS exact merged-head website/Playwright English+Spanish, owner/profile/country/RLS synthetic database tests, Apple+Stripe membership/7-day-trial tests, NATIVE-2 Security, entitlement matrix, native TypeScript/Expo export and unsigned genuine iOS simulator/Passport share.
- **Production remains HOLD** until an authorized **production-schema-equivalent PostgreSQL 17** clone with proper function ownership, reviewed migration + rollback, and real JWT AAL1/AAL2 owner/non-owner/Free/Pro/Premium/blocked/suspended/visibility HTTP tests; installed Builds 7 and 8 must pass compatibility on physical devices; Build 9 requires physical iPhone/Face ID/OAuth/Passport acceptance and Apple Sandbox subscriptions, trials, restore, cancel, renewal/refund.
- Never re-enable postgame chat, force privileged function ownership, loosen RLS or profile SELECT grants, trigger paid EAS, deploy to production, change Stripe pricing or touch customer rows to make CI pass.

**Goal:** source-history reconciliation in a disposable review branch, NOT production release permission.
