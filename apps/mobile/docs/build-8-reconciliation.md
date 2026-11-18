# Combined Build 8 development verification — 2026-11-18

Status: draft, not a release candidate. No EAS build, OTA, signing change or
production record write was performed. All three remaining Expo builds are preserved.

## Exact integrated inputs

- Main: `98d5ed6c152fd0bc7b1e2b0389391823630f3c1e` (includes #702–#709, #713 and #673).
  The candidate originally started from `0ded352495e676e83cf5e1ef1ececcaed1554f68`.
- #700 modal repair: `d7a75b6897702e2f6c2b0341f3a35f806df488a5`.
- #710 feed, Reels, notifications and website tabs: `7c9101bc893b014bd65ba0b7ca311dc1bf0c167c`.
- #711 compact feed/media styling: `82eacc21900f72a0dbc7be585d12a1c2570051a4`.
- #712 Live Games, predictions and chat: `56bcf8c1b5eeced328fbd49c740f281bc6d7c87e`.
- #713 prior integration/root regression/Maestro flow: `630febb0bdf340231d8c5738171f3b2a90307ffe`.
- #714 current club-group membership, moderation and memory-only drafts: `11137181d5326bdc4645fa6b77aedc006cb95444`.

These inputs are reconciled on `reconcile/native-build8-complete`. Source branches
remain intact. Another session merged #713 into main as `7c60416993dfab57456e1cdc8d9e7075584bcb53`.
This records repository state, not physical touch verification. The prior integration branch's
Vercel opt-out remains scoped to that branch; this candidate permits ordinary PR
preview checks, which do not invoke EAS or publish a native OTA.

## Conflict decisions

- Gesture-handler initializes first. OAuth callback exclusions remain intact.
- AppLock alone owns the startup native Modal, prioritizes hydration/lock over
  onboarding, and unmounts when neither flow is active. Root Onboarding is absent.
- Shared NativeAccountProvider and NativeDraftProvider wrap screens/navigation.
  Drafts remain memory-only, scoped to authenticated identity, cleared on sign-out.
- Keep Home/HoopFeed/Search/Alerts/Account, fan FAN HQ text, nested directory routes,
  no misleading selected tab outside the five destinations, and stable test IDs.
- Keep safe, bounded search/post/game query fields through sign-in, group identity,
  unsupported-route web fallback and canonical referral handling.
- Keep the compact feed's single header, safe area, scrolling composer, real counts,
  media dimensions, authorized signing, moderation and entitlement checks.
- Preserve Live Games and club-group routes in the stack, protected-route list,
  pending destinations and home cards; retain all distinct regression fixtures.
- Lockfile includes react-test-renderer 19.1.0, Playwright 1.62.1 and SDK54 Expo Video.

## Combined local evidence

- TypeScript and changed-file ESLint: pass.
- All 13 native test files pass, including 10 modal/root regressions. Actual auth
  integration and Supabase URL suites pass separately. Native bridges are mocked.
- Expo Doctor: 18/18; expo install --check: up to date.
- Clean iOS prebuild with no dependency installation: pass in a temporary copy.
- iOS Hermes bundle: pass, 2,224 modules / 6.95 MB. No Xcode archive was compiled.
- Web export: pass, 1,917 modules / 4.17 MB.
- Browser fixture: 390×844 Chromium, all remote HTTP/WebSocket data intercepted.
  Groups, Live Games, feed/Reels/alerts, discovery and theme suites pass.
  Both themes, denied roles, drafts after remount, moderation failures, chat safety,
  search navigation and preference reload/failure are covered. No real account data.
- An initial export/browser attempt hit ENOSPC. Generated dependency caches from
  completed worktrees were removed, and the interrupted checks then passed.

Input PR CI success is not combined-head CI success. Verify every required remote
workflow and Vercel status against the final pushed SHA before any merge.

## Physical device gates — unrun

Linux has no Xcode/iOS Simulator or attached iPhone. Renderer/browser tests, prebuild
and bundle exports cannot prove UIKit touch delivery or native compilation. #699
remains open and #700 remains draft; no freeze root cause is claimed.

Run the integrated app locally on macOS/iPhone using isolated test accounts:

1. Fresh/restored sessions, incomplete/completed onboarding, both themes, Reduce
   Motion, app-lock cancel/fail/unlock and Face ID/passcode transitions; verify
   dashboard scroll, card taps, all five tabs, back navigation and keyboard focus.
2. Capture Build 7 device logs while frozen and compare native modal/touch state
   and JS heartbeat without collecting account content or tokens.
3. Real photo formats/orientation, signed-URL renewal/failure/retry, AVPlayer/Reels
   paging, native sharing, background pause, offline/reconnect and long feeds.
4. Live Games room open/close, polling/realtime reconnect, prediction and chat role
   matrix; group join/leave/moderator controls and account-change privacy.
5. Dynamic Type, VoiceOver and safe areas on physical iPhone sizes.

The committed Maestro signed-in flow is UNRUN and covers basic navigation only.
It does not replace the lock, lifecycle, authorization or media checks.

## Launch blockers beyond this integration

- Native media upload/poll creation, full profile customization and StoreKit receipt
  verification/synchronization are incomplete. Web handoffs do not establish parity.
- Hosted authentication/security, referral attribution and subscription lifecycle
  require isolated end-to-end role/identity verification. Existing 2FA work and
  protected 30-day account deletion are incomplete; deletion currently fails closed.
- #673 is now merged after a current-preview signed TEST refund. Its exact head
  `7338b356bda586dfcff69b85b98c0f785f5259c9` passed CI/Vercel. A 2-cent refund
  produced a processed charge.refund.updated claim, one succeeded audit row and
  the expected 108→110 cumulative deduction; current earnings are 173 cents from
  net 455 at 5000 bps. No payout was created. Original TEST webhook URL, event list
  and status were restored and verified. Automatic review initially held the URL
  change, then approved after read-only proof that Stripe already held the identical
  credential. No credential disclosure workaround was used. This verifies the
  narrow event gap, not every financial/subscription/referral lifecycle.
- Test-project schema/RLS drift prevents treating test metadata as production
  parity. No production record may be used as a test fixture or modified directly.
- Signing credentials, provisioning expiry and next remote build number remain
  unverified: no authenticated EAS/Apple tooling or macOS runner is available.
  The connected browser shows Expo login; its secure sign-in capability returned
  unavailable. Account access is needed for the read-only remote metadata audit.
- ITMS-90725 and the April 2027 SDK27 deadline are documented in build-8-readiness.md.
  Do not select Xcode latest for SDK54 or attempt a major Expo upgrade as a blind fix.
