# Apple IAP backend compatibility audit

## Verified from the current repository

- The mobile client is Expo SDK 54 / React Native 0.81.5, and its current dependencies do not include a StoreKit / in-app purchase library.
- `apps/mobile/app.json` still uses the placeholder iOS bundle identifier `com.example.hoopcheck`. Apple product registration and signed-transaction validation must not be wired to this placeholder.
- The web entitlement source of truth is the existing `public.subscriptions` row, with fields including `user_id`, `plan`, `status`, `current_period_end`, `access_status`, `stripe_customer_id`, `stripe_subscription_id`, and `stripe_price_id`.
- The Stripe webhook upserts the `subscriptions` row using `onConflict: "user_id"`. Reusing that row naively for Apple transactions risks overwriting or disconnecting Stripe subscription identifiers and breaking web billing/cancellation behavior.
- Several RLS policies and server routes read `subscriptions.plan/status/current_period_end` directly. An Apple purchase cannot grant paid access safely until those access paths have a defined, tested cross-provider entitlement contract.
- The current Stripe webhook has idempotent event-claim RPCs. Apple notifications need their own verified, idempotent processing path; they should not be routed through Stripe event handling.
- The repository does not establish a registered Apple product ID, final bundle ID, Apple server API credentials, App Store Connect issuer/key IDs, or a production-safe entitlement reconciliation process.

## Required design before runtime implementation

1. Confirm the permanent bundle identifier and register two monthly auto-renewable subscription products at the unchanged customer prices: Pro $4.99/month and Premium $9.99/month. Proposed IDs in the implementation plan are only suggestions until registered in App Store Connect.
2. Introduce a provider-neutral entitlement layer (or a separately modeled Apple subscription source) rather than replacing Stripe fields in the existing `subscriptions` row. Keep Stripe as the owner of Stripe customer/subscription lifecycle and web checkout.
3. Make access decisions use one reviewed entitlement resolver that can represent an active Stripe entitlement or an active Apple entitlement without granting duplicate or expired access. Audit every direct table read and RLS policy before switching access checks.
4. Verify Apple-signed transaction data on the server using Apple's supported server library / App Store Server API. Validate bundle ID, product ID, environment, transaction identity, expiry, revocation/refund status, and app-account association where supported. Never trust a client-supplied plan, expiry, or transaction payload without cryptographic verification.
5. Persist verified transactions idempotently and process App Store Server Notifications V2, including renewals, expiration, revocation/refund, and billing-retry/grace-period states.
6. Implement native purchase, restore, current-status display, and subscription-management links. A restore request must re-query the trusted server entitlement state rather than grant access from a client-only receipt.
7. Add sandbox-focused tests for forged/invalid signed data, product/bundle mismatch, duplicate transactions and notifications, renewals, expiry, refund/revocation, account switching, and coexistence with Stripe.
8. Run typecheck, tests, and native build in CI/EAS after selecting the purchase library and supplying non-production configuration. No production migrations, live purchases, deploys, or App Store submission until explicitly approved.

## Current status

This is a source audit only. No runtime code, schema, production configuration, Stripe billing, Supabase database, or store listing was changed. No native build or payment test was run. The existing $4.99 and $9.99 monthly prices and Stripe behavior remain untouched.
