# HoopCheck Apple In-App Purchase Release Runbook

Status: preparation only. Apple app record and subscription products have not been created. This runbook does not authorize a production migration, deployment, merge, live-billing change, or App Store submission.

## Commercial rules that must remain unchanged

- Pro: USD $4.99 per month.
- Premium: USD $9.99 per month.
- Existing Stripe subscriptions remain supported and must not be overwritten by Apple transactions.
- An Apple transaction must not grant access until Apple's signed transaction/notification data has been verified server-side and ownership, product, environment, expiry, revocation, and idempotency checks pass.
- Do not claim StoreKit, Apple signature verification, database integration, or a native build passed until each has actually been run and evidenced.

## A. Apple account setup (manual)

1. Sign in to [Apple Developer](https://developer.apple.com/account/) and confirm the Account Holder has accepted current agreements.
2. Under Certificates, Identifiers & Profiles, create an explicit App ID for the native HoopCheck app. Choose a permanent, unique bundle identifier and record it exactly. Do not use the placeholder `com.example.hoopcheck`. Do not change it after shipping.
3. In [App Store Connect](https://appstoreconnect.apple.com/), open Apps → + → New App. Choose iOS, name it HoopCheck, select the exact registered bundle ID, and supply a unique internal SKU. Apple requires an app record before uploading a build.
4. Under Monetization → Subscriptions, create one subscription group for HoopCheck membership tiers. A single group is normally appropriate because Pro and Premium are mutually exclusive access levels.
5. Create two auto-renewable monthly subscriptions in that group:
   - Pro — $4.99/month. Suggested product ID: `hoopcheck_pro_monthly`.
   - Premium — $9.99/month. Suggested product ID: `hoopcheck_premium_monthly`.
   Product IDs are suggestions only; confirm they are available and save the exact IDs shown by App Store Connect. Never configure code from a suggestion before the products exist.
6. Set subscription levels so Premium is the higher service level than Pro. Complete the required localizations, display names, descriptions, review information, and pricing territories. Verify the displayed monthly prices in App Store Connect before proceeding.
7. Complete any Paid Apps agreement, tax, and banking requirements that App Store Connect requests. These are account-holder actions.

Apple reference: https://developer.apple.com/app-store/subscriptions/ and https://developer.apple.com/help/app-store-connect/manage-subscriptions/offer-auto-renewable-subscriptions/

## B. Server configuration — only after the identifiers exist

Set secrets in the appropriate server deployment environment (never in client/mobile public variables):

- `APPLE_IAP_BUNDLE_ID`: the exact registered bundle ID and the same value used by the native app.
- `APPLE_IAP_PRO_PRODUCT_ID`: exact Pro subscription product ID.
- `APPLE_IAP_PREMIUM_PRODUCT_ID`: exact Premium subscription product ID.
- `APPLE_ROOT_CA_CERTIFICATES_BASE64`: comma-separated base64 DER bytes for Apple Root CA certificates, as required by the existing configuration helper. Do not paste PEM text or private keys here.
- `APPLE_IAP_APPLE_ID`: numeric Apple app ID, required for Production verification.
- Any App Store Server API issuer/key IDs and private key must be added only if the API client path is implemented; keep private keys in server-side secret storage and never commit them.

Use separate Sandbox and Production verification configurations. Never treat a decoded JWS as verified. Use Apple's official server library for signed transaction and notification verification; do not hand-roll cryptographic validation. Official library: https://github.com/apple/app-store-server-library-node. Its current release requires Node 22+, so ensure the deployment runtime and CI are compatible before adding it.

## C. App Store Server Notifications

1. After the server notification endpoint is implemented and deployed to a non-production/staging target, configure the App Store Server Notifications V2 URL in App Store Connect.
2. Keep Sandbox and Production URLs/environments distinct or explicitly handled. Validate the signed outer notification and all nested signed transaction/renewal payloads using Apple's library.
3. Persist each notification UUID idempotently; repeated delivery must not duplicate or reverse-grant entitlement.
4. Handle at least subscription purchase/renewal, expiration, refund/revocation, billing retry/grace period, upgrade/downgrade, and renewal-status changes.
5. Acknowledge/return success only according to Apple's notification delivery contract after safely recording or scheduling processing. Log identifiers and outcomes, not private keys or raw secrets.

The current PR contains framework-neutral primitives but not a fully wired, production-ready notification endpoint. Do not configure App Store Connect to a nonexistent endpoint.

## D. Mobile purchase integration

1. Confirm the exact Expo SDK / React Native versions and choose an IAP package with verified compatibility. HoopCheck currently uses Expo SDK 54 / React Native 0.81.5; do not assume a package supports this combination without a clean install and cloud build.
2. Implement StoreKit product loading, purchase, transaction finishing, restore/sync, pending/error UI, and purchase state refresh. Expo Go is not a valid StoreKit test environment; use an iOS custom development build and a physical device or supported StoreKit test setup.
3. Send purchase/transaction evidence to the authenticated server. The server must verify with Apple and associate the transaction to the authenticated account using the server-issued app account token. Never accept a client-supplied user ID as proof of ownership.
4. Show Apple membership state and a Manage Subscription path. Preserve existing Stripe entitlements and source attribution. Resolve the effective access across sources without allowing an expired/revoked Apple record to override an active valid entitlement from another source.
5. Keep purchase controls disabled until configuration, verification, persistence, reconciliation, and restore behavior are all implemented and tested.

## E. Required verification gates

- [ ] Permanent bundle ID registered and App Store Connect app record created.
- [ ] Both product IDs created and monthly prices/levels checked.
- [ ] Release-readiness script passes using the real identifiers.
- [ ] Server official-library signature verification implemented and unit-tested.
- [ ] Account-token route integration-tested against a controlled Supabase test project.
- [ ] Migration reviewed and applied to a non-production database first; verify RLS and server-only access.
- [ ] Notification endpoint tested for valid, invalid, duplicate, expired, revoked, Sandbox, and mismatched-product cases.
- [ ] Native iOS cloud build succeeds with the chosen IAP package.
- [ ] Sandbox purchase, renewal, restore, cancellation, expiry, and refund/revocation tested.
- [ ] Existing Stripe Pro/Premium flows and access remain unchanged.
- [ ] CI is green on the final commit and release preflight passes.
- [ ] Explicit approval obtained before any production migration, production deployment, merge, live billing activation, or submission.

## F. Rollout and rollback

Roll out behind a server-side feature flag. Enable Sandbox/testing first. If verification or notification processing fails, disable new Apple purchase initiation and fail closed for unverified Apple transactions; do not revoke unrelated valid Stripe access. Keep a reconciliation procedure to query Apple's transaction history and replay idempotently. Never delete transaction audit records as a rollback shortcut.

## Current known state

- Draft PR: https://github.com/jacoriejay-afk/Hoopcheck/pull/124
- Branch: `feat/apple-iap-foundation`
- Existing pure-logic and static contract checks were green on the last reported commit, but those checks do not prove a working StoreKit purchase, a real Supabase integration, Apple signature verification, or a native iOS build.
- The Apple app record and products are not created. Production migration/deployment/merge have not been performed as part of this setup.
