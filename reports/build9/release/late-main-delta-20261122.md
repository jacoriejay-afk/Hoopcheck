# Build 9 newest-main reconciliation — source review, HOLD (2026-11-22)

Baseline: development `2c3b06e5409cac7edf242e4eb1477d51ff52515d`; newer production website main `7f4c61844058891ce8555c2a6d3719aea2018e99`; source branch starts from exact Build 9 integration commit.

## Imported without overwriting protected Build 9 code

- 13 main-changed/development-unchanged paths imported at original main blob SHAs, including HoopGroups UI, career team picker, role links, editor CSS, test contracts and a **review-only** HoopGroups candidate SQL. Never install this SQL in production without separate authorization.
- Manually reconciled My Court `HomeCourtSpace.tsx` and its CSS to current main: correct `hc-my-court` class (not legacy decorative `hc-court`), normal-flow mobile editor geometry, role-filtered Team HQ/Agent HQ options and stale choice cleanup. Existing locked HoopFeed fallback and separate local user/role storage are preserved.
- Account page intentionally starts from protected integration and adds three navigation shortcuts plus `RoleQuickLinks`, retaining `getEffectiveMembership` (never replace with raw `subscriptions`), owner/private gating, review eligibility and the two-factor authentication link.
- Both Passport mobile spacing and career/review CSS imports are present in app layout.
- Package build retains the Apple App Store Server dependency and Build 9 Passport checks; adds new HoopGroups control tests as a build gate, with no dependency or lockfile changes.
- `app/dashboard/page.tsx` deliberately retains integration `getEffectiveMembership` against newer-main raw-subscription query. `app/settings/page.tsx` deliberately retains integration `getOwnProfile` and real `/account/security` links, not newer-main fallback to direct profile reads or incorrect security anchors.

## Required review

- Exact candidate-head root CI, typecheck, Next build, both-theme 320/375/390px account/Court editor/HoopGroups browser tests, role/access fixtures, security/entitlement matrix.
- Examine the six former shared paths and compare generated CSS selectors with older `hc-court` decorative art. Confirm `getOwnProfile` compatibility remains a **release gate** because production `get_own_profile()` is absent.
- Revalidate current main and integration before merging; this review branch is not intended to replace newer production changes in main.
- #836 exact six-head CI integration gate and subsequent merged-branch push checks must pass separately.

## Explicit release hold

Production-schema-equivalent PostgreSQL 17 migration rehearsal/rollback; valid owner/non-owner AAL1/AAL2 signed HTTP; private country/grant review and installed Build7/8 client compatibility; physical iPhone startup/OAuth/Face ID/Passport share; real Apple Sandbox/StoreKit subscriptions, one-time monthly trial, restore/cancel, approved signing identity and build counter. No production Supabase/Stripe mutations, EAS, store submission, TestFlight or release #755 merge.
