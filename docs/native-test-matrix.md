# HoopCheck Native Test Matrix

Status: planned. No signed native build or real-device test has been produced yet.

| Area | Required proof | Status |
| --- | --- | --- |
| Branch CI | Locked install, URL regression tests, ESLint and TypeScript check on PR | First run: install, URL tests and ESLint passed; TypeScript check failed on two configuration/import errors. Fixes committed; rerun result still pending |
| Canonical URL tests | Trusted origin, allowed entity routes, rejected hosts/schemes/paths, query and fragment behavior | First CI run passed all authored URL tests |
| Capacitor build | iOS and Android builds install on devices | Blocked: platform projects, toolchain and signing not configured |
| Icon/splash | Existing approved HoopCheck logo exported to platform sizes | Pending source asset/export confirmation |
| Universal Links | https://hoopcheck.online/teams/... opens same team route | Blocked: Apple Team ID and final app association |
| Android App Links | Canonical URL opens app | Blocked: signing certificate SHA-256 |
| Entity share UI | Team/player profiles expose a share action using Web Share API with clipboard fallback; canonical URL validation added | Implemented on feature branch; build/device test pending |
| Push token | APNs/FCM registration and authenticated token association | Blocked: provider credentials/backend endpoint |
| Push deep link | Real push tapped from foreground/background/terminated state opens exact team | Not tested |
| Apple IAP products | One group, Pro $4.99/month and Premium $9.99/month | Blocked: App Store Connect setup/access |
| Server validation | Signed StoreKit transaction verified; notifications idempotent | Not implemented/verified |
| Existing Stripe entitlement | Active web subscriber signs into iOS and retains current tier | Must test after shared resolver |
| Restore | Restore on fresh install unlocks correct tier for same HoopCheck account | Not tested |
| Subscription lifecycle | Purchase, cancel, expiry, resubscribe, restore | Not tested on sandbox device |

## Additional implementation checkpoint — 2026-10-27

- [x] Additive database migration drafted on this feature branch for `public.apple_subscription_transactions`, separate from Stripe's `public.subscriptions` row. It permits authenticated users to read only their own records and provides no client write policies.
- [ ] Review migration against the live Supabase schema, extension availability, RLS conventions and backup/rollback plan.
- [ ] Implement server-side StoreKit JWS signature verification, App Store Server API transaction lookup, authenticated user ownership binding, idempotent notification handling, and writes to the new table.
- [ ] Implement the canonical entitlement resolver and migrate every relevant API/client/SQL policy to use verified provider entitlements without changing tier feature definitions.
- [ ] Confirm proposed Apple product IDs are unused and create the products in App Store Connect. The IDs in the migration are proposed, not verified as available.
- [ ] Run SQL migration in a non-production environment and test RLS using two accounts plus service-role writes before any production rollout.

Important: this is schema groundwork only. It does not validate purchases, unlock tiers, or alter live database behavior until reviewed and applied.

## Next implementation gate — production shell delivery

A remote URL inside the WebView is not sufficient proof of a shippable Capacitor app. Before generating signed platform projects, choose and validate one delivery architecture that keeps a single Next.js UI codebase:

1. **Hosted Next.js UI in the native WebView** with API/SSR preserved. This is the least disruptive technically, but requires an App Review readiness check because a thin website wrapper may fail minimum-functionality review. It also depends on network access for the main UI.
2. **Bundled web UI with hosted APIs** only if the Next.js app can be built for a supported client-rendered/static route set without breaking server components, auth callbacks, dynamic routes, or API usage. The current app has not been shown to support static export; do not switch `output: "export"` on speculatively.

No architecture has been validated in a device build yet. Do not claim the existing `server.url` scaffold is a production build configuration. Keep production web hosting and Stripe behavior unchanged while this gate is open.

## Native push acceptance contract

A push payload must carry a canonical HTTPS URL on `hoopcheck.online` (for example `https://hoopcheck.online/teams/<team-id>`) rather than an arbitrary URL. The native URL handler must reject other hosts/schemes, preserve valid path and query, and route through the same web UI. Associate device tokens only with the authenticated HoopCheck user, handle token rotation/logout, and avoid including private review text in push payloads. A test counts as passed only after an actual APNs/FCM delivery is tapped from foreground, background, and terminated states on a device and the expected team route is visible.

## Apple entitlement acceptance contract

- Apple transaction data must be cryptographically verified on the server and reconciled with App Store Server API state before any access change.
- A transaction's account ownership must be bound to the signed-in HoopCheck account; do not accept a client-supplied user ID as proof of ownership.
- Apple subscription records must remain separate from the existing Stripe-shaped `public.subscriptions` row.
- Shared entitlement logic must be adopted by all relevant API routes and SQL RLS/policies before Apple purchases can unlock gated features. Until then, do not surface a purchase action that could charge a user without granting consistent access.
- Keep Pro at $4.99/month and Premium at $9.99/month. Product IDs in the migration remain proposals until confirmed in App Store Connect.
- Sandbox proof must include initial purchase, entitlement unlock, cancellation with access through paid-through date, resubscription, and restore on a fresh install. Record the build number, sandbox account, transaction environment, and observed result for each test.

## Push token storage groundwork — 2026-10-27

- [x] Added a branch-only additive migration for `public.native_device_tokens` with platform/provider validation, token uniqueness, active status, and last-seen timestamps.
- [x] Enabled row-level security with no end-user policies; the intended access path is through authenticated server-side registration and delivery handlers.
- [ ] Review and test the migration in non-production Supabase, including UUID generation and service-role access.
- [ ] Implement registration from the verified Supabase session, token rotation, logout deactivation, provider delivery, retries, and invalid-token handling.
- [ ] Connect review creation and the existing live-game reminder event to notification jobs, then test push deep links on physical devices.

The migration has not been applied and does not send notifications by itself.

## Share helper added — 2026-10-27

- Added `lib/native-links.ts` to validate canonical team/player/coach/league/women's-team HTTPS URLs on `hoopcheck.online` and reject other origins or unsupported paths.
- Added `components/ShareEntityButton.tsx` and wired it into team and player profile actions. It uses Web Share where available and clipboard fallback otherwise.
- Added `lib/native-links.test.ts` with regression cases for allowed routes, untrusted hosts/schemes, unsupported paths, query preservation, fragment removal, and unexpected ports.
- Added `npm run test:native-links` using Node's built-in test runner and TypeScript type stripping; CI runs this before lint/type-check.
- The first GitHub Actions run **passed** the URL test command and ESLint. TypeScript then failed because the Capacitor config imported types from an uninstalled package and the test's explicit `.ts` import was not allowed by the project config.
- Follow-up commits remove the Capacitor type import from the config and enable `allowImportingTsExtensions` in `tsconfig.json`. A fresh CI run is still required before calling the type-check fixed.
- This is a web-compatible share implementation, not proof that Capacitor's native Share plugin is installed or that a native share sheet works in a signed app. Device testing remains required.
- URL validation is a navigation safety guard only; it does not grant access or authenticate a user.

## Continuous integration added — 2026-10-27

- Added `.github/workflows/native-branch-check.yml` on this branch. Pull requests to `main` that change app code or core package/type-check configuration run `npm ci`, `npm run test:native-links`, `npm run lint`, and `npx tsc --noEmit`.
- First observed run: locked install, URL tests, and lint passed; type-check failed on the two issues documented above. Fix commits are on the branch, but their workflow result is pending.
- Native signing, native platform builds, Supabase migration tests, App Store sandbox purchases, and device push/share tests remain outside this CI job.
