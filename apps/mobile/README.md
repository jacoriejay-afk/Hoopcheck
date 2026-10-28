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
- Membership screen displays the fixed Pro ($4.99/month) and Premium ($9.99/month) prices and is linked from the authenticated dashboard. It is intentionally informational only: purchase and restore controls remain unavailable until StoreKit, signed transaction verification, and server-side entitlement reconciliation are implemented.
- Mobile Apple billing includes an authenticated account-token client helper. It requires the signed-in Supabase access token and validates the server response; this does not itself make purchases or grant membership.
- Apple transaction ownership has a separate server-side fail-closed gate (`lib/billing/apple-iap-ownership.ts`). It requires an authenticated HoopCheck user, a transaction already verified by Apple's signed-data verifier, and an `appAccountToken` matching the trusted server-stored UUID. This gate is not yet connected to StoreKit or entitlement writes and never grants access on its own.
- Team and league detail screens include read-only latest-review summaries. Review reads use the signed-in Supabase client and existing row-level security; the app does not bypass subscription policies or expose author identities.
- Team detail includes a native team-review form with five rating categories, season, optional title, written review, and anonymous display preference. It sends the signed-in access token to the existing `/api/reviews` endpoint; the server remains responsible for email confirmation, verified-player status, active membership, verified team affiliation, and moderation status. The form is unavailable until `EXPO_PUBLIC_HOOPCHECK_API_URL` is configured to the previous Vercel production alias `https://hoopcheck-nine.vercel.app` or another active deployment origin.
- Player search directory includes public, non-suspended professional profiles from men’s and women’s basketball. It initially shows no players and searches by username only after the user enters at least two characters and submits; selecting a result opens a public profile detail screen showing only public-facing basketball and biography fields.
- Coach directory backed by the existing active coach table, with search by name and location and an explicit empty state when there are no records.
- Dashboard links to the existing website’s Support, Terms, Privacy Policy, Community Guidelines, Privacy Request Center, and Account settings pages.
- The repository now has a path-filtered GitHub Actions workflow for mobile TypeScript typechecking and Expo Doctor. Passing these checks does not establish that native builds, password recovery on a device, or the live signup trigger have been validated. The signup migration is still review-only and has not been applied to Supabase. It validates account type, username format, player position/years pro, boolean metadata, and the terms-acceptance timestamp on the trusted trigger path; the SECURITY DEFINER trigger uses an empty search path and schema-qualified table references.

**Not yet release-ready:** no native iOS/Android build or physical-device recovery test has been completed. The mobile app does not include purchase/restore subscription flows, account deletion, support-ticket creation, or user moderation/reporting screens. Team review submission depends on the existing web API and still needs a configured API origin plus end-to-end verification in a safe test environment. The live coach table was empty when inspected, so no coaches are fabricated.

## EAS build profiles

`eas.json` defines internal development and preview profiles plus a production build profile. This is configuration only: no EAS build has been started, no signing credentials have been created, and no store submission has occurred. Do not start a store build until the final iOS bundle identifier and Android application ID replace the `com.example.hoopcheck` placeholders and the remaining release checklist is reviewed.

## Local setup

1. Install a Node.js version compatible with the pinned Expo SDK.
2. From this directory, install dependencies.
3. Copy .env.example to .env.local.
4. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY using the existing Supabase project's public client configuration. Never use a service-role key in a mobile app.
5. Set `EXPO_PUBLIC_HOOPCHECK_API_URL` to `https://hoopcheck-nine.vercel.app` (previous Vercel alias; confirm that the alias is active before relying on it) or another active deployment origin to enable team-review submission.
6. Run npm run start and use Expo Go or a development build as appropriate for the selected SDK.

## Required before store release

- Confirm final Apple bundle identifier and Android application ID; current com.example.hoopcheck identifiers are placeholders.
- In Supabase Authentication URL Configuration, add `hoopcheck://reset-password` to the allowed redirect URLs; then test recovery from an actual email on iOS and Android. Configure and test email verification and any OAuth callback URLs too.
- Review and apply `supabase/migrations/20261011160000_fix_signup_profile_metadata.sql` through the normal database release process. Inspection found the existing `handle_new_user` trigger omits `first_name`/`last_name` and `basketball_type`, so client-sent values are not persisted as intended (female player accounts currently inherit the table default `mens`). This migration is committed for review only and has not been run against the live database.
- Client-side age checks improve UX but are not a security boundary; enforce eligibility on trusted backend paths too.
- Review Supabase RLS, RPC grants, storage policies, and each API route before connecting a feature.
- Decide compliant iOS/Android subscription billing for digital features. No real payment tests are permitted in this phase.
- Implement account deletion, privacy disclosures, user-generated-content reporting/moderation, accessibility, and device testing.
- No store submission, production deployment, database changes or real payment tests without explicit approval.
