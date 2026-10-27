# HoopCheck iOS app shell

## Status

This is the native-shell bootstrap plan for the existing Next.js product. It is not yet an App Store-ready build. The app currently uses Next.js server features and Supabase, so do not switch to static export until every route, auth flow, API dependency, and server-rendered page has been audited.

## Intended native value

- Native push notifications for account, review, follow, and relevant activity events.
- Native share sheet for public team, coach, league, agent, and player profile URLs.
- Universal links / custom URL handling to open the matching HoopCheck route.
- Correct iOS safe-area, status bar, back navigation, and app-resume behavior.
- Native permission prompts with clear user-facing explanations and preferences.

## Bootstrap

1. Install Capacitor packages in a development environment:
   `npm install @capacitor/core @capacitor/ios @capacitor/share @capacitor/app @capacitor/push-notifications @capacitor/status-bar @capacitor/splash-screen`
2. Install the CLI as a dev dependency:
   `npm install -D @capacitor/cli`
3. Verify the project can run the intended web target. The current Next.js app is dynamic; do not assume `next export` or `output: "export"` will work.
4. Run `npx cap add ios` on a Mac with Xcode installed, then `npx cap sync ios`.
5. Configure the real iOS bundle identifier, signing team, app icons, launch screen, URL scheme, Associated Domains entitlement, and push-notification capability in Xcode.
6. Implement and test native share, deep links, push token registration, notification routing, and permission-denied states.
7. Keep secrets server-side. Push delivery needs a backend sender and APNs credentials; never put APNs private keys or service-role keys in the app.
8. Test on physical iPhones and through TestFlight before submitting.

## Important architecture note

The existing app depends on Next.js server functionality. A production shell that loads the live site can be used for an initial technical proof, but a remote-only web wrapper is at high risk under App Review Guideline 4.2. Before submission, implement meaningful native workflows and document the value they provide. If the app needs a bundled local web layer, first determine which routes can be safely bundled and which server-backed flows need an API/web origin. Do not enable static export blindly.

## App Review checklist

- App provides useful native functionality beyond displaying the website.
- Login, signup, password recovery, and account deletion work in the app.
- Privacy policy and App Privacy answers match actual SDK/data behavior.
- Push notifications are opt-in, relevant, and route to the correct content.
- Shared links and universal links open the correct app screen and fall back to the website.
- Purchases and memberships comply with Apple's applicable payment rules; do not assume existing Stripe web checkout can be used unchanged inside the iOS app.
- No placeholder screens, broken links, browser-only dead ends, or unexplained permission prompts.
- Verify review credentials and provide reviewer notes for any account-gated features.
