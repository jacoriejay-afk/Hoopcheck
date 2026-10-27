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