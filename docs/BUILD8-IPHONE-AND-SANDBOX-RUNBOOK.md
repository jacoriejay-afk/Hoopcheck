# Build 8 final iPhone and Sandbox verification

Status: preparation only. No build, distribution, production deployment/migration,
Apple enablement or purchase is authorized by this document. Record PASS/FAIL and
evidence for each numbered step; a blank result remains unverified.

## Owner checks before approving a build

1. Review PR #741's current source SHA and its CI results. The product source at
   `cd617139` passed all six workflows, including Main CI, Mobile checks and real
   unsigned simulator compilation after the search/migration compatibility fix.
2. On the owner's authenticated machine, from `apps/mobile`, use the official CLI:
   ```sh
   npx --yes eas-cli@latest whoami
   npx --yes eas-cli@latest project:info
   npx --yes eas-cli@latest build:version:get --platform ios --profile production --json
   ```
   Expected linked project: `62f822cb-ab9a-42ba-8456-007d2822ef70`,
   `@hoopcheck/hoopcheck-mobile`; bundle `online.hoopcheck.app`; version 0.2.0.
   Record the counter privately. AutoIncrement must produce a new unused number
   above the shipped 7; do not assume the counter is 7 or reset it to force 8.
3. Inspect existing managed iOS credentials for production in the Expo dashboard
   or `npx --yes eas-cli@latest credentials --platform ios`. View only: confirm
   Apple team, distribution certificate and profile validity/expiry, exact bundle
   ID, App Store distribution, Associated Domains capability and application-ID
   prefix `Y778LM35G5`. Do not download private keys, regenerate/revoke credentials
   or select setup/change actions during inspection. Account owner resolves any
   mismatch separately. App Store Connect app ID is `6835366982`.
4. Inspect production environment metadata privately. CLI help supports
   `eas env:list --environment production --scope project`; do not use
   `--include-sensitive` or `--include-file-content`, and do not paste output into
   chat because ordinary public/plain values may still be displayed. Confirm
   `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and
   `EXPO_PUBLIC_HOOPCHECK_API_URL` refer to one prepared backend/API; optionally
   confirm the public Sentry DSN. Never embed backend/Stripe/Apple secrets.
5. Approve and deploy the five reviewed backend migrations in release-report
   order using a mechanism that records their exact versions. First four prepare
   APIs/MFA/membership; deploy compatible clients before separately approving the
   private-column restriction. Do not blindly push all historical repository SQL.
   Verify existing Stripe/manual access and the deployed mobile bootstrap with
   authorized isolated test identities. Apple stays disabled for the core test.
6. With separate deployment approval, deploy the candidate website/API to the
   canonical domain. Verify the actual response, not proxy CONNECT status:
   ```sh
   curl --fail --silent --show-error -D aasa-headers.txt \
     https://hoopcheck.online/.well-known/apple-app-site-association \
     -o aasa.json
   ```
   Require final HTTP 200, JSON content type, no redirect/authentication wall, and
   app ID `Y778LM35G5.online.hoopcheck.app` matching signed entitlements. Auth,
   recovery, referral and unsupported nested paths must retain browser behavior.
7. Only after the above gates, request approval for the exact source, profile,
   backend, signing identity, expected build number and tester destination. No
   command to start a production build or submit it is run by this preparation.

## Core physical iPhone test — billing disabled

Use iPhone 14 Pro / iOS 26.6.2 first, matching the reported failure. Record actual
OS, build number, source SHA, API/database target, theme and timestamp. Use test
accounts, not personal credentials or production payment records. Preserve Build
7 logs/recordings before replacing it; do not delete a user's data to investigate.

1. Install the separately approved candidate. Capture a screen recording from
   first launch. Complete each onboarding panel and role choice; repeat with Skip
   using a separate fresh test install/device if needed. Require immediate visible
   press feedback, dismissal and working welcome links. No invisible touch blocker.
2. Sign in and scroll Home to Sign out and back. Open Teams/Leagues/Players cards,
   return Home, and tap every bottom tab. Repeat after force-quit/cold launch,
   warm launch and a restored session with unfinished onboarding. Record exact
   last successful tap if the interface stops responding.
3. Test email login, signup with verification, Google PKCE return, password-reset
   email and recovery deep link on the same device. Denied/expired OAuth/recovery
   must show recoverable errors. Never record passwords, codes or token URLs.
4. Launch offline/slow network, then reconnect; test Retry after failed auth,
   settings, MFA and account/bootstrap reads. Content stays concealed while
   identity/security is unknown. Loading must reach recovery controls, and a
   failed sign-out must display its error. Account switch must clear old drafts
   and private data; late responses must not restore the old identity.
5. With app lock enabled, background for less than five minutes, then at least
   five minutes. Test Face ID success, cancellation and passcode fallback; normal
   sign-in remains available. Test MFA challenge/enrollment/recovery/removal on
   isolated test accounts and both AAL1 denial and AAL2 recovery.
6. Exercise public/private player profiles, owner edits, avatar moderation, team
   profiles and real returned counts. Test HoopFeed create/comment/reply/save/
   poll/navigation, Live Games/chat, and HoopGroups join/post/comment/leave.
   Verify free/paid and player/fan/coach restrictions with the configured accounts.
   Missing counts must remain loading/unavailable, never fabricated.
7. Repeat key navigation, loading/error/empty states and keyboard/composer/sheets
   in light and dark modes. Check safe areas, scrolling, swipe-back, background
   return, VoiceOver, larger text and Reduce Motion. Browser results cannot pass
   these iPhone-specific checks.
8. Open allowed universal links from Notes/Messages/Safari after the approved
   AASA deployment and app install; verify the correct screen and return flow.
   Verify auth/recovery/referral exclusions continue their intended browser flow.
9. If frozen, record time, last route, onboarding state, network, lock setting and
   recording. With a Mac, connect the iPhone and capture Console entries filtered
   to HoopCheck while reproducing; export only relevant redacted errors. Also
   inspect Settings → Privacy & Security → Analytics & Improvements → Analytics
   Data for a HoopCheck crash/hang report. A hang may produce no crash report.
   Stop the release if taps AND scrolling fail. Do not treat force-quit as a fix.

## Separate Apple Sandbox test target

A TestFlight StoreKit transaction is Sandbox. The backend deliberately rejects
Sandbox against the production database or production Vercel environment. Thus
this requires a separately approved test configuration pointing at an isolated
prepared backend, not turning Sandbox on in production.

Before testing, record the exact candidate build/profile/backend; use Apple
Sandbox test identities and owner-approved products in `HoopCheck Membership`.
Validate six localized offers, intervals and introductory metadata against
`lib/billing/apple-products.ts`. Backend secrets stay in protected configuration:
`APPLE_IAP_KEY_ID`, `APPLE_IAP_ISSUER_ID`, `APPLE_IAP_PRIVATE_KEY`. With separate
approval only, use `APPLE_IAP_ENABLED=true`, `APPLE_IAP_ENVIRONMENT=Sandbox` and
matching enabled Sandbox database config on the isolated target. Configure signed
App Store notifications to that target. Never expose signing keys in native env.

For each case, capture time, product, anonymized owner/test transaction reference,
server outcome, native/web effective tier and provider-management status:

1. First eligible purchase: localized terms/price/trial disclosure, matching
   `appAccountToken`, independent server verification, entitlement sync, then
   transaction finish. No optimistic access from the device callback.
2. Cancel the purchase sheet: no membership or trial consumed. Pending/interrupted
   purchase: no premature access; recover on observer delivery/relaunch.
3. Restore after relaunch/reinstall with the same account; repeat restore without
   duplicate sources, trial claims or financial events. Switch HoopCheck accounts:
   another owner cannot claim the same original transaction.
4. Turn off auto-renewal: retain access through the verified paid period. Test
   Sandbox expiry/renewal/billing retry on Apple's accelerated clock; do not infer
   a real seven-day duration from accelerated receipts.
5. Refund/revoke through supported Apple Sandbox controls: signed notification
   and server status remove only that Apple source. Replay/out-of-order events
   must remain idempotent. If unavailable, mark unverified rather than simulate a
   pass with a forged receipt.
6. Test restore/sync with API outage, temporary stale Apple API state, offline
   device and account change. Unacknowledged transactions remain retryable;
   ownership cannot transfer and stale completions cannot grant access.
7. Test Apple Pro + Stripe Premium and Apple Premium + Stripe Pro, plus expiry/
   cancellation/refund of each independently. Native and website effective access
   must agree. Stripe management must never cancel Apple; Apple refund must not
   revoke valid Stripe/manual access or alter Ambassador financial records.
8. Verify coach/manager Premium-only offers, no unpriced new fan offers, retained
   legacy access, and rejection of reused trial eligibility.
9. Complete the evidence matrix and disable the isolated test purchase entry point
   when testing ends if it is not intended to remain available. Production Apple
   enablement needs its own approval after these cases pass.

A release approval should name the final source/build, backend/migration state,
physical test evidence, remaining accepted limitations and exact tester group.
Unverified signing, physical freeze, backend integration or Sandbox cases remain
explicit blockers; automated compilation does not close them.
