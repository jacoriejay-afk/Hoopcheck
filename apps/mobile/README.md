# HoopCheck Mobile (Expo)

This is an isolated React Native / Expo app workspace. It does not replace the Next.js website.

## Status

Early scaffold only. The welcome screen and an initial Supabase password sign-in flow are present. This has **not** been installed, typechecked, built, or tested on a device yet. It is not release-ready.

## Local setup

1. Install Node.js compatible with the pinned Expo SDK.
2. From this directory, install dependencies with your package manager.
3. Copy `.env.example` to `.env.local`.
4. Fill in `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` using the existing Supabase project's public client configuration. Never use a service-role key in the app.
5. Run `npm run start` and use Expo Go or a development build as appropriate for the selected SDK.

## Important release blockers

- Confirm final Apple bundle identifier and Android application ID. The current `com.example.hoopcheck` values are placeholders.
- Add sign-up, password reset, email verification, OAuth/deep-link callback support, session-aware routing and dashboard screens.
- Review actual Supabase schema, RLS policies, RPC permissions and storage policies before connecting each feature.
- Decide compliant iOS/Android subscription billing for digital features. No real payment tests are permitted in this phase.
- Complete native privacy disclosures, account deletion, user-generated-content reporting/moderation, accessibility and device testing.
- No store submission or production deployment without explicit approval.
