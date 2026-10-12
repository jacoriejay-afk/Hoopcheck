# Mobile backend integration audit (initial)

## Findings from repository inspection

- The current web app uses Next.js 16 / React 19 and Supabase SSR for browser/server authentication.
- The web configuration uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; the mobile app uses Expo-specific `EXPO_PUBLIC_*` names so native configuration is explicit.
- Existing Next.js API routes are not automatically mobile-ready. For example, account deletion and deactivation use server-side cookie sessions, while some API routes (such as review submission/reporting) explicitly read an Authorization bearer token. Each route must be inspected before the native app calls it.
- Mobile direct database access must follow the existing Supabase RLS and grants. The fact that a route or table is available to the web UI does not establish that direct native access is safe.
- Account deletion currently has a server-side route that uses privileged credentials. Mobile should call a properly authenticated server endpoint or a separately reviewed design; never place the service-role key in the app.
- Existing Stripe checkout and subscription management are web-centric. No Stripe checkout call is included in the mobile scaffold, and no payment flow should be implemented until store billing requirements are decided.

## Required endpoint-by-endpoint review

Before connecting each feature, classify its data path as:
1. direct Supabase query protected by verified RLS/grants;
2. existing API route verified to accept and validate a bearer token; or
3. API route that needs a separately reviewed mobile-auth implementation.

Do not broadly rewrite existing production routes just to support the mobile client. Prefer isolated, tested changes in a later PR, with explicit owner approval before any merge or deployment.

## Initial validation status

This is a source-code review, not a runtime security audit. It has not tested the Supabase project, run a native build, called production APIs, changed database policies, or tested payments. The mobile scaffold is not yet confirmed to compile.
