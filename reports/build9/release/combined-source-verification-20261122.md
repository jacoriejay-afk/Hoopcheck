# Build 9 — exact-head combined source verification (2026-11-22)

**Review branch only, not production or TestFlight.** Source ancestry begins with the genuine two-parent main + Build9 candidate PR #822 at `7a4698a8ca8030edb3ef92465bc2be128b4c27a1`, which preserved latest production website, privacy, Stripe/IAP gates, Arena native and Reel moderation. That ancestor failed root and native browser fixtures; it is **not** green release evidence.

## Reviewed native reconciliation

- Source: guarded Build 9 integration `7251aca709108cd661facb752e6c65ec70ec8fee` (merged PRs #813 and #818).
- Applied the exact reviewed native AppOpening interruption handling, iOS Passport Print/PDF/UIActivityViewController XCTest smoke and cleanup, EAS signing identity and fail-closed release-gate ledger, plus the two Vercel preview exclusion configurations. The 30-second **production** Passport deadline and all RLS/entitlement/StoreKit implementations remain unchanged.
- Original input PR #813's exact-head unsigned iOS simulator workflow **passed actual native PDF/share-sheet/cleanup**, along with root and mobile CI. This is not physical iPhone acceptance.

## Independently diagnosed CI regressions from PR #822

1. **Mobile native feed fixture** (`apps/mobile/scripts/verify-feed-browser.cjs`): browser showed `Your account could not be verified`, not a real feed denial. The mocked /api/mobile/bootstrap payload omitted required boolean `canUseLiveGameChat` and `canSwitchBasketballSide`, while `parseNativeAccount()` rightly fails closed if either is absent. Added the two missing fixture permissions without changing the production parser or membership gates.
2. **Web profile completion fixture** (`scripts/check-player-completion-browser.mjs`): a route missed the expected accessible player progressbar, but the old test recorded only the common waitFor line for four pages. Added route-specific and synthetic main-content diagnostics while preserving every numeric progress, free-agent save, visibility and post-save assertion. Exact route/root cause must be diagnosed from the new CI logs; do not call this a pass or delete its assertion.

**Verification gates**: run full combined-head website CI, mobile typecheck/tests/browser fixtures, unsigned iOS native compilation & real Passport smoke, Stripe provider/membership assertions, security and accessible dark/light sweeps. If the browser test still fails, fix the underlying route; if combined source introduces new failures, keep the branch in review. The draft PR targeting the scratch main-reconciled candidate is not a Build9->main merge.

**Still HOLD**: production-schema-equivalent DB and protected function ownership, real Auth-issued owner/nonowner enrolled AAL1/AAL2 signed HTTP verification, installed Build 7/8 compatibility before raw permission restrictions, physical Build9 iPhone start/touch/OAuth/Face ID and Apple Sandbox StoreKit/trial/cancel/refund/restore, final approved bundle/signing/EAS build counter and production rollback plan. No SQL/Stripe/production grant changes, EAS build, TestFlight or store submission are authorized by this report.
