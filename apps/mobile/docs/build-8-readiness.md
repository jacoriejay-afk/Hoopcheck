# Build 8 readiness — 2026-11-18

Status: NOT release ready. No EAS build, OTA, credentials mutation, payment request,
production database mutation, or merge was performed in this investigation.

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
2. Scroll dashboard, tap a directory card, then Home/Teams/Leagues/Players/Settings.
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

Source inspection shows only native dashboard, directories, profiles, review,
settings and auth routes. The dashboard remains an Explore basketball directory;
web fallback links are not native feature parity. Native HoopFeed/comments/sharing/
Reels, Live Games/chat, Groups, women's teams, account customization, Owner HQ and
Ambassador HQ remain unaudited/unimplemented as complete native user flows.

Commission/referral, subscriptions/entitlements, and full auth/security verification
still require endpoint-by-endpoint review plus isolated payment/database tests.
No production data was used to stand in for those tests. Do not declare these gates
complete from existing web implementations or client-visible links.

## Local evidence for this revision

- Nine component regressions: pass. Pre-patch baseline: fails as expected.
- Mobile TypeScript, native contracts, Supabase URL and auth integration tests: pass.
- `expo install --check`: dependencies up to date.
- Expo Doctor: 18/18 pass (retry required Node environment proxy support).
- Website lint: zero errors, 123 warnings.
- Website production build, bundle audit and hub theme pairing: pass.
- These are local results. Remote CI/Vercel checks must run on the pushed SHA;
  older PR #700 Vercel success statuses do not verify this revision.


## Repeatable physical-device touch check

`maestro test apps/mobile/.maestro/signed-in-touch.yaml` uses stable test IDs to
exercise scrolling, a directory card and every bottom navigation destination.
Install the candidate locally on an iPhone or simulator and sign into an isolated
test account, completing onboarding first. Run in both themes, then repeat after
restoring a session. This flow is committed but NOT run here: no iOS device,
macOS/Xcode or Maestro runtime is attached. It does not replace the lock/cancel
matrix above or prove that Build 7 is repaired.
