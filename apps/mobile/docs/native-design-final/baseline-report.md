# Native design final workstream — readiness report

2026-11-19. **Draft; full visual parity and iPhone readiness are not established.**

Branch: `codex/native-design-final`. Base: #721, `d0b87b1ed92cd2130001b224b6e39493a5faa447`.
This is a presentation-only follow-up stacked on the existing Build 8 candidate;
review its diff against `fix/native-startup-recovery`, not main. No other branch was
modified. No merge, EAS build, OTA, production deployment, billing/auth policy,
moderation rule, database schema or production record change was performed.

## Existing PR inspection

| PR | Existing work preserved | Decision |
| --- | --- | --- |
| #696 | Floating rounded tab geometry | Port that presentation onto the five current routes; retain newer navigation and accessibility. Do not merge the outdated branch wholesale. |
| #710 | Feed/Reels/alerts/account clients and website tabs | Preserve clients and access checks. |
| #711 | Compact feed, image aspect ratios, loading/retry | Preserve existing media/composer implementation; do not duplicate it. |
| #715 | Live Games, chat, groups and touch reconciliation | Preserve all behavior. |
| #720 | Full feature reconciliation | Inherited through #721. |
| #721 | Startup recovery and identity-bound app lock | Branch base; unchanged. No freeze repair claim. |

## Reference and method

Live public mobile homepage: https://hoopcheck.online, captured at 390×844 in
`website-home-light.png`. Website source inspected: `components/BottomNav.tsx`,
`components/TeamProfileHero.tsx`, `app/hoopcheck-lm2f-bottom-nav.css`,
`app/hoopcheck-brand-navigation.css`; native theme already cites canonical website
CSS. The website has competing navigation overrides; rounded navigation follows
#696's explicit design direction and requires owner visual review against the
signed-in live site. A live signed-in website session was unavailable. Thus the
remaining authenticated comparisons are source/fixture audits, not verified live
website matches. No production authentication or synthetic production writes.

Before: unchanged #721 web export. After: presentation changes in this branch.
Chromium, 390×844, light/dark. All native fixture remote traffic is intercepted.
Generic `audit-*` captures include available content, loading, empty or error
states; they do not prove successful backend integration. The account fixture in
the generic capture cannot verify entitlements; `account-light/dark.png` from the
community suite captures verified synthetic account content separately.

Open [comparison gallery](comparisons.html) for paired screenshots. Each pair
uses the same route/fixture/theme. `feed-*.png` is the community suite's final
Home screen; `feed-posts-*.png` is the actual feed. Images are viewport captures,
not complete scroll-content inventories. Role editor snapshots cover player,
fan and coach. No physical iPhone screenshots were produced.

## Screen-by-screen audit

| Screen | Finding / work in this PR | Evidence and remaining work |
| --- | --- | --- |
| Welcome `/` | Centered oversized card differed from public hero. Top-align, 16pt gutter, compact display heading, dark hero, website copy and create-account-first actions. Preserve official bundled mark. | Paired audit captures. Still lacks public website search, directory sections and full official wordmark/header; not full homepage parity. |
| Dashboard | Existing directory/search actions retained. Floating nav now reserves layout space. | Paired audit/Home captures and directory navigation suite. Website dashboard role-specific comparison pending. |
| HoopFeed / fan feed | #711 already implements compact composer/cards and media. Retain it. Shared card defaults now lighter where used. | Feed suite: loading/retry, decoded media, posting failure/draft retention, comments/replies, checks, save, poll and route navigation in both themes. Official full wordmark parity still needs signed-in reference review. |
| Reels | Preserve #710 video implementation. | Both-theme video playback screenshots/tests. Native AVPlayer and signed URL expiry still require iPhone. |
| Post/comments | Preserve compact nested comments and interaction behavior. | Feed suite exercises replies and failure/recovery; comments not separately inventoried as a full-page capture. Keyboard/long threads need iPhone. |
| Live Games | Shared cards lose heavy shadows; existing compact listing retained. | Live chat screenshots, role gates, game/side/prediction tests. Listing still has native stack plus inner Live Games title; dedicated header redesign pending. |
| Game chat | Shared controls use 48pt minimum with disabled accessibility state. | Both-theme send failure/draft/send/report/mute/block tests. Keyboard and bottom composer on device pending. |
| HoopGroups index/detail | Existing implementation preserved; shared cards become compact. | Group detail screenshots and membership/moderation/draft/error/leave tests. Generic index empty/error capture. Signed-in website reference pending. |
| Player directory | Existing compact rows retained. | Both-theme route captures and discovery navigation. Long names/large text on iPhone pending. |
| Player profile | Shared cards lose excess padding and shadows. | Both-theme synthetic profile capture. Website cover/avatar/full social profile remains incomplete; no invented native features. |
| Edit profile | Existing editor preserved; shared cards/buttons compacted. | Player/fan/coach light/dark screenshots and save/failure/draft/cover tests. Native keyboard/cover fidelity pending. |
| Men's team profile | 22pt gutters/26pt gaps and standalone identity stack differed from women. Shared `EntityHero`, 16pt gutters and compact card gaps. | Paired audit captures; real crest/media and website tabs remain a gap. |
| Women's team profile | 24pt hero padding, system bold title and large vertical stack differed from men. Shared hero with compact crest/title row and display font. | Paired profile captures; review permission guards preserved. Real logo/cover parity pending. |
| Men's league profile | Unify identity typography/spacing with team profiles. | Paired audit captures. Men's/women's league content models still differ; data behavior intentionally unchanged. |
| Women's league profile | Same shared hero and gutters as men's league and both teams. | Paired league captures and team navigation suite. Website full league tabs/hero review pending. |
| Teams / women's directory | Existing compact crest rows preserved. | Directory screenshots and search/navigation permission tests. |
| League / coach directories | Existing compact rows retained. | Paired audit captures; detailed website comparisons pending. |
| Search | Existing search/filter navigation retained. | Paired captures and search→team→league interactions. Keyboard first-tap behavior already present. |
| Notifications | Remove duplicate content title; native stack owns Alerts heading. | Paired alerts captures, unread/mark-all tests. System push delivery is outside browser proof. |
| Connections | No dedicated native route found. | Native parity unavailable; no new functionality added. |
| Membership / subscription | Native account status exists; no dedicated native purchase screen at this baseline. Presentation compacted only. | Synthetic account capture/tests. Store purchase/lifecycle untouched and unverified. |
| Login / signup | Shared card/button density improved; existing keyboard tap handling retained. | Both-theme route captures; auth integration 14 cases. Actual credentials, OAuth return and keyboard require device. |
| Forgot/reset password | Shared presentation improved. | Forgot-password captures; reset requires a recovery session, not fabricated. |
| Username / onboarding | Existing native components retained. | Source audit only. Welcome/onboarding lifecycle, long text and app-lock interaction require iPhone. |
| Settings | Remove duplicated Settings title; use 16pt layout rhythm. | Paired captures; appearance persistence/system/failed-save tests. Face ID and alternate icons require iPhone. |
| About / account security | No dedicated native About or security-management route. Device app lock is in Settings. | Website handoff and security workflows not verified. No auth/security changes. |
| Owner HQ / Ambassador HQ | No dedicated native routes at this baseline. | Cannot claim native visual parity. Approved role sessions and future native screens needed. |
| Web handoff | Existing external handoff retained. | Not a native implementation of missing screens; session/return behavior requires device. |

## Validation

- Mobile TypeScript passes.
- Changed-file ESLint passes (no errors or warnings after cleanup).
- All 15 native test files pass; all 14 auth integration cases and URL validation pass.
  Auth harness theme stub was updated for the welcome hero; destination assertions
  now select actions by accessible label rather than visual order.
- Six isolated browser suites pass: discovery, feed, live games, club groups,
  profile editor, appearance. Both themes where supported; permission denials and
  failure recovery included. Final welcome/settings changes recaptured and
  appearance suite rerun.
- Local web and iOS Hermes exports pass. These are JavaScript exports, not native
  compilation or physical-device verification.
- CI and Vercel must be checked on the PR head. No merge approval is requested
  while physical and authenticated visual gates remain open.

## Physical iPhone verification required

1. Reproduce the frozen TestFlight screen on the reported device/build; cold/warm
   launch, slow font/storage/session recovery, background/foreground and account
   changes. This PR does **not** prove the freeze fixed.
2. Inspect every native route in both themes on a notched iPhone and a small
   device; landscape, home indicator and safe areas. Confirm no content is covered
   by floating tabs; check sheets, back/swipe gestures and nested scroll views.
3. Keyboard: sign-in/signup, profile editing, feed composer/replies, search,
   game/group chat; submit buttons, focus, dismissal, draft recovery and modal
   overlays with keyboard open.
4. VoiceOver reading/focus order, selected tabs, disabled buttons, Dynamic Type
   through accessibility sizes, Reduce Motion and long/localized names.
5. Photos, portrait/landscape ratios, missing media, native video formats,
   playback/audio, expired signed links and native share sheet.
6. Device app lock / Face ID, onboarding, external account/security handoffs,
   OAuth and recovery links. Membership display must remain authoritative;
   purchasing/entitlements validation belongs to the Build 8 workstream.

## Readiness decision

Reviewable design improvement, **not final design sign-off**. Full live
screen-by-screen visual matching remains blocked by missing authenticated
reference sessions and absent native screens. Additional identified visual gaps
above remain open. Keep the PR draft, integrate only after owner review and
physical verification. Do not merge or start a build from this report.
