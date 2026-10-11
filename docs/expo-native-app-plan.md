# HoopCheck React Native / Expo App Plan

## Goal and guardrails

Build a dedicated iOS and Android app using React Native and Expo while retaining the existing production website and Supabase project. This is a planning milestone only: do not modify production website behavior, change the live database, test real payments, merge this work, or submit to either app store without explicit owner approval.

Repository: https://github.com/jacoriejay-afk/Hoopcheck
Current web app: Next.js / React / TypeScript
Backend to reuse: existing Supabase Auth, Postgres, Storage/RPCs and current authorization policies.

## Recommended shape

- Create a separate app workspace (suggested path: `apps/mobile`) with Expo, React Native, TypeScript and Expo Router.
- Keep the current Next.js web app and its deployment configuration intact.
- Connect mobile directly to the existing Supabase project using `@supabase/supabase-js` and `react-native-url-polyfill`; use `expo-secure-store` for persistent auth sessions and configure AppState-based token refresh.
- Use only the Supabase project URL and publishable/anon key in the mobile client. Never bundle the service-role key, Stripe secret, database password, or other server secrets.
- Reuse the existing database and authorization policies, not a second database. Confirm every mobile-used table, view and RPC against current schema/policies before wiring it up.
- Keep privileged operations on trusted server-side endpoints or tightly authorized database functions. Mobile UI visibility is not an authorization boundary.

## Initial navigation and screens

1. Welcome / public product explanation with Sign in and Create account.
2. Authentication: email/password, password reset, email verification, and supported OAuth flows only after deep-link callback testing.
3. Home / dashboard with compact cards and one consistent navigation pattern.
4. Search: professional players, coaches, teams and leagues supported by existing data. Do not add a women's HoopCheck category to Find Player.
5. Detail pages for player/coach/team/league, with accessible review summaries and subscription-gated full content.
6. Review submission, report review, community guidelines and moderation states.
7. Subscription / access screen that accurately explains plans without initiating a real charge in development.
8. Support ticket creation and status, Terms, Privacy Policy, Community Guidelines and Privacy Request Center.
9. Account settings, sign out, and account deletion with clear confirmation and success/error states.
10. Admin/moderation screens are not part of the first public mobile build unless role checks, least privilege, and a separate access review explicitly approve them.

## Suggested implementation milestones

### M0 — Audit and mobile foundation
- Inspect existing routes, auth helpers, generated database types, schema, storage use, RPCs and current Stripe/paywall behavior.
- Confirm the existing Supabase URL/key configuration method without copying secrets into Git.
- Scaffold Expo app in a separate directory; add app-specific scripts and environment example containing placeholders only.
- Set bundle identifiers only after owner confirms final reverse-DNS identifiers and brand assets.
- Establish lint/typecheck/test commands and an isolated development build profile.

**Exit criteria:** app starts in Expo development mode; TypeScript and lint pass; no production web files or settings changed.

### M1 — Authentication and navigation
- Configure SecureStore-backed Supabase session persistence, refresh lifecycle and deep links.
- Implement sign-in, sign-up, password reset, email verification handling, loading, empty, offline and error states.
- Verify account isolation and session expiry with test accounts only.

**Exit criteria:** sign-in/out and session restoration pass on iOS and Android simulators/devices; no secret credentials in bundle or logs.

### M2 — Read-only product experience
- Implement compact home, search, and detail screens.
- Add pagination, query limits, safe error handling and loading skeletons.
- Use existing data and RLS; do not seed or modify production data merely for visual testing.

**Exit criteria:** authorized test users can browse supported data without exposing restricted reviews or private account information.

### M3 — Reviews, support, privacy and deletion
- Add review submission and moderation/reporting flows only after confirming existing schema and policies.
- Add support, legal pages, privacy requests and account deletion.
- Confirm deletion behavior covers the auth account and associated personal data according to the actual policy and legal requirements.

**Exit criteria:** test cases for submit, report, moderation state, support ticket and deletion pass in a non-production/test environment.

### M4 — Subscription policy decision (no real payment testing)
- Before implementing purchase UI, decide the permitted billing model for digital subscription features under current Apple and Google rules.
- Assess Apple In-App Purchase and Google Play Billing requirements, entitlement synchronization, restore purchases, cancellations/refunds, server notifications and web-vs-mobile entitlement parity.
- Existing Stripe web checkout must not simply be assumed compliant inside native apps. Do not launch an external purchase flow or add a payment SDK until the policy and product decision is approved.
- Use mocked entitlement states for UI development; do not create real charges or alter Stripe products/prices/webhooks.

**Exit criteria:** documented billing decision and approved test strategy; no live transactions performed.

### M5 — Quality, privacy and store readiness
- Test current iOS and Android OS/device coverage, small screens, light/dark mode, accessibility, poor connectivity, session expiry, deep links, crash behavior and performance.
- Verify privacy/support/legal URLs and make sure store privacy disclosures match actual SDK/data collection.
- Complete account deletion and user-generated-content moderation/reporting requirements.
- Prepare app icons, splash assets, screenshots, metadata, age/content ratings, support contact, privacy disclosures, reviewer instructions and test credentials.
- Use internal/TestFlight and Play internal testing tracks only after owner authorizes builds and has reviewed the proposed configuration.
- Store submission remains a separate approval gate.

**Exit criteria:** reproducible builds and release checklist passed; owner reviews all store metadata and explicitly approves any submission.

## Security and configuration

- Keep `.env`, signing credentials, provisioning profiles, service-role keys and API secrets out of Git.
- Add a tracked `.env.example` with placeholder names only; use local ignored env files or approved CI secrets for actual values.
- Validate deep links and redirect allowlists; never accept arbitrary redirect URLs from untrusted input.
- Do not trust client-provided role, plan, price, review status or user ID for authorization.
- Confirm RLS on every accessed table/view and EXECUTE grants for every RPC. Treat existing web security checks as a starting point, not proof that the mobile client is safe.
- No screenshots/recording protection is guaranteed across iOS and Android; evaluate platform-specific options only if requested and do not claim perfect prevention.

## Open decisions before implementation

1. Confirm the final iOS bundle ID and Android application ID.
2. Confirm the official app display name, icon, splash assets and support contact.
3. Resolve the inconsistent Premium pricing references in existing project documentation before publishing any price in store metadata. Do not change live prices without approval.
4. Approve a compliant subscription/billing design for digital content.
5. Decide whether mobile v1 includes only player search/reviews or all coach/team/league flows.
6. Identify a safe non-production Supabase environment or agree on tightly controlled test-account use. Avoid migrations or destructive tests against production.

## Current status

Planning only. This document does not scaffold the app, change the live site or database, run payment tests, merge code, create signed store builds, or submit to Apple or Google.
