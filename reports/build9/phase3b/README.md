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
