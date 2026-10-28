# HoopCheck Native App + Apple Subscription Rollout

## Product rules
- Keep the existing Next.js application as the single UI/codebase.
- Pro remains $4.99/month; Premium remains $9.99/month. Both are auto-renewable.
- Put both products in one Apple subscription group and rank Premium above Pro.
- Preserve the exact existing tier features. Reuse current tier/access checks rather than creating a second feature matrix.
- Existing active Stripe/web subscribers must retain their paid tier when signing into iOS. Do not force a duplicate Apple purchase to regain already-paid access.
- Never grant access based only on a client-supplied tier, product ID, or purchase-success boolean.

## Capacitor configuration
The initial capacitor.config.ts uses app ID online.hoopcheck.app and the existing live site https://hoopcheck.online to avoid a second UI. This remote-shell approach still needs validation against store requirements and native device testing. The current Next.js app is server-rendered and static export has not been verified; do not claim platform builds are ready.

## Native work remaining
1. Native share sheet for team/player canonical URLs, with Web Share API fallback.
2. Capacitor URL-open listener: accept only https://hoopcheck.online URLs and route the path/query to the same website route.
3. Universal Links and Android App Links via .well-known/apple-app-site-association and .well-known/assetlinks.json. These require the final Apple Team ID, bundle ID, Android signing SHA-256 and Play App Signing fingerprint; never use placeholders.
4. APNs and FCM registration; store tokens against authenticated users, support token rotation and opt-out, and include a canonical internal URL in push payloads. Validate that URL before navigating on tap.
5. Generate native icon/splash sizes from the existing real HoopCheck logo. Do not use a favicon or placeholder as final artwork.

## Apple products
Proposed product IDs (verify unused before creating): online.hoopcheck.pro.monthly and online.hoopcheck.premium.monthly. Create both in one subscription group in App Store Connect, set exact monthly price points $4.99 and $9.99, and rank Premium above Pro. Apple storefronts may display localized currency/tax.

## Server validation and unified entitlements
- Use StoreKit signed transaction data and the App Store Server API; do not use the deprecated verifyReceipt endpoint as the new implementation.
- Add App Store Server Notifications V2 and idempotent processing for renewals, cancellations, resubscriptions, refunds/revocations and expiry.
- Associate a purchase with the signed-in HoopCheck user using a verified account mapping/app-account token where supported. Never attach an Apple transaction from an untrusted client claim.
- One canonical entitlement resolver must combine current verified Stripe entitlements with verified Apple entitlements without changing feature definitions. If both are active, retain the highest existing tier; do not double-bill or downgrade an active paid tier.
- Cancellation means renewal is disabled, not immediate entitlement loss. Keep access through verified paid-through expiry; handle verified grace period, billing retry, refund and revocation states.
- Restore Purchases must query StoreKit current entitlements, submit signed transaction data for server verification, and attach the verified result to the authenticated HoopCheck account.
- Keep Stripe webhook processing and Apple notifications reconciled with the same canonical entitlement state.

## Native purchase UI
- Fetch product metadata and localized display prices from StoreKit.
- Display the existing Pro and Premium descriptions/features unchanged.
- Purchase through StoreKit, then wait for server verification before showing confirmed unlock.
- Provide Restore Purchases and Manage Subscription.
- Existing active Stripe/web subscribers should see their current tier and must not be forced to buy again merely to unlock existing entitlements.

## Required release proof
Do not mark complete until: (1) signed TestFlight and Android internal-testing builds exist; (2) real-device share and domain-link tests pass; (3) a real APNs/FCM test push opens the correct team URL from background and terminated states; (4) sandbox sequence purchase -> unlock -> cancel -> paid-through access -> resubscribe -> restore on a fresh install passes; (5) active Stripe subscriber sign-in preserves tier; and (6) expiry, revocation, duplicate notifications, account switching, logout, token rotation, and restore-with-no-active-subscription are tested.

## Shell differences to test
Supabase OAuth/password-reset callbacks, Stripe checkout/return-to-app, cookies and session persistence, external links, downloads/uploads, browser back, keyboard and safe areas, status bar/splash, push permission prompts, offline behavior, and third-party authentication can behave differently in WKWebView/Android WebView.

## Architecture decision record — native delivery gate (2026-10-28)

### Decision status: provisional; no store release architecture approved

**Do not generate or sign platform projects yet.** The current config's `server.url` points at the live website and `webDir: "out"` suggests a local export, but the repository does not currently prove that a static export can run the whole app. The app uses Next.js server routes and authenticated Supabase/Stripe flows. A remote URL keeps those server capabilities, but leaves the native app dependent on network access and increases Apple's minimum-functionality/repackaged-website review risk.

### Required architecture investigation

1. Inventory every server-dependent page and API route used by sign-in, reviews, feeds, membership, checkout returns, alerts and account settings.
2. Confirm which routes can remain hosted on the existing Next.js deployment and which, if any, need a native plugin or local client implementation.
3. Prototype a Capacitor shell against a non-production/staging URL first; verify cookies/session persistence, OAuth redirects, back navigation, file upload, external links and Stripe return behavior.
4. Choose explicitly between (A) a hosted Next.js UI with native features and robust offline/error states, or (B) a locally bundled UI that calls the hosted Next.js backend. Option B is acceptable only after proving that the existing UI can be bundled without breaking server-rendered functionality; do not assume `output: "export"` is compatible.
5. Document the app-specific native utility that goes beyond a thin website wrapper before submitting for review. Push, verified deep links, native sharing and StoreKit are intended capabilities, not yet implemented proof.

### Guardrails

- Keep the Next.js app and UI as the single source of truth; no Expo migration or parallel UI rewrite.
- Do not change production `next.config.ts`, Stripe checkout, production database schema, or live deployment as part of this investigation.
- Keep any native proof-of-concept isolated to `feat/capacitor-native-shell` or a separate feature branch.
- Before signing, pin and verify the bundle/application IDs, Apple Team ID, App Store Connect record, Android signing fingerprints, associated-domain files, APNs/FCM credentials and build-provider secrets.
- Treat the current `capacitor.config.ts` as a scaffold only. Passing web CI does not establish that iOS/Android projects compile or that the app meets App Store/Play review requirements.
