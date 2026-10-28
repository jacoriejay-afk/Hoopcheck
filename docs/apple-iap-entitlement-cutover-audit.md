# Apple IAP entitlement cutover audit

Status: preliminary static audit of the repository's current `main` snapshot (`8cdc4bd`) during Apple IAP foundation work. This is a migration checklist, not proof that every entitlement path has been found. Re-run repository-wide searches and inspect every relevant SQL policy before enabling Apple-backed access.

## Why Apple access is not wired into the live entitlement source yet

The current web subscription model is Stripe-owned: `public.subscriptions` is read by browser pages, server routes, cancellation/portal flows, and database policies. Writing Apple rows into that table or changing its Stripe identifiers would risk overwriting web billing state. The Apple foundation therefore uses separate Apple tables and a provider-neutral resolver, but the resolver is not yet connected to access checks.

## Direct-read paths found in the preliminary search

These paths query `subscriptions` directly and need a deliberate compatibility decision before Apple subscriptions can unlock the same feature:

- Membership display and Stripe customer management: `app/membership/page.tsx`, `app/api/stripe/create-portal/route.ts`, `app/api/stripe/cancel-subscription/route.ts`, `app/api/stripe/webhook/route.ts`.
- Review and review eligibility: `app/api/review-access/route.ts`, `app/api/reviews/route.ts`, `app/api/womens-reviews/route.ts`, `app/womens/[id]/review/page.tsx`, `app/coaches/[id]/review/page.tsx`.
- Membership-gated product surfaces: `app/feed/page.tsx`, `app/fan-feed/page.tsx`, `app/fan-live/page.tsx`, `app/live-games/page.tsx`, `app/teams/[id]/page.tsx`, `app/dashboard/page.tsx`, `app/account/page.tsx`, `app/verification/page.tsx`, `app/players/[id]/page.tsx`, `components/FanBasketballSideSwitch.tsx`.
- Server-side checks and account lifecycle: `app/api/trust-score/route.ts`, `app/api/account/delete/route.ts`.

The search also found SQL policies/migrations that gate reads or writes based on membership, including fan live-game/chat access, review visibility, and player career journey features. This list is intentionally marked preliminary: code search can miss generated SQL, RPC functions, dynamic query construction, or policies that refer to helper functions rather than the table directly.

## Required work before entitlement cutover

1. Enumerate all SQL functions, triggers, RLS policies, views, and grants that derive Pro/Premium access from `subscriptions` or a helper function. Inspect the deployed schema separately; repository migrations are not proof of production schema state.
2. Define one authoritative server-side entitlement API that can combine Stripe and Apple without mutating Stripe-owned columns. Preserve Stripe cancellation/portal behavior and keep web Stripe subscriptions valid.
3. Update every server route and RLS policy that enforces access. Client-only display checks are not authorization.
4. Specify conflict rules for concurrent Stripe and Apple memberships, refunds, grace periods, billing retries, upgrades/downgrades, and expiration. Never downgrade or revoke on out-of-order notifications without reconciling current Apple status.
5. Add integration tests for entitlement reads and RLS, including Stripe-only, Apple-only, both providers, expired/refunded Apple transactions, account deletion, and cross-account transaction replay.
6. Only after review, apply migrations to a staging database and test with Apple Sandbox. Do not apply the foundation migration to production or enable purchases before these gates pass.

## Current safety boundary

- Pro remains $4.99/month and Premium remains $9.99/month.
- Stripe remains the existing web billing source and its rows are not modified by Apple IAP foundation work.
- Apple tables/migration are additive and not applied to any database.
- The membership screen keeps purchase and restore disabled.
- No production deployment, production migration, live payment, or App Store submission is authorized by this audit.
