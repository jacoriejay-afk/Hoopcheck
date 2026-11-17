# MOTION-1 implementation and release handoff

Status: **draft; not the complete MOTION-1 release**. Native configuration version is
0.2.0. No EAS build, OTA update, production deployment, database change, or merge
has been performed.

The repository's Expo app has authentication, directories, public player profiles,
team/league profiles and team review submission. It does not contain native
HoopFeed, reels, groups, a Live Game Hub or game chat. Adding those products would
exceed this request's polish-only boundary. The existing web entitlement resolver,
API routes and policies are unchanged. Nothing new is labelled LIVE.

## Scope and remaining work

| Part | Present in this branch | Still required for the requested release |
| --- | --- | --- |
| A | Shared Reanimated durations/spring policy, live OS Reduce Motion subscription, Gesture Handler root, route fade fallback. Transform/opacity animations only. | Physical mid-range Android frame profiling. Keep shared-element morphs disabled until the directory/header and avatar paths pass. |
| B | One haptic map; persisted global setting; tab navigation, review results, report results, reusable Check primitive. | Posting/commenting/prediction integrations when those native actions exist; device haptic proof. |
| C | `CheckButton` primitive: optimistic toggle, authoritative result, rollback/error state, arrow spring, orange fade pulse, rolling count; instant counts under Reduce Motion. | No native Check surface exists to wire it into. It does not enable HoopFeed or implement a new mutation/gate. |
| D | Delayed layout skeletons with one shared shimmer clock on existing directory and profile/review reads. | Feed, search beyond existing directories, and Live Game Hub surfaces when present; device layout-shift/slow-network checks. |
| E | Blur-backed, swipe-dismissable, keyboard-aware share/report/quick-view sheets; conservative route fade. Report endpoint unchanged. | Native filters do not exist; no replacement full-screen filter flow was added. Keyboard/gesture QA on devices; shared-element profiling. |
| F | Genuine bundled mark in themed splash; bounded JS-startup hide deadline including fade; sliding tab indicator with selected icon state; skippable persisted onboarding and signup role prefill; streamed directory search, stale-response guards, local recents. No fabricated trends. | Cold-start flash/deadline measurements on signed builds; first-install/relaunch proof; notification badges need a real native notification consumer. |
| G | Canonical link parser, custom scheme, native association declarations, safe web handoff for unsupported pages; in-memory destination preservation through normal sign-in. Account-scoped, bounded, 24-hour public directory/profile cache with age banner, reconnect and pull-to-refresh. Offline review submission blocks visibly and retains form text. Opt-in device lock, five-minute background cutoff, persisted background timestamp, normal-sign-in escape. | Host AASA/assetlinks using verified signing identities; native post/group destinations; deferred-install referral attribution. Reviews deliberately remain outside persistent cache until access can be revalidated through the shared resolver. Biometric/passcode/cancellation/process-death QA. |
| H | Sentry initialization, manual startup/directory/team/profile/posting spans, allowlisted event reconstruction, no breadcrumbs/request/user/text payloads, Metro/source-map and EAS plugin wiring. | Configure the real project/DSN/build credentials. Exercise a signed internal crash and inspect the received native payload and source maps. Measure crash-free sessions for the release cohort before sign-off. Feed tracing waits for a feed consumer. |
| I | **Not enabled or implemented.** | Last: verified score-update timestamps and a native followed-game/chat source, then ActivityKit/widget extension, update/end/stale lifecycle and lock-screen/Dynamic Island QA. A fetch timestamp or generic row update must never substitute for a score-update timestamp. Reject missing/future timestamps and scores aged >=5 minutes for LIVE labels. |
| J | Not applicable to this native checkout. No emoji reactions were added to posts, reviews or reels. | Only implement behind the existing native game-chat flag once that surface exists, using stored per-user/message/emoji rows and the existing moderation path. |
| K | **Not implemented.** Foreground public-cache refresh is not an OS background task. | One coalesced OS task with payload limits and text-only requests; revalidate the shared entitlement resolver before feed reads; scope snapshots to the current user and connect real fixture/feed/notification consumers. No scheduling interval promises. |
| L | Local iOS module, Classic/Blackout/Orange settings sheet, prebuild-bundled alternate icon catalogues. The existing artwork is placed on alternate surrounding backgrounds without redrawing or recolouring the mark. OS icon selection persists. Setting is absent when native support is unavailable. | Xcode compile, device icon switching/persistence and iPad verification. Android launcher-alias switching is not implemented; the setting is hidden on Android. |

## Referral findings

The documented existing Lykes URL is
`https://hoopcheck.online/referral/CHRISLYKES` (see
`docs/ambassador-hq/AMB-1-implementation.md` in the repository root).
The current web checkout has `/referral/[code]`, not `/r/[code]`. Native routing
recognizes both spellings and hands them to the existing canonical web referral
endpoint. Signup stays in the same in-app browser so the existing server-issued,
httpOnly attribution cookie can operate normally. No client-generated attribution
or account metadata is trusted.

Unit tests explicitly cover Lykes routing. They **do not** prove campaign activation,
an app-store installation handoff, a real attributed signup, or the web `/r` alias.
Those require the REF-1 flow, verified campaign/test identity and signing/domain
configuration. Do not call referral attribution end-to-end verified.

## Local evidence

- TypeScript and focused mobile ESLint pass.
- Eight native link, app-lock boundary/fallback, and telemetry privacy contracts pass.
- Existing VERIFY-1 matrix passes: 10 role/tier cells, edge cases and 22 entitlements.
- iOS and Android Hermes exports pass (bundling, not native compilation).
- iOS and Android prebuilds pass without installing native build toolchains.
- iOS module autolinking resolves `HoopcheckIconsModule`; prebuild emits both icon catalogues.
- Chromium fixture QA at 390×844: 28 route/theme captures, including ten signed-in
  routes and four anonymous routes in each theme; no page errors. Screenshots
  inspected; corrected legacy dark-theme button contrast and Link/Pressable styling.
- Streamed search, share-sheet content placement, offline saved-data navigation and
  reconnect checks pass in both themes using isolated fixtures.
- Expo Doctor passed 16/18 checks before the final icon module addition. Its config
  schema and React Native Directory metadata requests could not reach their remote
  services. The final app config resolves and prebuilds, but those remote checks
  must be rerun successfully before release.

`theme-results.json` and `interaction-results.json` contain fixture run summaries.
These results are browser render/data-path evidence, not Supabase RLS, live-account,
biometric, battery, native splash timing, gesture or 60fps proof. No production rows
or search counts were created by the tests.

## Reproduce and sign off

From `apps/mobile`:

```sh
npm ci
npm run typecheck
npm run test:native
npx expo-doctor
npx expo prebuild --no-install
npx expo export --platform ios --platform android
```

For optional browser fixtures, start the web app with **dummy** configuration:

```sh
EXPO_PUBLIC_SUPABASE_URL=https://motion-test.supabase.co \
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=ci-placeholder \
EXPO_PUBLIC_HOOPCHECK_API_URL=https://api.motion.test \
npx expo start --web --offline --port 8081
```

Run `scripts/theme-fixtures.cjs` with Playwright and Chromium available; optional
`PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` select their local installations. All data is
explicit test fixture data. Output is under `/tmp/hoopcheck-motion-qa`.

For Sentry, configure `EXPO_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` and
build-only `SENTRY_AUTH_TOKEN` through the existing authorized EAS environment.
Never put the upload token in `EXPO_PUBLIC_*` or source control. Confirm both native
build logs show source-map uploads and that symbolication works in the real project.
Audit received payloads with synthetic email/message/review/token canaries before
release. Record the actual crash-free session rate, release/build, cohort, observation
window and agreed acceptance threshold; do not invent a rate or infer it from no
traffic.

After the incomplete parts and all device/data/signing checks above are resolved,
create **new native EAS builds** from the reviewed commit. Do not publish this as an
OTA update or merge it as a completed MOTION-1 release.
