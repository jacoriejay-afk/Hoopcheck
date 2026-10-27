# Native rollout status — 2026-10-27

## Confirmed decisions
- Apple Developer Program: enrolled (owner confirmation).
- Build route: cloud builds preferred.
- Firebase: no project exists yet; Android push is blocked until a Firebase project and FCM credentials are configured.
- Existing web/Stripe entitlement must remain valid for signed-in users in the native app.
- Prices are locked: Pro $4.99/month; Premium $9.99/month.
- Keep current plan features unchanged. Apple subscriptions are monthly auto-renewables in one subscription group.

## Repository facts verified
- Current Next.js app uses Next.js 16.4.2, React 19.2.0, Supabase JS 2.76.1, and Stripe 22.6.0.
- No Capacitor packages are present in package.json yet.
- The current membership UI reads `public.subscriptions` fields including `plan`, `status`, `current_period_end`, `cancel_at_period_end`, and `stripe_subscription_id`.
- Existing Stripe checkout starts at `/api/stripe/webhook/create-checkout`; cancellation and customer portal have separate API routes.
- The membership page offers monthly, 6-month, and annual web billing. Native Apple IAP must add only the requested monthly products and must not rewrite existing Stripe billing.
- Next.js config does not enable static export. The current Capacitor config points at the production website and sets `webDir: out`; the static output has not been verified and the remote production URL configuration is not yet approved for store submission.

## Must happen before implementation can be called complete
1. Inspect the actual Supabase schema and all entitlement consumers. Design one trusted entitlement resolver that can represent verified Stripe and Apple subscriptions without downgrading an active Stripe customer.
2. Add Capacitor dependencies and generate native projects in a cloud macOS/Android build environment. Keep the Next.js UI as the single UI source.
3. Decide the final bundle/package IDs and register them with Apple/Google. Do not publish association files until the final IDs and signing fingerprints are known.
4. Create the Apple subscription group and monthly products in App Store Connect after confirming the product IDs are unused. Product IDs proposed in the rollout plan are proposals only until verified.
5. Configure Apple server verification and App Store Server Notifications V2. Store only verified transaction state; do not trust client-supplied tier or purchase flags.
6. Create a Firebase project for Android push; configure APNs credentials for iOS and an authenticated device-token registration/delivery path.
7. Add native share, URL handling, push deep links, and generated icon/splash assets from the actual brand logo.
8. Run the full sandbox lifecycle and Stripe regression tests on signed builds. Record results only after observing them.

## Current test status
Nothing in this checklist is marked passed. No native project, TestFlight build, Android internal build, Apple products, push credentials, or purchase lifecycle test has been verified as of this update.
