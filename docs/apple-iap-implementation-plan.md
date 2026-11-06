# Apple In-App Purchase Implementation Plan

Status: implementation contract; not a claim that StoreKit code is complete.

## Fixed product and compatibility requirements

- HoopCheck Pro: USD 4.99 per month.
- HoopCheck Premium: USD 9.99 per month.
- Do not change existing Stripe product prices, customer records, or web subscription entitlements.
- Web subscribers must retain their existing access. Apple transactions must not overwrite a valid Stripe entitlement merely because the billing provider differs.
- Use Apple sandbox/TestFlight transactions for validation. No real payment tests, production billing changes, or store submissions in this workstream without explicit owner approval.
- Keep all Apple private keys, App Store Connect API keys, Stripe secrets, and Supabase service-role credentials server-side.

## Current verified repository state

- The app is an isolated Expo / React Native app under `apps/mobile`.
- The mobile package currently has no StoreKit purchase dependency or purchase/restore screens.
- `apps/mobile/README.md` states that native iOS/Android builds and physical-device recovery tests have not been completed.
- The existing subscription system is Stripe-oriented. Existing web checkout and entitlement behavior must remain unchanged.
- The final iOS bundle identifier is still a placeholder (`com.example.hoopcheck`) in the documented EAS configuration and must be replaced before signing/building for distribution.

## Account ownership prerequisite

The additive migration defines `public.apple_iap_account_tokens`, a server-only mapping from an authenticated HoopCheck user to a unique UUID for Apple's `appAccountToken`. A future authenticated purchase-preparation endpoint must create or retrieve this mapping using the verified Supabase user identity, then return the token to that signed-in app. The purchase flow must send this token to StoreKit. On server verification, a transaction's `appAccountToken` must match the stored mapping before the transaction is attached to that user. Never use a client-provided user ID or token alone as ownership proof. Existing transactions without an account token need a separate authenticated restore/claim flow and must not be auto-assigned.

The notification handler now requires callers to explicitly pass allowed environments. Production notification routes must configure only `Production`; sandbox tests must explicitly configure `Sandbox`. The helper itself does not choose the route's environment policy.

## Architecture to implement

1. Add an isolated mobile billing module that exposes product loading, purchase, restore, and current purchase state. Keep UI code independent of the specific StoreKit library.
2. Register two monthly auto-renewable subscription products in App Store Connect using stable product identifiers, for example `hoopcheck_pro_monthly` and `hoopcheck_premium_monthly`. Confirm availability, localization, tax/banking setup, and exact USD price tier in App Store Connect before using them. Product identifiers are proposed, not registered.
3. Send signed transaction data from the app to an authenticated server endpoint. Never trust a client-supplied plan, price, expiration date, or transaction status.
4. Verify signed transactions using Apple's official App Store Server API / signed transaction format on the server. Validate bundle ID, product ID, environment, transaction/original transaction IDs, revocation/refund status, and expiry.
5. Make transaction processing idempotent. Persist verified Apple transaction and subscription state separately from Stripe provider records; derive effective access from all valid providers without silently replacing an active entitlement.
6. Handle renewals, billing retry/grace periods, refunds, revocations, upgrades/downgrades, and expiration through App Store Server Notifications V2. Verify notification signatures and reconcile missed events with Apple's server API.
7. Implement Restore Purchases and an explicit subscription status screen. Explain that cancellation is managed in the Apple account subscription settings for Apple-billed purchases; do not route Apple customers into Stripe's portal.
8. Add tests for invalid signatures, wrong bundle/product IDs, duplicate transactions, expired/revoked transactions, out-of-order notifications, restore, and coexistence with Stripe entitlements.

## Required decisions and gates

- Confirm the final iOS bundle identifier before creating App Store Connect products.
- Confirm whether any App Store Connect subscription products already exist; never create duplicate products blindly.
- Use a non-production Supabase environment or isolated test fixtures for schema and integration tests. Do not apply migrations to production during this foundation phase.
- Choose a StoreKit-compatible library only after confirming compatibility with the pinned Expo SDK 54 and the required EAS native build path.
- Keep server verification and notification handling in a dedicated, reviewed backend change. Do not place Apple credentials in Expo public environment variables.
- Test through Apple sandbox/TestFlight and a real iOS device before claiming the flow works.
- Do not submit to App Review or release publicly without explicit owner approval.

## Acceptance criteria

- Both products display the correct price and monthly renewal terms from StoreKit, not hardcoded price claims.
- Purchase and restore return only server-verified entitlements.
- Stripe web subscribers keep access, and Apple subscribers do not get incorrectly sent to Stripe management.
- Duplicate/out-of-order events are safe and idempotent.
- No secrets ship in the mobile bundle.
- CI, server tests, EAS native build, and device sandbox tests are reported separately with actual results.
