# HoopCheck Mobile (Expo)

This isolated React Native / Expo app does not replace or modify the Next.js website.

## Current milestone

- Welcome screen with Sign in and Create an account actions.
- Supabase email/password sign-in and session-aware route protection.
- Native sign-up fields for account type, name, username, birthdate, gender, email and password.
- Client-side 18+ eligibility check and Terms/Privacy/Community Guidelines acknowledgement aligned to the current web signup metadata.
- Password reset request and new-password screens using Supabase recovery codes and the `hoopcheck://reset-password` deep link.
- Authenticated dashboard with Supabase-backed search directories for active men’s teams and leagues, paginated results, refresh, and search by name/location/level.
- GitHub Actions mobile TypeScript and Expo dependency/configuration diagnostics have passed on the latest recovery-flow commit. Directory changes are being checked now.

**Not yet release-ready:** no native iOS/Android build or physical-device recovery test has been completed. Coach search, reviews, subscriptions, account deletion, support tickets and moderation features are not wired into the mobile app.

## Local setup

1. Install a Node.js version compatible with the pinned Expo SDK.
2. From this directory, install dependencies.
3. Copy .env.example to .env.local.
4. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY using the existing Supabase project's public client configuration. Never use a service-role key in a mobile app.
5. Run npm run start and use Expo Go or a development build as appropriate for the selected SDK.

## Required before store release

- Confirm final Apple bundle identifier and Android application ID; current com.example.hoopcheck identifiers are placeholders.
- In Supabase Authentication URL Configuration, add `hoopcheck://reset-password` to the allowed redirect URLs; then test recovery from an actual email on iOS and Android. Configure and test email verification and any OAuth callback URLs too.
- Verify signup metadata against the live auth/profile trigger and schema. Client-side age checks improve UX but are not a security boundary; enforce eligibility on trusted backend paths too.
- Review Supabase RLS, RPC grants, storage policies, and each API route before connecting a feature.
- Decide compliant iOS/Android subscription billing for digital features. No real payment tests are permitted in this phase.
- Implement account deletion, privacy disclosures, user-generated-content reporting/moderation, accessibility, and device testing.
- No store submission, production deployment, database changes or real payment tests without explicit approval.
