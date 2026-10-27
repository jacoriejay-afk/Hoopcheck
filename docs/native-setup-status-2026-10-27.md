# Native rollout status — 2026-10-27 (continued audit)

## Entitlement audit findings from repository code
- `app/membership/page.tsx` reads one row per user from `public.subscriptions`, including `plan`, `status`, `current_period_end`, `cancel_at_period_end`, and `stripe_subscription_id`.
- The Stripe webhook writes/upserts the same row on `user_id` conflict and populates Stripe identifiers, `plan`, `status`, `current_period_end`, `cancel_at_period_end`, and `access_status`. This is a single-provider-shaped record today.
- `app/api/review-access/route.ts` currently derives access from the subscription row's `status`, `plan`, and `current_period_end`. It recognizes active/trialing subscriptions and applies role-specific access logic.
- Existing fan tier SQL policy checks `subscriptions.plan` and `subscriptions.status` directly. Other client routes (including dashboard/account/feed) also read subscription data.
- Because the current schema and consumers directly couple entitlements to the Stripe-shaped row, Apple IAP must not simply upsert Apple purchases into `subscriptions` using Stripe columns or overwrite the Stripe subscription row. That could break Stripe portal/cancellation behavior and could grant/revoke the wrong tier.

## Safe implementation decision
Implement a server-verified provider entitlement layer (for example, a separate Apple transaction/subscription table plus a server-only entitlement resolver) and adapt consumers deliberately. Keep existing Stripe fields and webhook behavior intact. Database policies that currently read the Stripe-shaped row need an explicit, reviewed plan for recognizing Apple entitlements without trusting client input. No production migration should run before reviewing current live schema and RLS.

## Current blockers / no false claims
- No Apple product configuration or product-ID availability check has been completed.
- No Firebase project exists, so FCM setup is blocked.
- No cloud build provider or CI credentials are configured by this task yet.
- No final bundle ID / Android application ID, App Store Connect app record, APNs key, or signing fingerprint has been verified.
- The repo's existing app configuration has not been built. There is no TestFlight build or Android internal build to test.
- No purchase, cancellation, resubscription, restore, push, or deep-link tests have been run.

## Decisions preserved
- Pro remains $4.99/month and Premium remains $9.99/month for the requested Apple monthly products.
- Existing web Stripe prices and terms are not modified.
- Existing plan feature contents are not modified.
- Do not merge to production without explicit approval.
