# PR #729 — native design continuation

Updated 2026-11-19. Branch `codex/native-design-final`, still based on #721
(`d0b87b1e`). **Not ready for final Build 8 integration or iPhone sign-off.**
The design changes are locally reviewable; authenticated live reference access,
approval of the combined Build 8 candidate and physical-device gates remain open.

[Visual gallery](comparisons.html) · [Original audit](baseline-report.md)

## Completed in this continuation

- Exact official HoopCheck SVG wordmark/mark from `components/Logo.tsx`, used in
  the welcome screen, dashboard header, feed and onboarding. The feed's labels
  use the existing display font. No dependency or font-loading change.
- Public welcome structure: branded header, search, dark gradient hero, website
  copy, primary signup/secondary sign-in actions, Live Games and pre-sign entry
  points, compact directory rows and About. Existing protected destinations
  still require sign-in. Pre-sign remains an explicit website handoff.
- Compact shared directory presentation, role colors and 16pt dashboard gutters;
  32pt hero text instead of the oversized 48pt default. No search/auth behavior
  replacement. Public search protection is exercised in the browser.
- Public native About screen with website editorial copy, reachable from welcome,
  dashboard and Account. Company information remains a labeled website handoff.
- Native Connections: own Following/Followers lists through the **existing**
  `get_public_follow_list` RPC used by `app/connections/page.tsx`. Same fan
  filtering/profile-link rules, public data only, bounded reads, identity checks,
  focus cleanup, stale-result scope, retry and empty states. Team/player rows
  navigate to existing native profiles; fan profiles use the existing website
  handoff. No follow/unfollow, private-data cache or database write was added.
- Real team artwork on men's/women's profile and directory screens. Only existing
  `logo_url`/`logo_bg` fields were added to existing selects; tables, filters,
  ordering, pagination, RPCs and policies remain unchanged. HTTPS artwork uses
  `contain`, explicit loading state and authored-crest fallback on failure.
- Removed duplicate Live Games title, compacted game titles, added an initial
  games-loading skeleton, widened detail back-link hit areas, reduced sign-in
  and profile-editor spacing, and gave shared inputs theme-aware iOS keyboards.
- Retained the first pass's compact cards, unified entity headers, floating tab
  bar and Alerts/Settings title cleanup. These were not recreated.

## Reference access: what was and was not compared

The live website Account page was opened in the shared browser and redirected
to `https://hoopcheck.online/login?returnTo=%2Faccount`. Secure browser sign-in
returned `unavailable`; no credentials were requested in chat, fabricated,
extracted or used. **Live authenticated website-to-native comparison is still
blocked by reference access, not by a physical iPhone.**

Source comparisons use the actual website's `components/Logo.tsx`,
`app/HomeClient.tsx`, `app/about/page.tsx`, `app/connections/page.tsx`,
`components/HoopFeedShared.tsx`, `components/TeamProfileHero.tsx` and existing
canonical theme CSS. These source comparisons and synthetic authenticated
native-web flows are not represented as live signed-in parity proof.

## Screen-by-screen status

| Area | Completed / verified here | Remaining |
| --- | --- | --- |
| Welcome | Website structure/copy/branding, search and protected destination routing; light/dark captures | Public live visual sign-off; no native pre-sign checklist or reviews overview (explicit web handoffs) |
| Dashboard | Official header, compact hero and colored directory rows; 320px overflow assertion | Live role-specific dashboard comparison |
| HoopFeed / fan feed | Official mark/display labels; existing compact composer/media preserved; moderation/draft/reply/check/save/poll tests pass | Media-creation UI belongs to #722; live authenticated comparison |
| Reels | Existing playback preserved; light/dark video tests/captures pass | AVPlayer formats/audio/expiry on iPhone |
| Comments / posts | Existing comment/reply/failure-recovery behavior preserved and tested | Long-thread keyboard/VoiceOver on device; separate live website comparison |
| Live Games | One title, compact game cards, initial loading skeleton; role/side/prediction tests | Native keyboard/safe areas and authenticated website comparison |
| Game chat | Send failure/draft/recovery/report/mute/block browser tests retained | Physical keyboard/touch/lifecycle |
| HoopGroups | Existing directory/detail/membership/moderation flows pass | Native overlays/keyboard; live website comparison |
| Player directory / profile | Existing functionality preserved; shared card presentation retained | #723 owns player access/avatar parity; integrate that work rather than recreating it |
| Profile edit | Compact spacing; current save/failure/draft/cover tests pass | #722 owns photo editor; keyboard/media picking on iPhone |
| Men's and women's teams | Shared compact hero plus real logo loading/contain/fallback; back hit areas | Live logos/data and physical image rendering; website's richer profile tabs/cover/follow UI remain feature gaps |
| Men's and women's leagues | Shared compact identity treatment retained; women's directory entry stays native | Their content models differ at baseline; full website tabs/season/team composition remains a feature gap |
| Directories / search | Compact shared rows, native women's route, protected search and drill-down tests | Live search/data comparison; device keyboard |
| Notifications | Single title retained; unread/mark-all tests pass | Push delivery and live reference |
| Connections | New native public Following/Followers, scoped fan list, retry/empty state and profile routing | Real account/RPC verification; fan profile itself remains a website handoff; native avatars/contact controls not added |
| Membership / subscriptions | Existing authoritative Account status preserved and tested | #728–#730 own StoreKit/backend; native purchase/restore controls still forthcoming there. No duplicate purchase screen in this PR |
| Login / signup / password recovery | Compact sign-in/shared inputs; existing auth integration tests pass | #724–#727 own auth operation/MFA work; actual OAuth/recovery/device keyboard |
| Onboarding / username | Official brand and display type, lifecycle regressions pass | On-device modal/lock/large-text verification |
| Settings | Earlier single title/compact layout retained; appearance persistence/failure tests pass | Face ID, alternate icons and system keyboard theme on iPhone |
| About | New native public copy and branded presentation; both-theme screenshots/test | Device readability; company/founder/partnership content remains on website |
| Account security | No duplicate screen introduced | Existing native security screen is in #727; its combined-source browser suite passes. Live reference/device review remains |
| Owner HQ / Ambassador HQ | Audited as absent from this baseline | No native role-authorized data contract/screens; cannot implement truthful role dashboards as a styling-only change. Requires feature owner and authorized reference sessions, not merely an iPhone |
| Website handoffs | Existing URL-validation/browser handoff retained | Actual browser session and return behavior on device |

This closes the source-supported presentation issues implemented above, not every
website feature gap. Missing tabs/cover/contact/purchase/HQ functionality is
explicitly distinct from physical-device verification.

## Coordination with Build 8

Read current open PRs and compared affected paths. Other branches were not
modified or merged. #696's updated head `12531b6f` preserves its rounded nav work;
#729 already carries that design direction on the newer routes.

| PRs | Feature owner | Integration requirement |
| --- | --- | --- |
| #722 | Media creation, profile photo editor | Preserve its composer/photo handling when combining `feed.tsx` and `account/edit.tsx` styling. |
| #723 | Player access, country/avatar visibility | Preserve its access/client/avatar implementation. Do not substitute this baseline's player screen. |
| #724–#726 | Auth identity races, ordering, verified links | Keep their session/deep-link protections authoritative. New About/Connections route registration must be added to their newer layout without replacing it. |
| #727 | MFA and native security | Retain its security screen/providers and Account entry. |
| #728–#730 | StoreKit / verified memberships | Retain their authoritative status/purchase/restore behavior. This PR does not configure, enable, apply or test billing infrastructure. |

No production data, auth policy, membership rule, moderation rule or schema was
changed. The Supabase guidance was consulted for existing projection/RPC reads;
verification uses intercepted fixtures, not production queries. Current-head
remote checks are recorded on the PR. See integration status below for the
read-only merge simulation.

## Evidence and reproduction

`before/` retains the original #721 screenshots. `baseline-pr729/` preserves all
66 original PR #729 after-images at `fd9b5447`. `after/` contains refreshed
captures plus new About, Connections, artwork/fallback and 320px evidence.
The gallery shows all available stages and identifies screens newly added here. There are 82 current captures, including 16 new evidence views.

All captures are Chromium at 390×844, light/dark, except explicitly named 320px
captures at 320×740. Synthetic authenticated native-web fixtures intercept every
external request. Generic `audit-*` captures can show loading/error/empty states
and are not backend-integration assertions. Successful Connections, artwork and
Account content has separately named test captures. Role editor captures cover
player/fan/coach. Viewport screenshots do not inventory every scroll position.

After a local web export with the existing CI fixture environment:

```sh
python3 scripts/serve-native-fixture.py /tmp/native-design-729-web-final 8096
# In another shell, from apps/mobile:
export NATIVE_TEST_URL=http://127.0.0.1:8096
node scripts/verify-discovery-browser.cjs
node scripts/verify-feed-browser.cjs
node scripts/verify-live-games-browser.cjs
node scripts/verify-club-groups-browser.cjs
node scripts/verify-profile-editor-browser.cjs
node scripts/verify-theme-preference-browser.cjs
DESIGN_SCREENSHOTS=docs/native-design-final/after node scripts/verify-design-browser.cjs
DESIGN_SCREENSHOTS=docs/native-design-final/after node scripts/capture-design-audit.cjs
```

The capture harness now creates a fresh page/init script per route and waits for
fonts/authenticated tabs rather than accumulating initialization scripts. The
new design browser suite is included in Mobile CI.

## Validation

- Mobile TypeScript and changed-file ESLint pass without warnings.
- All 16 native test files pass, including public connection projection/destination
  guards. All 14 auth integration cases and URL validation pass.
- Seven isolated browser suites pass in both themes where applicable: discovery,
  feed, Live Games, groups, profile editing, appearance and design. New checks
  cover public About, protected welcome search, Connections failure→retry,
  fan/player filtering, Following/Followers/empty state, team routing, decoded
  artwork/failure fallback, and a 320px overflow assertion.
- Local web export and iOS Hermes export pass. They are not Xcode compilation,
  StoreKit validation, a simulator run or physical iPhone verification.
- CI/Vercel status is verified separately on the pushed head; no merge approval
  is requested on the basis of synthetic evidence.

## Physical iPhone-only gates

1. Reproduce the reported frozen TestFlight screen; cold/warm launch, background
   return, slow storage/session/font recovery and identity transitions. **The
   freeze is not claimed fixed.**
2. Touch responsiveness, swipe-back/scroll gestures, notch/home-indicator safe
   areas, landscape/small devices, floating nav and nested modal/sheet layout.
3. Real keyboard focus/dismissal/composer position for auth/search/editing/feed/
   groups/game chat; action reachability, draft recovery and system keyboard theme.
4. VoiceOver focus/selected/disabled announcements, Dynamic Type through large
   accessibility sizes, long/localized content and Reduce Motion.
5. Real photo formats/aspect ratios, native picker (owned by #722), AVPlayer,
   audio, signed-media expiry and native share sheet.
6. App-lock/Face ID, onboarding lifecycle, alternate icons, OAuth/recovery/deep
   links and browser handoff return. StoreKit physical/sandbox gates remain with
   the billing workstream.

## Integration status

The first read-only merge simulation found three additive-entry conflicts. They
were removed by relocating the new Stack registrations, Account links and visual
test stub away from Build 8's security additions; no auth logic was imported or
changed. A subsequent `git merge-tree --write-tree HEAD
origin/feat/storekit-membership-sync` completed **cleanly** against #730 at
`9645897d24da31ce66ab28ba90f07d17b82fae4b`.

The simulation inputs were design source commit
`96208f4d5d06574c99c0571e03a1c7a197137faf` and #730 head above.
Combined source tree: `cc1eaea5b142afbba7c3853d0e02326453ef58b5`. It was archived
into `/tmp/hoopcheck-design-build8-candidate`, with no merge/rebase or branch-ref
change. In that isolated archive, TypeScript, all 22 native test files and
combined auth/URL suites pass. Existing media, player-privacy, MFA and new design
browser suites pass in both themes. All ten combined browser suites pass: discovery, feed, Live Games, groups,
profile editing, appearance, media, player privacy, MFA and design. The web export passes. These checks do not
compile an iOS binary, apply #730 migrations or validate actual Apple billing.

`integration-evidence/` is separately labeled evidence from that simulated
combined source, including native MFA/security, media/profile and design
screens. Those feature implementations remain owned by #722–#730 and were not
copied into this design branch. Do not confuse those captures with `after/`,
which shows this PR's standalone #721-based source.

The design patch is ready for code-integration review against that specific
snapshot, but **PR #729 is not ready for final integration sign-off**. Final
integration still requires an approved combined candidate, live authenticated
website comparison, feature-gap decisions above, and physical iPhone checks.
Keep draft. No merge, EAS, OTA or production change performed.
