# HoopCheck Mobile (Expo)

This isolated React Native / Expo app does not replace or modify the Next.js website.

## Current milestone

- Welcome screen with Sign in and Create an account actions.
- Supabase email/password sign-in and session-aware route protection.
- Native sign-up fields for account type, name, username, birthdate, gender, email and password.
- Client-side 18+ eligibility check and Terms/Privacy/Community Guidelines acknowledgement aligned to the current web signup metadata.
- Password reset request screen.
- Authenticated placeholder screen with account details and sign out.

**Not yet release-ready:** no install, typecheck, native build or device test has been run. The dashboard is only a placeholder; no player search, reviews, subscriptions, account deletion, support tickets or moderation features are wired in.

## Local setup

1. Install a Node.js version compatible with the pinned Expo SDK.
2. From this directory, install dependencies.
3. Copy .env.example to .env.local.
4. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY using the existing Supabase project's public client configuration. Never use a service-role key in a mobile app.
5. Run npm run start and use Expo Go or a development build as appropriate for the selected SDK.

## Required before store release

- Confirm final Apple bundle identifier and Android application ID; current com.example.hoopcheck identifiers are placeholders.
- Configure and test email verification, password-recovery callback/deep links, and any OAuth callback URLs.
- Verify signup metadata against the live auth/profile trigger and schema. Client-side age checks improve UX but are not a security boundary; enforce eligibility on trusted backend paths too.
- Review Supabase RLS, RPC grants, storage policies, and each API route before connecting a feature.
- Decide compliant iOS/Android subscription billing for digital features. No real payment tests are permitted in this phase.
- Implement account deletion, privacy disclosures, user-generated-content reporting/moderation, accessibility, and device testing.
- No store submission, production deployment, database changes or real payment tests without explicit approval.
