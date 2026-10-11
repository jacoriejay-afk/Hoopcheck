# HoopCheck Mobile (Expo)

This isolated React Native / Expo app does not replace or modify the Next.js website.

## Current milestone

- Welcome screen with Sign in and Create an account actions.
- Supabase email/password sign-in and session-aware route protection.
- Native sign-up fields for account type, name, username, birthdate, gender, email and password.
- Client-side 18+ eligibility check and Terms/Privacy/Community Guidelines acknowledgement aligned to the current web signup metadata.
- Password reset request and new-password screens using Supabase recovery codes and the `hoopcheck://reset-password` deep link.
- Authenticated dashboard with Supabase-backed search directories for active men’s teams and leagues, paginated results, refresh, and search by name/location/level.
- Team and league detail screens that show available directory fields, link to validated HTTP(S) official websites when listed, and include contract-verification cautions.
- Player search directory limited to public, non-suspended, men’s professional profiles, with search by name, username, team and country; selecting a result opens a public profile detail screen showing only public-facing basketball and biography fields.
- Coach directory backed by the existing active coach table, with search by name and location and an explicit empty state when there are no records.
- Dashboard links to the existing website’s Support, Terms, Privacy Policy, Community Guidelines, Privacy Request Center, and Account settings pages.
- GitHub Actions mobile TypeScript checks, Expo dependency/configuration diagnostics, main CI, and launch gate passed on commit `b697020` (scrollable dashboard and help/privacy links). The latest checks passed on commit `03b02c6` (mobile typecheck, Expo dependency/configuration diagnostics, main CI, and launch gate). The signup migration is still review-only and has not been applied to Supabase. Its latest revision also validates account type, username format, player position/years pro, boolean metadata, and the terms-acceptance timestamp on the trusted trigger path.

**Not yet release-ready:** no native iOS/Android build or physical-device recovery test has been completed. Reviews, subscriptions, account deletion, support tickets and moderation features are not wired into the mobile app. The live coach table was empty when inspected, so no coaches are fabricated.

## EAS build profiles

`eas.json` defines internal development and preview profiles plus a production build profile. This is configuration only: no EAS build has been started, no signing credentials have been created, and no store submission has occurred. Do not start a store build until the final iOS bundle identifier and Android application ID replace the `com.example.hoopcheck` placeholders and the remaining release checklist is reviewed.

## Local setup

1. Install a Node.js version compatible with the pinned Expo SDK.
2. From this directory, install dependencies.
3. Copy .env.example to .env.local.
4. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY using the existing Supabase project's public client configuration. Never use a service-role key in a mobile app.
5. Run npm run start and use Expo Go or a development build as appropriate for the selected SDK.

## Required before store release

- Confirm final Apple bundle identifier and Android application ID; current com.example.hoopcheck identifiers are placeholders.
- In Supabase Authentication URL Configuration, add `hoopcheck://reset-password` to the allowed redirect URLs; then test recovery from an actual email on iOS and Android. Configure and test email verification and any OAuth callback URLs too.
- Review and apply `supabase/migrations/20261011160000_fix_signup_profile_metadata.sql` through the normal database release process. Inspection found the existing `handle_new_user` trigger omits `first_name`/`last_name` and `basketball_type`, so client-sent values are not persisted as intended (female player accounts currently inherit the table default `mens`). This migration is committed for review only and has not been run against the live database.
- Client-side age checks improve UX but are not a security boundary; enforce eligibility on trusted backend paths too.
- Review Supabase RLS, RPC grants, storage policies, and each API route before connecting a feature.
- Decide compliant iOS/Android subscription billing for digital features. No real payment tests are permitted in this phase.
- Implement account deletion, privacy disclosures, user-generated-content reporting/moderation, accessibility, and device testing.
- No store submission, production deployment, database changes or real payment tests without explicit approval.
