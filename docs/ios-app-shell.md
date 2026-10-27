# HoopCheck iOS app shell

## Status
Capacitor bootstrap is being developed on `feat/capacitor-ios-shell`. This is not yet an App Store-ready build. The current Next.js app uses server features and API routes, so do not switch to static export until every route, auth flow, and backend dependency has been audited.

## Added in this branch
- Capacitor configuration with HoopCheck branding and native plugin defaults.
- Capacitor core, App, Share, Push Notifications, Status Bar, Splash Screen, and CLI dependencies in `package.json`.
- `NativeAppBridge` listens for Capacitor `appUrlOpen` events and routes first-party universal links or the app URL scheme through Next.js navigation.
- A floating native share-sheet action is shown on public team, women's team, coach, league, agent, and player profile pages. It uses the page's current public URL and sits above the bottom navigation/safe-area inset.
- `NativeShareButton` provides a reusable native share-sheet primitive, with Web Share/clipboard fallbacks.
- The deep-link bridge is mounted at the app root.

## Native capabilities and remaining work

### Sharing
The shared action is wired to the public profile routes listed above. Verify the generated share URL, cancellation behavior, and fallback on a real iPhone before release. Confirm the intended route for player profiles and agent profiles matches production routing.

### Deep links
The bridge routes links only when the native Capacitor runtime emits `appUrlOpen`. A release still requires Xcode Associated Domains entitlement (for `applinks:hoopcheck.online` and any confirmed www host), Apple App Site Association hosted on the web domain, an agreed custom URL scheme if used, and physical-device tests for cold and warm app launches. Confirm route paths against the real app before enabling links in public UI.

### Push notifications
Push is not yet enabled. Before prompting users, implement a user-initiated opt-in flow, native permission/token registration, secure token storage linked to the authenticated account, a backend sender using APNs credentials stored only server-side, token rotation/removal, notification preferences, and deep-link routing from notification taps. Never request notification permission automatically on first launch.

### iOS project and build
1. On a Mac with a supported Xcode version, install dependencies and run the project checks.
2. Run `npx cap add ios` once, then `npm run cap:sync` and `npm run cap:ios`.
3. Confirm app ID `online.hoopcheck.app` is available and appropriate before publishing; configure signing, app icons, splash assets, Associated Domains, and push capability in Xcode.
4. Test login/signup, OAuth redirects if present, cookies/session persistence, uploads, account deletion, support/reporting/moderation, billing, network loss, keyboard/safe areas, and back navigation on physical devices.
5. Do not create a production archive until the build strategy and hosted web origin are validated.

## Important architecture note
The existing app depends on Next.js server functionality. The current Capacitor config uses the live site as a feasibility/bootstrap target; a remote-only web wrapper may still fail App Review Guideline 4.2 and is not a release recommendation. Do not enable static export blindly. Evaluate a dedicated staging origin or a hybrid/native screen approach and document the meaningful app-specific value before submission.

## App Review checklist
- The app provides useful native functionality beyond displaying the website.
- Authentication, password recovery, and account deletion work in-app.
- Privacy policy and App Privacy answers match actual SDK/data behavior.
- Push is opt-in, relevant, and routes to the correct content.
- Shared links and universal links open the correct screen and fall back to the website.
- Membership/payment behavior complies with the current Apple rules; do not assume Stripe web checkout can be used unchanged for digital subscriptions inside the iOS app.
- No placeholder screens, broken links, browser-only dead ends, or unexplained permission prompts.
- Verify review credentials and reviewer notes for account-gated features.
