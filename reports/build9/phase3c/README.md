# Build 9 Phase 3C — profile, roster research and Passport lifecycle

Draft; release blocked. Base is exactly PR #751 head 19baa22531aaf4c60ccd4f0e0cf9a8315c7d35cb. Clean working tree verified before branch creation. This branch is feature/build9-phase3c-profile; automatic Vercel deployment is disabled in root/mobile configs before publication. No existing branch overwritten. No alternative Build 9 master created or claimed recovered. No merge, deploy, EAS, production write, migration, grant, billing or subscription operation performed.

At initial inspection, #751 exact head had security PASS; build, mobile and unsigned simulator compilation were IN_PROGRESS. That is not final acceptance. Phase 3B report was inspected before edits; its outstanding native/physical/catalog gates remain applicable.

## Delivered scope and real data contracts

- Native membership preview shows six current, server-verified bootstrap permission flags and account tier/role on Account and Membership. It never manufactures a subscription, price, entitlement or hypothetical plan; existing purchase, restore, eligibility and billing actions are unchanged.
- Player profile adds professional verification/date (only when supplied by the canonical RPC) and career-record totals: distinct returned stops, teams and countries. Counts use only records authorized for the viewer, retain the peer-player accepted-contact check, and explicitly describe their provenance. They are not points/rebounds/assists, verified playing seasons, awards or a complete career total. Timeline is bounded at 100 records and labelled if capped.
- Team roster research reads opt-in public player_career_stops linked to the team, hydrates each identity through get_public_player_profile/readPlayerProfile, and excludes invisible players. No raw profiles query or country field is copied into the roster. It reads current, nonexpired team_roster_spots through the existing RLS contract. Fan/unknown roles never issue research queries. Displays historical links as historical links, not a verified current roster. At most 24 career rows, 12 player profiles and 20 opportunities; partial/capped states and refresh are explicit.
- Passport export is now an independently tested native lifecycle: owner and player role verified against existing authenticated bootstrap before and after render; foreground/mount generation guard; bounded account reads and a 30-second render timeout; lazy module availability check; local-file validation; cleanup after success, cancellation, auth change and share error; cleanup error surfaced; late PDFs removed after a timed-out render. Native share calls are dependency-tested, not represented as real-device execution. No camera/library/tracking permission request is introduced. PDF payload remains the existing owner allowlist and escaped HTML.
- During export, the existing native sheet disables pan/backdrop/Close dismissal; the timeout releases stalled rendering. Other sheets retain the previous default dismissal behavior.

## Constraints found, not hidden

The repository supplies no player box-score/award/achievement table or API contract. Canonical player projection includes years_pro and professional verification, not performance averages or trophies. Current-club roster UI on the website uses raw profiles selected_team_id/selected_womens_team_id columns; that reader is incompatible with the unapplied private-column restriction. No public current-team identity projection exists in the reviewed boundary. Therefore current roster, box scores and awards remain disabled; this branch does not add a new raw-profile fallback, silently repurpose history as a current roster, or call nonexistent tables. Completing those exact data surfaces requires an approved backend contract and installed-client compatibility review. No schema was fabricated or production modified.

The user-requested membership preview is implemented as verified current membership access. Group-member identity preview remains disabled; it is a different feature and no permission expansion is inferred.

## Acceptance / release checklist

- [x] Exact requested starting head preserved; Phase 3B report and CI inspected.
- [x] Read-only roster history/opportunities, career stats, professional verification and current membership preview implemented on existing contracts.
- [x] Passport native adapters, ownership/cancellation/error/cleanup/timeout tests implemented.
- [ ] True current-club roster identity projection, game box scores and playing awards: no compatible approved contract.
- [ ] Native iOS share-sheet/PDF rendering test on a supported installed binary; simulator visuals where available.
- [ ] Physical iPhone touch, keyboard, VoiceOver/large text, performance and Build 7 freeze verification. No physical-device claim.
- [ ] Inherited production-compatible catalog rehearsal, installed-client privacy rollout and live hosted acceptance.
- [ ] All final-head CI and network-dependent Expo Doctor gates passed.

See checks/, screenshots/, changed-files.txt and commits.txt for evidence when recorded. Browser images are synthetic localhost React Native Web and are not simulator or production-data evidence.

Baseline CI resolved during work: exact #751 head 19baa225 has SUCCESS for build (44887101721), mobile checks (44887101703), security (44887101731) and unsigned simulator compile (44887101725). Raw rollup is retained in checks/baseline-ci.json. This verifies the designated base; it does not prove Phase 3C CI, runtime sharing, a physical iPhone or recovery of the missing master.

## Final local validation

PASS: root/mobile TypeScript; **215/215 native tests** (zero failed/skipped); **12/12 browser fixture suites** (profile research, player privacy, membership, MFA, profile editing, groups, games/chat, feed/replies/Reels/gating, discovery, media, theme persistence and design/navigation); entitlement matrix (10 role/tier cells and 22 entitlements); full website build; web and iOS Hermes exports; surface/theme audits. Lint is zero errors and the same **125 inherited warnings**, with no new warning suppression. One intermediate ref-cleanup warning was removed by dropping a redundant counter update; unmount is already covered by the mounted guard and owner changes increment the generation at setup.

Local prebuild and generated Info.plist/project checks PASS. Passport sharing requests no new runtime permission; the suite instead verifies unsupported/missing capability, wrong identity/role, session switch, background/unmount, timeout/late cleanup, share failure, local URI validation and deletion failure. Native dependency mocks do not establish that the real iOS share sheet ran. CI unsigned compilation likewise is not runtime or physical-iPhone acceptance.

Expo Doctor is **16/18**, with Expo schema and React Native Directory requests blocked by network failures. See checks/expo-doctor.log. These two gates remain open.

Artifacts are actual RN Web with synthetic intercepted data, never generated mockups or hosted user records. Root/native logs are normalized only for trailing whitespace. Comparison context is the preserved [Phase 3B report](../phase3b/README.md); the new views have after captures, not invented preexisting equivalents.

| Updated surface | Light | Dark |
|---|---|---|
| Scoped roster research | [image](screenshots/roster-light.png) | [image](screenshots/roster-dark.png) |
| Career stats | [image](screenshots/career-stats-light.png) | [image](screenshots/career-stats-dark.png) |
| Professional verification | [image](screenshots/verification-light.png) | [image](screenshots/verification-dark.png) |
| Player membership access | [image](screenshots/membership-player-light.png) | [image](screenshots/membership-player-dark.png) |
| Fan membership access | [image](screenshots/membership-fan-light.png) | [image](screenshots/membership-fan-dark.png) |
| Owner Passport preview | [image](screenshots/passport-owner-light.png) | [image](screenshots/passport-owner-dark.png) |

The main [Build 9 release review](../continuation-release-review.md) now includes this checklist without rewriting its historical evidence. Native runtime sharing, current-team rosters, box scores/awards, hosted compatibility and physical-device gates remain open. Keep draft and unmerged.

A final navigation review also found that a mounted, blurred profile could otherwise finish PDF preparation after the user left. Passport now closes its sheet and invalidates export on route blur. An actual-component renderer regression test exercises the real focus cleanup and confirms the sheet disappears, the adapter becomes invalid and no success haptic fires for the abandoned export. This is automated lifecycle evidence, not a physical-device freeze claim.

Exact navigation implementation head 8f1fc7125c90f854a942459a6444161b603ecc29 CI observation: build IN_PROGRESS, mobile-typecheck IN_PROGRESS, simulator-compile IN_PROGRESS. Raw SHA-bound rollup is in checks/navigation-implementation-ci.json. The evidence-only commit creates a new final head; its CI must be inspected separately. No earlier-head result is declared final-head clearance.

After the final focus guard, the full native suite was rerun at 215/215, mobile TypeScript passed, and both platform exports passed. The final profile-research and player/Passport browser suites were rerun in both themes; all passed. The other ten browser suites passed before this Passport-only navigation correction, as recorded in the full 12-suite matrix.
