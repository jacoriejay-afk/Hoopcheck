# Build 9 native V3 + HoopChat + opening/login integration
2026-11-22 · **Code integration candidate; NOT an iOS release approval**

## Provenance and merge strategy
- Base: PR #794 exact head `edf379315a18eb9bbe6e143ec9108e3eb5eba44b` (clean native V3/role hubs stacked on protected backend PR #755).
- Source: PR #796 exact head `5ac4b821e3c71654fc74dc3e21a477e2db0aa556` (opening, login, signup, password reset motion stacked on Arena UI PR #786).
- Transplanted 10 exact source files covering branded opening and ArenaBrand, login/signup/reset/welcome and source tests. Three overlapping paths were manually reconciled: `apps/mobile/app/_layout.tsx`, `apps/mobile/vercel.json`, `vercel.json`.
- Reconciliation preserved PR #794's full protected routes (messages, feed-welcome, hoopgroups), existing V3 header, all native provider wiring, StoreKit, auth/session bootstrap, native AppLock, font/splash watchdog and all production/privacy checks. New native opening mounts **after** navigator and AppLock and is disabled on OAuth callback / password reset routes.
- All relevant Vercel `deploymentEnabled` branch flags remain disabled for native-only unshipped candidates; no preview/production web rollout should be inferred.
- Startup risk review found that `AppOpening` could be interrupted by motion-setting/route changes while its `started.current` guard remained true and all finish timers were canceled, risking a stuck touch-blocking overlay. Added a cleanup reset and a fail-safe render guard, with integration source tests.

## Validation still required at this head
1. Exact-head GitHub mobile TypeScript, native tests (including new `build9-opening-integration.test.mjs`), production web/entitlement/launch gates, and **unsigned** iOS compile.
2. Review honest light/dark screenshots from an exact-head native simulator or physical device. The original owner's asset is approximated as vector; no claim about embedding a raster photo or final brand approval.
3. Real iOS device cold/warm startup, touches/scroll, VoiceOver/Reduce Motion, sign-in with Apple/Google where configured, password recovery, Face ID, deep-link interrupts, background/resume, Reels playback/report/block and Live Games.
4. Resolve protected backend #755 function ownership and real authenticated owner/non-owner/AAL1/AAL2 claims and installed Build 7 compatibility separately. No production schema/RLS/grant change is part of this integration.
5. Verify Apple App Store Connect bundle ID `online.hoopcheck.app`, team `Y778LM35G5`, associated domains and remote iOS build counter against the app listing; then Apple Sandbox Pro/Premium/monthly trial/cancel/refund/restore acceptance. Expo shows the latest completed STORE build as **Build 8**, not Build 9.

**No main merge, production edit, EAS build, signing or TestFlight submission is authorized by this review PR.** Finish independent external acceptance gates before a Build 9 release.
