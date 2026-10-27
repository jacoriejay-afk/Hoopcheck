# HoopCheck Native Test Matrix

Status: planned. No signed native build or real-device test has been produced yet.

| Area | Required proof | Status |
| --- | --- | --- |
| Capacitor build | iOS and Android builds install on devices | Blocked: platform projects, toolchain and signing not configured |
| Icon/splash | Existing approved HoopCheck logo exported to platform sizes | Pending source asset/export confirmation |
| Universal Links | https://hoopcheck.online/teams/... opens same team route | Blocked: Apple Team ID and final app association |
| Android App Links | Canonical URL opens app | Blocked: signing certificate SHA-256 |
| Native share | Share team/player URL to another app | Not tested |
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