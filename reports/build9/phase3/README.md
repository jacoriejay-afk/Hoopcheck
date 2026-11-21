# Courtside 2.0 Phase 3 — partial implementation, release blocked

## Verified baseline

Fresh clone; clean checkout before edits. main: 9e11cb7bf6976174a49562cabf21dddee2f40ffb.
PR #744: db5c0063510dad5ce4e61055dfa155e3b8850e3c, open/unmerged.
PR #746: acbd66b5fae33e7b4b4c530382f8fe53b69834da, open/unmerged, includes #744.
Selected baseline: completion/build9-20261120 at 658584a9b86c4d3e6ea15a8f5c82d27aedee5a1b, descendant of #746, includes billing containment and compensation checks.
The remote has no consolidate/build9-master ref. Its contents have NOT been recovered or declared equivalent. Do not recreate it from assumptions.

Three stacked review branches: design/build9-phase3-system → design/build9-phase3-core → feature/build9-phase3-courtside. First targets completion/build9-20261120. Do not merge any slice until baseline/dependencies and all acceptance gates are approved. Existing branches are untouched. All three branch names disable automatic Vercel deployment in committed root/mobile configuration; publication uses skip-vercel commit messages.

## Dependencies and boundaries

SDK54, RN0.81.5, existing custom native modules. Keep installed primitives; @expo/ui universal controls require newer SDKs and are not installed. No SDK upgrade. No schema, permission, auth, tier, reaction, comment, chat subscription or billing changes. Inherited five migration candidates remain unapplied; production catalog rehearsal and installed-client compatibility gates from Phase 1 remain blocking. Missing master baseline reconciliation remains open.

## Design-system slice

Keep the existing src/theme.ts and brand assets as the single source of truth. Remove one native blur layer per repeated GlassCard; cards use semantic solid surfaces. Apply blur only to navigation, behind pointer-transparent decoration, with opaque startup/error/reduced-transparency fallback. Navigation remains in normal flex layout below the navigator, so it reserves its own height instead of covering screen actions. This is a visual floating treatment, not an absolute touch overlay.

## Acceptance status

Phase 3 is NOT complete. Physical iPhone/Build 7 freeze diagnosis and resolution are unverified. Simulator screenshots, before/after native comparisons, Dynamic Type, VoiceOver, live API and hosted authorization behavior require separate evidence. Archived compact-iphone images in the baseline are React Native Web fixtures, not simulator evidence. No EAS, deployment, production mutation or merge is authorized/performed.

## Core and feature slices

Search gains local directory scopes, selected states, 44pt minimum targets and pressed feedback; role checks and the public-username RPC remain intact. Activity Center moves its controls into the list header so filters and mark-read actions remain scrollable at large text sizes; initial loading uses the existing reduced-motion skeleton. Home gains verified-account welcome copy and entry cards to existing Game Center, groups and Reels. Highlight Hub is currently an entry to existing Reels, not a new aggregation backend. No invented counts or rankings.

Deferred/disabled: a public exportable Player Passport image is not exposed. The existing gated player ShareSheet remains unchanged; a public passport requires an approved field allowlist and recipient access/consent contract. No public export endpoint or storage policy has been created. Personalized recommendations beyond verified-account greeting and role copy are not enabled: follow-based ranking requires verified API coverage. No backend feature is advertised as available.

Remaining requested implementation/review: full Game Center layout, feed/composer media polish, group discovery layout, Player Passport visual export, team/league/player profile redesign, onboarding/settings polish, image loading audit and cross-screen modal/touch/performance audit. Existing functionality is retained, but retention is not acceptance of the complete redesign.

## Before / after (source behavior comparison; no screenshot evidence)

| Surface | Baseline | This slice |
|---|---|---|
| Repeated cards | Each iOS card mounts BlurView | Solid themed surface; no per-card blur |
| Navigation | Opaque glass-colored fill | iOS blur decoration with opaque reduced-transparency fallback; reserved layout height retained |
| Search | All authorized directory groups displayed together | Selectable local category scopes; same authorized results and requests |
| Activity | Filters/actions outside scrolling list; blank loading content | Header scrolls with list; existing skeleton during initial load |
| Home | Search, directory and account links | Adds verified welcome and Game Center/groups/Reels entry cards |

## Validation limitations

No screenshots captured in this implementation. No Xcode/xcrun or connected simulator was available in this Linux workspace; no EAS simulator was started. Neither simulator nor physical iPhone behavior is verified. Full requested before/after visual acceptance in both themes is outstanding. No claim that Build 7 freeze is resolved.

Initial native test run found a new expo-blur import missing from the test harness; the harness now mocks native blur and AccessibilityInfo, and the full rerun passes. Initial restricted-network dependency test failed; rerun with network access passed. No security override or advisory suppression added.

## Acceptance matrix — do not treat inherited screens as newly accepted

| Gate | Result |
|---|---|
| Baseline ancestry and fresh isolated branches | Verified; missing master contents unresolved |
| Design system | Partial: surface/navigation changes; visual review open |
| Personalized Home | Partial: verified greeting, role copy and existing route cards; recommendations disabled |
| HoopFeed/media/composer | Existing implementation preserved; Phase 3 redesign open |
| Game Center/live chat lifecycle | Existing implementation preserved; Phase 3 redesign/live lifecycle acceptance open |
| HoopGroups discovery | Existing implementation plus Home shortcut; layout redesign open |
| Player/Team/League profiles | Existing implementation preserved; Phase 3 redesign open |
| Player Passport | Visual image export deferred/unavailable; consent/field contract needed |
| Highlight Hub | Existing Reels entry only; dedicated hub open |
| Smart Search | Local category scopes added; existing APIs/gates retained; device review open |
| Activity Center | Scrollable header and loading state added; device review open |
| Onboarding/settings | Unchanged; Phase 3 review open |
| Reactions/replies/real counts/tiers/verification/authorization | Services unchanged; regression tests pass; hosted acceptance open |
| Physical-iPhone freeze, touch overlays, safe areas, transitions, large text | Unverified; no physical evidence |
| Both-theme simulator before/after comparisons | Missing; release blocker |
| Full production-compatible backend rehearsal | Inherited blocker; no production access attempted |

## Recorded local checks

PASS: root/mobile TypeScript; lint (zero errors, 125 inherited warnings); 197 native tests; entitlement matrix (10 role/tier cells, 22 entitlements); full website production build including bundle, theme pairing and certificate tracing; iOS Hermes export (7.21 MB); Metro web export. Logs in checks/. Doctor: 16/18, two failed network-dependent checks (Expo schema/React Native Directory), so Doctor acceptance remains blocked.

GitHub Actions started automatically for all three PRs: build, mobile-typecheck and simulator-compile. Captured rollups contain implementation head SHAs and show IN_PROGRESS; no success is claimed. This evidence-only commit creates a new final feature head whose CI must be inspected separately. No workflow manually dispatched, no EAS started. Deployment configs and skip-vercel commit messages are committed for these branches; no deployment command executed.

Draft reviews: #748 system, #749 core, #750 features. Code commits listed in commits.txt; affected source/config files listed in changed-files.txt. These files exclude the final evidence-only commit itself. Working baseline branches remain unchanged.
