# Build 8 readiness — 2026-11-18

Status: NOT release ready. The touch repair remains a draft. No EAS build, OTA,
credentials mutation or production database writes were performed. Independent
verified repairs have been merged: #702, #703, #704, #705, #706, #707, #708, #709.

## Freeze (#699, draft PR #700)

PR #700 now uses a single native Modal for app lock and onboarding. The lock curtain
takes priority during hydration and while locked; onboarding renders inside the
same presentation only after unlock. Inactive overlays are fully unmounted. Nine executable
React component regressions cover inactive modal absence, completing onboarding,
hydration concealment, disabled app lock/public routes, successful unlock, cancelled
unlock and authentication failure, hydration-to-onboarding modal identity and lock precedence. Native bridges are mocked; UIKit presentation,
gestures and touch delivery are NOT exercised. Against main's pre-patch components,
the inactive-modal tests fail. The two new host regressions also fail against the
previous PR revision with separate modal owners. This establishes the tree change, not the freeze cause.

No physical iPhone, iOS simulator, Build 7 runtime logs or authenticated Sentry access
was available here. Keep #699 open and PR #700 draft pending native evidence.

On the existing Build 7 binary, capture device console logs while reproducing:
1. Fresh sign-in and restored session; onboarding complete and incomplete.
2. Scroll dashboard, tap a directory card, then Home/HoopFeed/Search/Alerts/Account on the integrated candidate.
3. Repeat in light/dark themes and Reduce Motion enabled/disabled.
4. With app lock on, background over five minutes, cancel unlock, then unlock or
   choose normal sign-in. Confirm content remains concealed until authorized.
5. Compare JS responsiveness and native modal presentation state during the freeze.
   A JS heartbeat stall points toward JS starvation; a running heartbeat with no root
   touch events points toward native interception. Neither signal alone identifies
   the responsible component. Avoid collecting account/content/token data.

The same matrix must pass on the proposed release binary. Do not infer touch repair
from renderer tests, web previews, exports or a green TypeScript check.

## Configuration audit

- Expo ~54.0.0, React Native 0.81.5, React 19.1.0, new architecture enabled.
- Bundle ID: online.hoopcheck.app; scheme: hoopcheck.
- Universal link domain: hoopcheck.online.
- EAS appVersionSource is remote; production autoIncrement is true.
- Production build channel/environment: production.
- App Store Connect ID: 6835366982.
- No remote signing credentials or remote build number were verified. No version
  was bumped. Confirm next remote build number and provisioning/certificate validity
  read-only before an explicitly authorized build.
- Issue #701 records ITMS-90725 as an April 2027 SDK 27/Xcode 27 deadline warning,
  not rejection of Build 7. Apple's September 9, 2026 notice independently confirms the April 2027
  SDK 27 minimum: https://developer.apple.com/news/?id=k1mtkt1k
- Expo's current infrastructure documentation warns that Xcode 27 images require
  UIKit scene lifecycle; older Expo SDKs should keep `auto` or their SDK alias.
  This project's unset image uses `auto`. Do not switch SDK 54 to `latest`.
  https://docs.expo.dev/build-reference/infrastructure/
- Expo SDK 58 documents built-in scene support; upgrading from 54 requires
  incremental migration, native plugin verification and device tests. Keep that
  migration separate from the touch repair.
  https://expo.dev/blog/how-to-upgrade-to-sdk-58

## Remaining scope

Current main includes native women’s discovery, grouped search, account status,
canonical entitlement bootstrap, appearance controls, durable preferences and
OAuth routing repairs. Draft #710 adds the feed, Reels, alerts and website tabs;
#711 adds compact feed styling/media rendering. Draft #712 adds Live Games,
chat safety and predictions; #714 adds current club-group flows and memory-only
drafts. These have isolated client/browser evidence, not physical native or live
role-matrix proof. #713 combines the earlier search/freeze/feed/styling heads;
its older inputs are now reconciled with current #700/#710 plus #712/#714 on
`reconcile/native-build8-complete`. See build-8-reconciliation.md for exact heads,
combined test evidence and remaining release gates.

Full native parity is not complete: native media upload/poll creation, profile
customization and store billing remain separate work. The broader community-group
schema is unverified; native club groups do not change current fan membership rules.
Owner/Ambassador HQ and commission/referral flows require endpoint-by-endpoint
review and current-revision isolated payment/database delivery evidence; existing
web code or links alone do not prove complete native flows. PR #673 explicitly
requires current-preview Stripe delivery and payout verification.

No production data is used as test data. Test-project metadata has schema/RLS
drift and cannot substitute for production parity. Hosted identity transitions,
OAuth/referral capture, subscription lifecycle, protected deletion and account
security remain release gates. The existing deletion endpoint intentionally
returns a safety-stop response until its complete lifecycle is implemented.

## Local evidence for this revision

- Nine component regressions: pass. Pre-patch baseline: fails as expected.
- Mobile TypeScript, native contracts, Supabase URL and auth integration tests: pass.
- `expo install --check`: dependencies up to date.
- Expo Doctor: 18/18 pass (retry required Node environment proxy support).
- Website lint: zero errors, 123 warnings.
- Website production build, bundle audit and hub theme pairing: pass.
- These are local results. Remote CI/Vercel checks must run on the updated merged
  head; older PR #700 success statuses do not verify it. The root also initializes
  gesture-handler before other app imports and retains the verified auth-callback
  lock exclusion. Import order is not evidence of the reported freeze cause.


## Repeatable physical-device touch check

`maestro test apps/mobile/.maestro/signed-in-touch.yaml` uses stable test IDs to
exercise scrolling, a directory card and every bottom navigation destination.
Install the candidate locally on an iPhone or simulator and sign into an isolated
test account, completing onboarding first. Run in both themes, then repeat after
restoring a session. This flow is committed but NOT run here: no iOS device,
macOS/Xcode or Maestro runtime is attached. It does not replace the lock/cancel
matrix above or prove that Build 7 is repaired.
