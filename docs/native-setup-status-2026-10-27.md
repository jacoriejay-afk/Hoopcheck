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


## Latest continuation — 2026-10-27

Added explicit acceptance contracts to [the native test matrix](./native-test-matrix.md) for:
- choosing and validating a production delivery architecture without assuming static export works;
- accepting only canonical `https://hoopcheck.online` deep links;
- associating push tokens to authenticated users and testing actual push taps across app lifecycle states;
- requiring server-side Apple transaction verification, trusted account binding, and a shared entitlement resolver before any Apple purchase can unlock access.

These are implementation gates, not completed features. No Capacitor dependency install, native platform project, Apple product, Firebase project, signed build, or real-device test has been completed by this continuation. The app config still points to the live hosted site and is not certified as store-ready. Do not apply the Apple migration or enable purchase UI based on these docs alone.


## Native architecture work — 2026-10-28

### 1. Server-dependent route / capability inventory

Repository inspection confirms the web application is not a static-only frontend:

| Surface | Evidence in repository | Native implication |
|---|---|---|
| Auth/session | `proxy.ts` uses `@supabase/ssr`, request cookies and `supabase.auth.getClaims()`; protected routes redirect to `/login` | A local static export cannot replace the server/session behavior. Test Supabase cookie and token behavior in WKWebView/Android WebView. |
| Subscription checkout | `app/api/stripe/webhook/create-checkout/route.ts` creates Stripe Checkout sessions and validates bearer access tokens and deployment payment-mode flags | Hosted Next.js API must remain reachable for web billing flows. Native purchase UI still needs a separate StoreKit server-verification path; do not route Apple purchases through Stripe. |
| Billing portal | `app/api/stripe/create-portal/route.ts` validates Stripe mode and authenticated access before creating a portal session | Test external browser / app return behavior; do not alter production Stripe settings for this prototype. |
| User-generated content | `app/api/hoopfeed/moderate/route.ts`, `app/api/fan-feed/moderate/route.ts`, and feed pages use multipart `FormData`, bearer tokens and Supabase Storage uploads | Validate camera/photo picker, large uploads, multipart requests, cancellation, and moderation errors on real devices. |
| Reviews | Mobile README documents team review submission through existing `/api/reviews` and server-side eligibility checks | The API origin must be explicit and active; test authenticated review submission without bypassing server checks. |
| Deep links / recovery | Existing Expo app documents `hoopcheck://reset-password`; the Capacitor scaffold does not yet register an actual native URL-open listener | Validate password recovery, OAuth callbacks and universal/app links separately for the chosen shell. |
| Server-rendered pages and route handlers | App Router pages plus many `app/api/**/route.ts` handlers are present | `output: "export"` is not approved; do not change `next.config.ts` to force static export. |

This is a capability inventory, not an exhaustive route-by-route source audit. A final route list must be generated from the current tree and tested by user journey before release.

### 2. Staging shell smoke test — status: blocked, not passed

No staging deployment URL or verified staging credentials were found in the reviewed native setup documentation. GitHub's latest combined status reports Vercel build-rate-limit failures for the app checks. Therefore no honest end-to-end staging session can be reported yet.

Once an isolated staging deployment is available, run these cases before pointing any native shell at production:
- Sign in, refresh a protected page, background/foreground the app, and confirm the session persists without redirect loops.
- Sign out and confirm protected content cannot be revisited with browser back.
- Exercise Supabase password reset and any enabled OAuth callback, including cold-start link opening.
- Open a team/player link from an external app and confirm the exact allowlisted path/query opens; reject external hosts and unsupported routes.
- Open and cancel Stripe Checkout in test mode only, verify return/cancel routing, and ensure no live charge or production setting is touched.
- Upload a photo and video to each feed in test data; verify multipart form data, progress/cancellation, moderation denial and successful publication.
- Test browser back, keyboard, safe areas, external links, downloads, offline/error states and session expiration on both iOS and Android.
- Record device/OS, build SHA, result and evidence for every case.

### 3. Native prototype architecture

**Selected for the next prototype only: hosted Next.js UI inside Capacitor, pointed at a dedicated staging origin.** This is the only current path that reuses the existing Next.js UI directly while preserving the server-rendered routes and API handlers. It is not a production or App Store approval decision.

Constraints for the prototype:
- Require a dedicated staging hostname and isolated/test data; do not test checkout, auth edge cases, or uploads against production.
- Restrict navigation to the exact staging host plus explicitly approved authentication/payment hosts. Do not use a wildcard subdomain allowlist for arbitrary external content.
- Implement a native URL-open listener that runs every inbound URL through the existing strict canonical-origin/path validator before navigating.
- Keep a visible, recoverable offline/network-error state and test the hosted app when the origin is unavailable.
- Add native value beyond the website (verified deep links, native share, push notifications and native purchase handling) and obtain an App Store policy review before deciding whether this delivery model is acceptable.
- Do not add `output: "export"` or create a second UI implementation to make a build appear successful.

**Important distinction:** the repository also contains `apps/mobile/`, an isolated Expo/React Native app with its own native UI and EAS profiles. Its README confirms it is separate from the Next.js website and its app identifiers are still `com.example.hoopcheck` placeholders. This is not the same UI/codebase and must not be silently treated as the Capacitor prototype or store-ready. Preserve it untouched during the current Capacitor investigation unless the product owner explicitly changes direction.

### 4. Delivery architecture choice and gate

| Option | Assessment |
|---|---|
| Hosted Next.js UI in Capacitor | Chosen for a staging-only proof of concept because it preserves current UI and server routes. Requires staging tests and app-specific native functionality; remote-only delivery carries App Store review risk. |
| Locally bundled static UI | Not selected. The current SSR/API architecture means compatibility is unproven; a static export could break protected pages and server behavior. |
| Separate React Native / Expo UI | Not selected for this work because the requirement is to reuse the same Next.js UI/codebase. Existing `apps/mobile/` remains isolated and unchanged. |

**Exit criteria before implementation can be called complete:** staging origin and credentials exist; the smoke matrix above passes on both platforms; native URL listener and share are implemented and device-tested; push and StoreKit/server verification are implemented; final identifiers and signing are confirmed; and App Store policy risk is reviewed. Current status is **architecture selected for staging prototype; implementation and device validation incomplete**.


### 5. Vercel preview environment audit — 2026-10-28

Read-only inspection of the current preview deployment and Vercel environment-variable metadata found:
- Candidate preview `hoopcheck-cs2e746tl-hoopcheck.vercel.app` is `READY`, sourced from branch `feat/capacitor-native-shell` at commit `a13532281cb1cd9184886a3eb43c93b86676b97d`, and the homepage returned HTTP 200.
- This confirms the preview responds, **not** that it is an isolated staging environment.
- Supabase environment-variable entries include shared Preview targets as well as Production/Development targets for public Supabase configuration. This audit did not decrypt or retrieve secret values, and did not establish which Supabase project the deployed preview actually uses.
- Stripe live-mode flags and secret/price variables are targeted to Production. The visible Stripe test-mode Preview entries are branch-specific to `fix/stripe-webhook-environment-guard`, not the native-shell branch. Therefore the current preview's effective checkout configuration has not been proven safe for checkout testing.
- No Vercel custom environment is configured for the project.

**Decision:** do not use this preview for auth mutations, account creation, uploads, or checkout tests until its effective Supabase project and payment-mode behavior are verified. Do not assume that a successful HTTP 200 or Production-only Stripe variable targets proves complete isolation. Do not retrieve/decrypt secrets as part of this audit.

Next safe step: create or designate an isolated staging Supabase project and staging deployment configuration, including explicit non-production Stripe test settings, then verify the deployed runtime behavior with read-only smoke checks before testing user journeys. Keep production data, environment settings, payment configuration, and deployment untouched.
