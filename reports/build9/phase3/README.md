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
