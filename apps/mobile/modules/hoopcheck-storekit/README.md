# HoopCheck StoreKit 2 bridge

Apple-only local module scaffolded with the SDK-compatible
`create-expo-module@sdk-55` CLI and adapted to Expo SDK 54's existing Module DSL.
It adds no external native dependency or signing entitlement. The app still loads
when the module is absent (existing builds, Expo Go, web and Android).

The bridge verifies StoreKit transactions locally, returns Apple's signed proof,
passes the signed-in user's UUID as appAccountToken and retains unfinished
transactions until server acknowledgement. Restore invokes AppStore.sync only on
explicit user action. The update listener stops with the last JS observer/module.
Unknown products and unverified purchases cannot grant access. No JS entitlement
is granted by this module; server verification and membership integration are
separate required gates. Purchases need iOS 16+ for signed AppTransaction identity;
restoration remains supported at the app's existing iOS 15.1 deployment target.

Catalog validation enforces owner-confirmed duration, US-storefront USD reference pricing,
seven free days for monthly products and no introductory offers on six-month or
annual products. Localized StoreKit display prices remain authoritative elsewhere, including other USD storefronts. The device locale is not used to guess the billing storefront.
Monthly purchases require a server-signed introductory eligibility decision. App
Store account or price changes require reloading before purchase.

Unsigned iOS Native Verification compiles the actual StoreKit core with Swift
policy tests and builds the simulator app/Expo bridge with signing disabled. It
uses no EAS build, credentials, OTA, store upload or billable Expo simulator.
Physical purchase/restore/Ask to Buy and App Store configuration are still gates.
