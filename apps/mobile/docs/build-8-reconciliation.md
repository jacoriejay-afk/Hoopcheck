# Combined Build 8 development verification

No release approval is implied. No GitHub PR was merged, no EAS command or OTA
was run, and no production data or deployment was used for these tests.

## Inputs, in reconciliation order

1. #705: `08a71e87b28c252c87615148de123428731e44a4`, already merged by another
   session as `0ded352495e676e83cf5e1ef1ececcaed1554f68`. This is the base.
2. #700: `6b3c5b63cc38e4783116f6669c1985c0728e4303`.
3. #710: `361640959d775d329211f0a5e8dfe2a45567f6fc`.
4. #711: `82eacc21900f72a0dbc7be585d12a1c2570051a4`.

These refs are integrated only on `reconcile/build8-mobile-705-700-710-711`.
The original development/PR branches are unchanged. Local integration commits
preserve ancestry and make conflict resolutions inspectable. Nothing is merged
into GitHub main by this work.

## Conflict decisions

- Preserve current search's bounded, safely encoded q parameter and discarded
  extra URL fields; add exact post destinations, legacy fan-feed and Reels.
- Keep OAuth callback handling and auth exclusion from app-lock protection.
- Root mounts only AppLock. It owns onboarding and lock in one native Modal,
  unmounts when inactive, and prioritizes hydration/lock over onboarding.
- Keep the shared NativeAccountProvider around both screens and navigation.
- Preserve Home/HoopFeed/Search/Alerts/Account, feed aliases, directory routes,
  nested-route navigation behavior and test IDs on tab controls.
- Preserve #711's single branded header, top safe area, scrolling composer,
  compact cards and dimension-aware media. Real counts, moderation, entitlements,
  media authorization, sharing, saving, comments/replies and Reels remain intact.
- Regenerate the lockfile with both react-test-renderer 19.1.0 (modal regressions)
  and pinned Playwright 1.62.1 (browser verification), retaining Expo Video.
- Update #700's unrun Maestro flow to use the current five tabs. Add an AST-based
  root regression so a future reconciliation cannot remount root Onboarding
  alongside AppLock. The existing component tests still exercise modal identity,
  lock precedence, unlock, cancellation and failed authentication.
- Branch-specific root/mobile Vercel config disables automatic Git deployments
  for this integration branch. It changes no other branch's deployment policy.

## Local evidence

Mobile TypeScript, changed-file ESLint, native contracts including modal component
and combined-root regressions, auth and Supabase URL integration tests pass.
Web and iOS exports use synthetic public environment values. Browser tests
intercept every remote request and never use real account or production data.
CI results must be verified against the final pushed head, not input PR statuses.

## Native device gates remain

This environment is Linux, without Xcode/iOS Simulator or an attached iPhone.
Hermes bundle export is not native compilation or UIKit/AVPlayer verification.
Before any release, run the integrated app on an iPhone in light and dark:

- fresh/restored sessions, onboarding, hydration, app-lock cancel/fail/unlock,
  Face ID/passcode transitions and Reduce Motion; verify touch delivery;
- long feed scrolling, nested directory navigation, keyboard/composer focus,
  top/bottom safe areas, Dynamic Type and VoiceOver;
- isolated-account posting/replying, moderation rejection, Checks and database
  counts, save/unsave, native sharing, Reels paging and identity/permission changes;
- real photo formats/orientation, media failure/retry, AVPlayer, signed-URL
  expiry/renewal, background pause and offline/reconnect.

Use existing local installation or a macOS local build for these checks. Do not
spend EAS quota or mutate production data. Full website feature parity (including
native uploads/poll creation and segment/sort controls) remains outside these PRs.
