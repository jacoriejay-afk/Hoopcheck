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

## App Store policy gate added during continued work
- Apple's currently published App Review Guidelines say apps should go beyond a repackaged website under 4.2, and require in-app purchase for digital features/subscriptions under 3.1.1. The current Capacitor config points the WebView at the live remote site; this is a technical scaffold, not an App Store-ready packaging strategy. A remote-only shell has meaningful rejection risk unless native functionality and app-specific utility are substantial. [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- Do not treat `server.url` as the production app delivery architecture without review. Capacitor's environment guidance describes macOS/Xcode as the standard iOS build environment and notes cloud builds as an alternative; Capacitor 8 requires Xcode 26+. [Capacitor environment setup](https://capacitorjs.com/docs/getting-started/environment-setup)
- Decision gate before creating native projects: establish a production architecture that preserves the existing Next.js server/API functionality while providing the same UI codebase in the native container. A plain static export is not assumed to work because the current app uses server/API routes. Do not switch to Expo or fork the UI.
- Apple IAP should be presented in the iOS app for new digital subscription purchases. Existing paid web/Stripe subscribers must retain access, but the app must not use in-app UI to improperly direct users to external purchasing; confirm the applicable storefront-specific rules before enabling web billing links.
- The Apple guidelines were checked on 2026-10-27; Apple announced a guideline revision on 2026-10-16. [Apple's update notice](https://developer-rno.apple.com/news/?id=92th7e5i)
