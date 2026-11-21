# Courtside 2.0 Phase 3B — implementation and acceptance record

Draft, release blocked. No merge, deployment, EAS, production database or billing operation performed.

## Reconciled stack

Baseline remains 658584a9. Inspected #748 cce5fd0a (base completion/build9-20261120), #749 5b29d61d (base design/build9-phase3-system), #750 59ea3e31 (base design/build9-phase3-core). Open and unmerged. The first two had failed mobile checks waiting for the membership button; build/unsigned simulator jobs were still in progress at initial inspection. This branch starts cleanly from #750 and preserves all earlier commits. Missing consolidate/build9-master is NOT recovered. Isolated before worktree is detached at 59ea3e31; no edits to that baseline.

## Implemented

- Home: real followed teams via the existing public-follow RPC; eligible scores via existing live-game readers; membership-gated recent HoopFeed preview; verified account greeting, quick actions, refresh, partial failure and loading states. No invented rankings, scores or counts. Reads clear on focus/identity changes and check session identity before/after loading. No new subscriptions.
- Game Center: compact two-team scoreboards, league/country grouping, explicit null-score state, status badges and scheduled time; same scoreboard in game detail and Home. Existing live polling, chat, predictions, basketball-side access and room lifecycle retained.
- HoopFeed/Highlight playback: compact card hierarchy, larger author identity, selected Check surface, bounded contained photos (no crop), shorter video footprint and existing authorized playback/retry/paging. Check totals, nested replies, save/share/composer/moderation and authorization remain on existing contracts. Highlight Hub is the existing functional video-filtered feed with native controls, not a new recommendation system.
- Groups: Discover/Joined tabs, own membership reads, club identity cards and conversation styling. Existing join/leave/moderation/comment actions preserved. No badge claims an official appointment; no member identities inferred.
- Player profile: athlete identity, existing professional verification, owner-only Passport preview, public profile fields, and career timeline using the website's existing player_career_stops contract. Peer-player career viewing checks the existing accepted contact request before reading; RLS remains authoritative.
- Player Passport: Expo SDK54 Print + Sharing PDF export, explicit owner-only field allowlist, preview and disclosure, session recheck before/after rendering, escaped HTML, native share sheet, temporary PDF deletion after sharing. Excludes contact details, locations, avatar, IDs and all private career stops. Verification is copied only from the profile projection; playing experience is labelled profile reported. PDF preview is a native card; exported PDF uses the same fields, not a screenshot. Unsupported/missing native modules show a recoverable error; no EAS or native binary built.
- Search: existing scoped search/suggestions and role-gated username results retained.
- Activity: loaded unread count, unread card treatment, owner-scoped single-item mark-read before navigation, authenticated session recheck and haptics after confirmation. Existing filters and mark-all retained.
- Team/league profiles: adaptive shared identity surfaces, club-group action, real league clubs from direct league links plus active membership union, de-duplication and recoverable loading/error/empty states. Existing approved reviews and website actions retained.

## Disabled dependencies and unfinished scope

`apps/mobile/src/native/courtsideFeatures.ts` keeps box scores, achievements, player-highlight collection, player roster and group-member directory disabled. This branch does not render or call those features. These require a reviewed projection specifying visibility, player connection rules, attribution, moderation, consent and safe pagination. No tables, grants, policies or production configuration were changed. Career stop management stays on the existing website; this native slice reads the timeline only. Joined-group search currently filters each membership page and retains Next/Previous; it is not a global membership search.

Full requested acceptance is NOT complete: no real iOS simulator or physical device was available in this Linux environment. Native Passport export/share, Dynamic Type/VoiceOver, UIKit touch delivery, navigation/keyboard transitions, and Build 7 freeze need actual device evidence. Onboarding/settings were not redesigned in this follow-up. Team player rosters, box scores and achievements are disabled; women's league club membership layout has not been implemented. No generated mockups are used as screenshots.

Inherited release blockers remain: production-compatible catalog rehearsal, installed-client compatibility, unapproved inherited migrations and live hosted authorization/purchase acceptance. No deployment approval inferred from UI work.

## CI investigation

The inherited membership failure reproduces as a sign-in redirect with no synthetic API requests. Initial fixture bundles lack supplied public configuration; clean-cache underlying Expo export is being tested. The mobile workflow now explicitly clears Metro cache for environment-specific platform exports. Browser failure injection for Connections is reset at that screen because Home now uses the same follow contract. Neither change removes assertions or bypasses authorization.

## Confirmed browser regression and fix

With a correctly configured clean-cache fixture, the actual blank authenticated page reports `isReduceTransparencyEnabled is not a function`. React Native Web does not implement that iOS-only API. Fixed in originating #748 at 7a345d4a with an explicit iOS platform guard and a web-render regression test. Merged forward without rewriting history: #749 61000a72, #750 22685dca, this follow-up 300803de. Before screenshots at detached 59ea3e31 show this genuine baseline crash in both themes; they are not successful pre-redesign screen layouts. The cache change alone is not claimed to fix the crash.

Roster clarification: the website already has roster/roster-board UI. Native roster remains unimplemented here pending review of its existing privacy and role contracts; this does not assert a new schema is necessarily required. Do not treat the disabled native flag as recovery or completion of that website functionality.

## Local validation and artifacts

PASS: root and mobile TypeScript; full native suite (200 tests); entitlement matrix (10 role/tier cells, 22 entitlements); full website build with bundle/theme/certificate gates; iOS Hermes and web exports. Full lint: zero errors, the same 125 inherited warnings (see checks/lint.log). An intermediate extra Home hook warning was fixed; it is not part of the final warning count. No blanket lint suppression or dependency audit override was added.

Expo Doctor remains 16/18: Expo schema fetch and React Native Directory metadata requests fail on the environment network. Logs preserve the actual errors; these gates are not claimed passed.

Selected actual browser suites PASS in light/dark: membership unsupported-module/purchase safeguards; design/navigation/320px overflow and decoded image fallback; player privacy/fan denial/current-country opt-in/unconnected career denial/owner Passport preview/web fallback; games/chat/predictions/side gating; group join/post/comment/report/leave; HoopFeed Check/reply/save/poll/moderation/draft retention/Reels playback/alerts and denied membership; discovery/private-review denial; media upload/rotation/retained draft/moderation. Initial profile/game fixtures rejected the new allowed career contract or expected the old combined scoreboard text. Updated assertions explicitly test the new boundary and separate labels. Design failure injection now stays failed until explicit Retry, avoiding auth/focus revalidation consuming a one-shot failure. Feed fixtures now explicitly assert owner identity for Home follow reads and eligible game queries. No assertion permitting private raw profile reads was added.

Screenshots are real rendered React Native Web at synthetic localhost fixtures, NOT generated images, UIKit screenshots, hosted data evidence or simulator acceptance. `screenshots/before/account-{light,dark}.png` show the actual blank authenticated baseline with the unsupported API error. `screenshots/after/account-{light,dark}.png` show the restored account screen. These are the direct before/after crash comparisons. Home, Passport preview, player identity, scoreboards/chat, group conversations, activity and Reels have separate after screenshots. Browser data is synthetic and must not be mistaken for verified player history.

| Artifact | Light | Dark |
|---|---|---|
| Baseline account crash | [before](screenshots/before/account-light.png) | [before](screenshots/before/account-dark.png) |
| Restored account | [after](screenshots/after/account-light.png) | [after](screenshots/after/account-dark.png) |
| Compact Home | [after](screenshots/after/dashboard-320-light.png) | [after](screenshots/after/dashboard-320-dark.png) |
| Owner Passport preview | [after](screenshots/after/passport-owner-light.png) | [after](screenshots/after/passport-owner-dark.png) |
| Game Center | [after](screenshots/after/live-directory-light.png) | [after](screenshots/after/live-directory-dark.png) |
| Group conversation | [after](screenshots/after/club-group-light.png) | [after](screenshots/after/club-group-dark.png) |

CI failures were inspected and corrected in their originating drafts where appropriate: iOS-only accessibility API guard in #748, native Search title in #749, then normal merges forward into #750/#751. The follow-up surface audit failure was corrected using default print paper; no audit rule changed. Latest exact-head CI still requires completion; earlier failed or passing heads are not substituted. Raw rollups are captured with their head SHA. Evidence-only commits trigger a new final head and require fresh CI inspection.

## Acceptance checklist

- [x] Preserve baseline, stack history and backend authorization; report missing master honestly.
- [x] Working existing-data Home, grouped scoreboards/detail, joined-group discovery, career timeline, owner Passport preview/native export implementation, activity read/navigation and selected screen/media polish.
- [x] Keep unsupported data features disabled; document limits rather than fabricate career statistics, trophies, membership or member identities.
- [x] Run local checks and selected both-theme browser flows; preserve raw logs and real screenshots.
- [ ] Native simulator visual acceptance and working PDF export/share on a supported iOS binary.
- [ ] Physical iPhone touch/keyboard/VoiceOver/large-text/performance review; Build 7 freeze diagnosis/resolution.
- [ ] Full requested native roster/stat/achievement/highlight-collection/member-preview implementation; onboarding/settings and women's league club redesign.
- [ ] Complete final exact-head CI and Doctor network gates.
- [ ] Inherited backend catalog/installed-client compatibility/live hosted acceptance and separately approved release rollout.

This is a working follow-up implementation, not a declaration that all Phase 3 acceptance gates have passed. Keep all PRs draft and unmerged.

Final implementation heads captured before the evidence-only commit: #748 7a345d4a (build/mobile checks PASS; unsigned simulator compilation in progress); #749 7773840e and #750 f2c25ca4 (build/mobile/unsigned simulator checks in progress); #751 f4f5112d (security PASS; build/mobile/unsigned simulator checks in progress). Current native rerun: 200/200, zero failures; final mobile types and targeted lint pass. These are timestamped observations, not a claim that pending CI passed. Final evidence commit itself must be checked by its exact SHA in the PR.
