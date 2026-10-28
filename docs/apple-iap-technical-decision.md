# Apple IAP technical decision record

Status: proposed implementation direction; not production-ready.

## Client library and build route

- Prefer `expo-iap` for the existing Expo / React Native application, rather than adding a bare React Native-only StoreKit package.
- The current app pins Expo SDK 54 and React Native 0.81.5. The library's current setup guide lists Expo SDK 53+ but identifies SDK 57 / React Native 0.86 as its validated baseline. Therefore, do not assume compatibility: validate with a cloud EAS development build before treating the dependency as accepted.
- In-app purchases require native code and a custom development build; Expo Go is not a sufficient test environment.
- No Firebase project is needed for the Apple StoreKit transaction-verification path described here.

## Server verification direction

- Use Apple's official `@apple/app-store-server-library` in a server-side runtime compatible with the repository's deployed Node runtime.
- Verify signed transaction information and App Store Server Notifications V2 using Apple's verification APIs; do not trust client-decoded JWS payloads.
- Keep App Store Connect key material and root certificates in server-only secret configuration. Never expose them as `EXPO_PUBLIC_*` variables.
- Process notifications idempotently and reconcile status against the App Store Server API where needed.
- The new migration `supabase/migrations/20261028120000_add_apple_iap_foundation.sql` creates isolated Apple subscription, transaction, and notification-ledger tables. It is feature-branch code only and has not been applied to any database.
- `lib/billing/effective-entitlement.ts` contains a pure, fail-closed resolution primitive for already-verified provider records. It is deliberately not wired into current access routes or RLS policies; current production access behavior is unchanged.
- `lib/billing/apple-iap-classification.ts` adds pure product-ID mapping (from `APPLE_IAP_PRO_PRODUCT_ID` / `APPLE_IAP_PREMIUM_PRODUCT_ID`) and notification-type classification. It does not verify signatures, persist events, or grant access; unknown or unconfigured products fail closed.
- `lib/billing/apple-iap-verifier-config.ts` validates server-only verifier configuration and fails closed on the placeholder bundle ID, missing root certificates, malformed certificate base64, or missing production Apple app ID. It constructs no verifier and processes no payloads by itself.

## Regression checks

- Run `npm run test:apple-iap` to exercise pure product mapping, notification classification, entitlement precedence/expiry, and verifier-configuration rejection cases.
- `.github/workflows/apple-iap-primitives.yml` runs this script with Node 22 and `npm ci` for relevant pull-request and feature-branch changes.
- The workflow and test script are committed, but no successful workflow run has been observed yet. Do not describe the checks as passing until GitHub Actions reports a successful run.
- The local execution attempt in the implementation session could not clone the repository because the runtime could not resolve GitHub; no local test result is available.

## Not yet decided / required before release

- Permanent bundle identifier: current iOS identifier is still `com.example.hoopcheck`.
- Whether the two subscription products already exist in App Store Connect; suggested product IDs remain unregistered assumptions.
- The active production API alias and target server runtime for the Apple endpoints.
- The Apple server-library package and synchronized npm lockfile update; no endpoint should be enabled before this is complete.
- A non-production Supabase environment or isolated integration-test fixtures for the entitlement data model.
- EAS signing setup and a physical iOS device for sandbox testing.

## Safe sequencing

1. Confirm the permanent app identifiers and existing App Store Connect products.
2. Review the isolated Apple-provider persistence and effective-entitlement contract without modifying Stripe-owned fields.
3. Add the Apple server-library dependency and lockfile update, configure trusted Apple root certificates and permanent app identifiers, then implement signed-transaction verification and Notifications V2 handling. The pure classifier is not a webhook handler and must not be used before signature verification.
4. Integrate purchase, restore, status display, and Apple subscription management in the Expo app.
5. Audit every direct subscription read and RLS policy before wiring the resolver into actual authorization.
6. Validate duplicate/out-of-order events, expiry, refund/revocation, account switching, and coexistence with Stripe.
7. Run typecheck, unit/integration tests, cloud native build, and physical-device sandbox checks separately and report their actual outcomes.

No production configuration or billing records have been changed, and the resolver is not yet an active access-control path.
