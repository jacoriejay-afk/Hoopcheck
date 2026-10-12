# HoopCheck App Store Submission Preparation

Status: preparation only. This document does not submit either app or change production behavior.

## Current product and deployment facts

- Product: HoopCheck, a basketball research and community-review web platform.
- Production web app: https://hoopcheck-hoopcheck.vercel.app
- Repository: https://github.com/jacoriejay-afk/Hoopcheck
- The current app is a Next.js application with server-side API routes, Supabase authentication/data, and Stripe-related subscription routes.
- A web app manifest and SVG icon have been added. This is not a native iOS or Android build.
- Do not submit the existing website as a thin wrapper without checking store rules and proving the app has adequate app-specific functionality.
- Do not submit or publish anything without explicit owner approval.

## Draft store listing copy

### App name
HoopCheck

### Short description / subtitle draft
Research basketball teams, coaches, leagues, and player experiences before you commit.

### Promotional summary draft
Make more informed basketball career decisions with research and community experiences about teams, coaches, and leagues.

### Full description draft
HoopCheck helps basketball players research professional teams, coaches, and leagues before making career decisions. Explore basketball information, read community experiences, and use account features to manage your activity.

Use HoopCheck as one source of information alongside your own research and direct verification. Community posts reflect contributors' experiences and should not be treated as independently verified facts.

### Keywords draft (Apple)
basketball, professional basketball, teams, coaches, leagues, player reviews, overseas basketball

These are draft marketing materials only. Review for accuracy and store character limits before use. Do not add claims about review volume, verified outcomes, or coverage that have not been independently confirmed.

## Required technical decision before packaging

Choose and implement a native distribution architecture before creating store binaries. The existing project uses Next.js server routes and cannot simply be treated as a static-export app without evaluating functionality. A remote-site WebView wrapper may be rejected if it provides insufficient native/app-specific value.

Preferred next technical step: prototype a native shell (for example, Capacitor) against a dedicated staging build and test authentication, redirects, file uploads, deep links, navigation, session persistence, network failures, and account deletion. Keep the production website unchanged during preparation.

## Apple App Store checklist

- [ ] Create a real iOS app target and archive; validate on supported iPhone/iPad devices.
- [ ] Confirm bundle identifier, version/build numbers, signing, and distribution certificate.
- [ ] Provide correct app icons, screenshots for required device sizes, and optional preview video.
- [ ] Confirm privacy policy URL: https://hoopcheck-hoopcheck.vercel.app/privacy
- [ ] Confirm support URL: https://hoopcheck-hoopcheck.vercel.app/support
- [ ] Provide App Review contact information and a working reviewer account/instructions if login is required. Never place passwords or secrets in this repository.
- [ ] Complete App Privacy disclosures from actual SDK/network/data behavior; do not guess.
- [ ] Set age rating based on real user-generated content and moderation behavior.
- [ ] Verify reporting, moderation, account deletion, privacy requests, and contact/support flows in the native app.
- [ ] Resolve subscription/payment compliance before submission. Existing Stripe web checkout must not be assumed compliant for digital subscriptions sold/unlocked inside an iOS app; review Apple's current rules and implement required StoreKit/in-app purchase behavior or an explicitly permitted alternative.
- [ ] Confirm all external links, login providers, and account flows comply with current Apple guidelines.
- [ ] Archive and upload for TestFlight testing first. Do not submit for App Store review until owner approval.

## Google Play checklist

- [ ] Create an Android app project and signed Android App Bundle (AAB).
- [ ] Confirm package/application ID, version code, version name, signing, and target API requirements current at release time.
- [ ] Provide app icon, feature graphic, phone screenshots, and tablet assets if supported.
- [ ] Confirm privacy policy URL: https://hoopcheck-hoopcheck.vercel.app/privacy
- [ ] Complete Data safety form from actual collection, sharing, retention, and deletion behavior.
- [ ] Complete content rating and target audience declarations accurately.
- [ ] Provide reviewer access instructions and a stable test account if needed; never store credentials in this repository.
- [ ] Test user-generated content reporting/moderation, account deletion, privacy requests, support, login persistence, and billing.
- [ ] Check Google Play Billing requirements for digital subscriptions sold in the app; do not assume existing Stripe checkout is compliant.
- [ ] Complete required internal/closed testing and any account-specific testing requirements before production release.
- [ ] Upload to internal testing first. Do not roll out to production until owner approval.

## Shared release blockers

- [ ] Confirm native packaging approach and app-specific value beyond a simple website wrapper.
- [ ] Generate final native icon assets (including PNG sizes required by the stores) and screenshots from real running builds.
- [ ] Test signup, login/logout, password recovery, navigation, support ticket submission, privacy request center, account deletion, review reporting, moderation, and subscription entitlement behavior on real devices.
- [ ] Confirm the support contact email/address to publish in store listings.
- [ ] Confirm whether children are an intended audience; set age/audience declarations accordingly.
- [ ] Audit all data collected by app, SDKs, analytics, Supabase, and Stripe before privacy disclosures.
- [ ] Verify the exact subscription products, prices, renewal terms, and purchase/restore/cancel flows in each store.
- [ ] Run a final security and privacy review of the production app and native package.
- [ ] Obtain explicit owner approval before any store submission or public release.

## Scope and guardrails

This branch contains documentation only. It does not modify app runtime code, payment configuration, production deployment, or store submissions. Real subscription payments are not to be tested unless the owner explicitly authorizes that later.
