# StoreKit membership candidate — in progress

Owner-confirmed catalog (2026-11-19), one group: **HoopCheck Membership**.
Premium ranks above Pro. No native fan products exist.

| Tier | Product | Period | Reference USD | Trial |
| --- | --- | --- | --- | --- |
| Pro | hoopcheck.pro.monthly | Monthly | $4.99 | 7 days |
| Pro | hoopcheck.pro.6month | 6 months | $26.95 | None |
| Pro | hoopcheck.pro.annual | Annual | $50.90 | None |
| Premium | hoopcheck.premium.monthly | Monthly | $9.99 | 7 days |
| Premium | hoopcheck.premium.6month | 6 months | $53.95 | None |
| Premium | hoopcheck.premium.annual | Annual | $101.90 | None |

Display StoreKit's actual localized price and subscription terms. Monthly trials
are once per HoopCheck user and for first-time payers only, combined with Apple's
subscription-group eligibility. The server must sign introductory offer eligibility
using the Apple **In-App Purchase** key, not an App Store Connect API key. Keys stay
in protected server configuration; none is requested in chat or committed.

References:
- https://developer.apple.com/documentation/storekit/generating-jws-to-sign-app-store-requests
- https://developer.apple.com/documentation/storekit/product/purchaseoption/introductoryoffereligibility(compactjws:)
- https://apple.github.io/app-store-server-library-node/classes/SignedDataVerifier.html
- https://apple.github.io/app-store-server-library-node/classes/IntroductoryOfferEligibilitySignatureCreator.html

No purchase is enabled until server verification, database configuration, signed
trial eligibility and isolated end-to-end verification are complete. This document
is a working implementation record, not a release-readiness assertion.

## Backend candidate implemented (not deployed)

Apple's official server library 3.1.0 verifies pinned Apple CA chains with online
revocation/current-time checks. Bundle, App Store ID, environment, transaction
ownership, supported products and trial terms are checked before persistence.
Live App Store Server API status and signed renewal information determine access;
a device result never grants membership optimistically. API acknowledgement is
returned only after persistence. Unknown-owner notifications wait for authenticated
restore; notifications cannot transfer an existing purchase between accounts.

Production database host `ucbdceaieyenljcwlhnj.supabase.co` and Vercel production
reject Sandbox configuration. Both a disabled-by-default server flag and matching
explicit database configuration must be enabled in the isolated environment.
Do not paste credentials into chat. Required protected server variables:

- APPLE_IAP_ENABLED=true
- APPLE_IAP_ENVIRONMENT=Sandbox (isolated project only; Production for approved release)
- APPLE_IAP_KEY_ID, APPLE_IAP_ISSUER_ID, APPLE_IAP_PRIVATE_KEY (Apple In-App Purchase key)
- Existing Supabase server/publishable configuration and Stripe read credentials
  for verified historical first-payer checks

`20261119043244_storekit_membership_sources.sql` is UNAPPLIED. It adds independent
Apple ownership/transaction/trial records, an owner-readable membership projection,
and service-only RPCs. Stripe tables, invoices, commissions and refunds are not
rewritten. Original ownership is immutable; callbacks and restores are idempotent,
and older state cannot revive a revoked entitlement. Trial claims bind one user to
one Apple app identity; unknown payment history never authorizes a trial. Purchase
intent preparation has a persistent per-user rate limit.

Existing JS tests explicitly allow stale access_status when billing status is
active, while several SQL predicates explicitly require that legacy flag. Preserve
both contracts: membership_entitlements selects the effective billing source;
membership_authorizations selects the eligible source for SQL rules that inspect
access_status. All nested views use security_invoker and the underlying ownership
and MFA policies. Existing function/policy predicates, privileges and roles remain;
only their subscription source changes. The private is_active_subscriber helper is
included. A valid lower Apple source can survive a higher ineligible Stripe row.
Apple verification expires after 36 hours without revalidation; authenticated
membership reads refresh stale Apple status before returning access.

Local evidence so far: fourteen server cases, local PGlite and CI PostgreSQL 16 ownership/idempotency/
trial/rate/MFA/RLS/Stripe-coexistence/refund/verification-lease fixtures, existing
entitlement matrix, TypeScript/ESLint, website production build and certificate-file
tracing. The native bridge's real Swift policy tests and full unsigned simulator app
compile passed in CI without EAS. Actual Sandbox purchase, notification delivery,
restoration and upgrade/downgrade remain required; no physical test is claimed.

Native integration now includes the membership screen, localized prices, explicit
trial/full-price confirmation, user-initiated restoration and Apple management,
foreground/startup transaction scans and one root observer. Scopes bind every
asynchronous result to a session owner and generation. Account changes invalidate
pending receipts immediately in the synchronous Auth callback. Only an owner-matched
server acknowledgement permits native finish; unknown writes stay unfinished.
Automatic scans never call AppStore.sync. Missing native modules or invalid optional
billing configuration cannot prevent startup. The screen adds no native Modal.

Native bootstrap reads membership_entitlements and refreshes on foreground, Auth
changes and a 15-minute foreground interval. Bounded session reads recover instead
of leaving account loading indefinitely. A successful receipt batch coalesces account
refreshes. Existing expiry, role, moderation and independently verified admin rules
still determine feature access. The membership and account-security paths are added
to the owner-confirmed universal-link association.

Validation: all 166 native cases; 18 transaction coordinator regressions; six actual
screen/hook regressions including both themes, background clearing and stale-account
preparation; two actual shared-button tests. The shared button now wraps interpolated
JSX labels in native Text, fixing confirmed media photo action labels. Mobile
TypeScript and changed-file ESLint pass. iOS Hermes export 7.17 MB, web export 4.30 MB.
Ten isolated browser suites pass: membership (player/fan, light/dark), MFA, media,
profile editor, player profiles, feed/Reels, Live Games/chat, club groups, discovery
and appearance. No browser or renderer result establishes physical UIKit behavior.

Website entitlement readers and provider-aware billing controls are the next focused
integration. Existing website billing must not infer that an Apple source can be
cancelled through Stripe. Both new migrations and code dependencies require an
isolated deployment/review before production activation.

Sandbox uses Apple's accelerated subscription clocks and may omit appAppleId;
production still requires App Store ID 6835366982 and a seven-day trial receipt.
Verified Sandbox dates never extend access to the advertised seven days. Exact
seven-day introductory metadata is checked by the native product policy in both
environments. See https://developer.apple.com/help/app-store-connect/test-in-app-purchases/manage-sandbox-apple-account-settings/
and Apple's official SignedDataVerifier environment-specific identifier checks.
