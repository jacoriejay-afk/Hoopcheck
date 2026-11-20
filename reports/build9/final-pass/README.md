# Build 9 implementation pass — 2026-11-20

Status: DRAFT / NOT TESTFLIGHT READY. PR #744 stays unmerged. No deployment, OTA,
EAS build, production database change, billing operation or subscription change.

## Implementation

Continued the existing fix/build9-iphone-repairs branch from 4d882de952034153fad0dd66b0e8a37a2c990a2f.
Code commit: 90c5bcb0a29ddc93f89126a59ef1f3ed7cc56f37.

- HoopGroups introduction, search, errors and wrapping pagination now belong to
  its virtualized list scroll flow. They no longer reserve fixed space above and
  below results on compact screens. Keyboard tap/dismiss behavior is preserved.
- Remote entity artwork now falls back to authored identity after 12 seconds
  without completion. Timer clears on load/error/unmount; URL identity resets the
  request. A real-component timer regression verifies stall, new URL retry and load.
- Membership rules, single entitlement resolver, auth, service APIs and data
  readers remain unchanged. Existing five-surface Courtside implementation continues;
  this pass does not establish complete design acceptance.

## Design gate

The owner identified these approved November 20 artifacts:
HoopCheck™ Premium Basketball App Showcase.png;
HoopCheck iOS Basketball Showcase.png;
HoopCheck Build 9 Courtside Dashboard.png.
Direction combines Concept 1 Liquid Glass navigation with Concept 2 basketball
identity across Home, HoopFeed, Live Games, HoopGroups and Player Profile.
The actual images are unavailable in this workspace/repository. Existing tokens
and screenshots are supporting references only. No pixel-perfect approval or full
implementation completion is claimed. Obtain the images and compare all five
surfaces in both themes before closing this gate.

## Local checks on code commit

PASS: root/mobile TypeScript; lint (zero errors, 125 inherited warnings); 28 native
Node file runners; seven NATIVE-2 security file runners; bootstrap, checkout and
StoreKit server tests; auth/URL/theme tests; entitlement matrix (10 role/tier cells,
22 entitlements); full Next.js build including bundle/theme/Apple root tracing;
Hermes iOS export and web export. Logs are adjacent.

All eleven browser fixture suites pass at 320×812 in both themes. They cover
profiles/privacy/verification display, editor recovery, feed posts/comments/replies/
Checks, live chat/predictions, groups/moderation, media drafts/uploads, membership
safeguards, MFA, discovery, navigation and theme persistence. Synthetic intercepted
responses do not verify hosted backend compatibility, real Google OAuth, physical
touch behavior or real subscription transactions. Updated HoopGroups screenshots
are adjacent and were visually inspected.

Initial browser attempts were blocked by sandbox socket/browser restrictions;
another attempt used differing harness default ports. Final runs explicitly use
http://127.0.0.1:8092 with authorized local browser execution; browser-results.json
records those final results. Initial website build could not fetch Google Fonts;
network-enabled retry passes. Expo Doctor passes 16/18 locally; two remote metadata
checks fail from Expo API connection/refused and React Native Directory response.
Remote Mobile App Checks passes its Expo Doctor step.

Mobile production audit remains 4 high / 13 moderate. No forced upgrade, override,
lockfile change or advisory suppression. See ../dependency-review/README.md for
verified SDK 54 incompatibilities (decoder ESM/CommonJS and image-size filename
API). The fresh audit JSON is adjacent; findings remain unresolved.

## Remote checks on 90c5bcb0

PASS: Mobile App Checks 44700261255; NATIVE-2 44700261167; entitlement matrix
44700261214; Launch Test 44700261209.
Pending at report preparation: HoopCheck CI 44700261314; unsigned iOS compile
44700261331. Native pods, generated permissions and compiled StoreKit policy
checks pass; simulator app compilation is still in progress. Do not substitute
older-head results. All five Vercel statuses are success (app, hoopcheckk,
hoopcheck, next.js, hoopcheck-stripe-sandbox); this is build status evidence,
not a hosted feature walkthrough. Documentation-only report commits must be
identified separately from this tested code SHA.

## Remaining release gates and physical testing

The Build 7 freeze cause remains unconfirmed: exact shipped source/IPA and a
physical hang reproduction are unavailable. Existing bootstrap/modal/lock fixes
and regression coverage do not establish that cause. Preserve issue #699.

Use docs/BUILD8-IPHONE-AND-SANDBOX-RUNBOOK.md as a procedure, replacing its old
PR/source references with #744 and the candidate SHA; historical approvals and
results are not current release authorization. Test the reported iPhone 14 Pro
first, recording actual iOS/build, then a compact iPhone. Capture cold/warm/restored
launch, slow/offline startup, onboarding, every tab, swipe back, scrolling,
keyboard, background return, Face ID cancel/failure/timeouts, account switches,
Google OAuth return, password recovery, VoiceOver, large text and Reduce Motion.
Exercise role/tier gates and every feature with isolated test identities. Capture
redacted Console and hang logs if touches and scrolling stop responding.

Apple Sandbox needs a separately approved isolated backend/configuration. Verify
purchase/cancel/pending/restore, ownership/account switches, renewal/expiry/refund,
notifications and cross-provider entitlement resolution without live charges.
Stripe test-mode checkout/trial/recovery/webhooks also need isolated credentials;
no production subscription may be used. Keep Apple disabled in production.

Inherited backend migrations and installed-client compatibility remain separately
gated by ../continuation-release-review.md. No blanket migration push. Signing,
build number, physical device acceptance, approved-reference comparison, dependency
resolution and all required final-head CI gates must pass before TestFlight
readiness. Any EAS build still needs separate approval.
