# Build 9: non-conflicting current-main source reconciliation (isolated)

**Owner-approved development work. Not release approval.**

- Ancestor: `f8e457055f50abfe1388c82292f05a3f88363f5f`
- Latest reviewed main: `11792fb0ee7eeb7daac8b44696a1b3946c052e2e`
- Target protected Build 9 integration: `7ed57d881db4fa5e5292ab14a01249de9a09faed`
- Copied **exactly 96 main-only source files** by Git blob SHA (no manual rewriting, RLS bypass, or production changes)
- Left **22 three-way conflicting paths completely unchanged** on this candidate. Those require independent human review and merged-head CI; no automatic ours/theirs resolution.

## Safe-path policy
A path was copied only when its Git blob SHA equals the common ancestor in Build 9 and differs from main. No files changed on both branches were copied. No deleted paths or mode conflicts exist in the safe subset. This is **not** a full merge of main into Build 9 and should not be merged directly to production.

## Unresolved two-sided paths
- `.github/workflows/ci.yml`
- `app/account/page.tsx`
- `app/api/stripe/webhook/create-checkout/route.ts`
- `app/api/stripe/webhook/route.ts`
- `app/dashboard/page.tsx`
- `app/feed/page.tsx`
- `app/layout.tsx`
- `app/live-games/page.tsx`
- `app/membership/page.tsx`
- `app/players/[id]/page.tsx`
- `app/profile/page.tsx`
- `app/search/page.tsx`
- `app/settings/page.tsx`
- `apps/mobile/app/feed.tsx`
- `apps/mobile/components/FeedMedia.tsx`
- `apps/mobile/package.json`
- `apps/mobile/scripts/verify-feed-browser.cjs`
- `components/MembershipComparison.tsx`
- `components/PlayerProfileCompletionCard.tsx`
- `package-lock.json`
- `package.json`
- `scripts/check-membership-plans.cjs`

## Release hold
Do not apply SQL, revoke raw profile read privileges, sign or submit an iOS build, deploy or merge #755. Before promoting, check TypeScript, website build, privacy/backend/entitlements, native compile; safely reconcile the 22 paths; verify signed owner/nonowner AAL1/AAL2, real iPhone, Passport sharing, and Apple Sandbox. Existing billing/subscriptions and installed Build 7/8 APIs must stay compatible.\n
## Follow-up guarded checkout reconciliation

Reviewed both changed-source sides of Stripe Checkout and signed trial webhooks. The candidate now includes both main's production-trial isolation and Stripe Tax/redeem/expire guards **and** Build 9's Apple subscription duplication check, account moderation/deletion gates and unpriced Fan purchase restriction. The compact Apple-aware membership UI retains its auth-safety logic, with a fail-closed server trial-status disclosure. These three dual-changed paths are proposed as reviewed reconciliations; **19 remain for manual review**. Full exact-head CI and sandbox acceptance are mandatory.
