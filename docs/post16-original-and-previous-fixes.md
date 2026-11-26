# Original Build 16 and previous-build repair register

Status: OPEN. This register supplements #1075 and #985, not the separate Build17 feature list #1087 or App Store compliance #1073. Owner request 2026-11-27: finish original fixes and carry forward earlier requested fixes not implemented. Signed TestFlight 16 remains 0.2.0 (16) at d6b5e7eae08482c3b2aed6cef7e4b29882142e99; later native changes cannot be in that binary. Audit source: post16 reconciliation PR #1113 at 0fb107251d1e0dc1614b07a4dc048db46e156afa. All status labels refer to source evidence, not device or production acceptance.

## Original device issues (#1075)

| Requested fix | Observed evidence / next action |
| --- | --- |
| Dedicated Snapchat-style HoopCheck Camera | Feed quick camera still selects MediaPostComposer. Expo package has image picker, not expo-camera. Implement native capture, video, preview, permissions, interruption, cleanup in isolated dependency PR; no OS picker mislabeled as completed. |
| Story and quick capture | No dedicated camera/story route in audited tree. Reuse approved storage, moderated publishing and tier/audience gates; add 24h story expiry, deletion, reporting, block checks. |
| Smaller post composer | Compact expandable composer exists. Verify keyboard, draft restore, upload state and duplicate prevention on device. |
| HD photo/video compatibility | Media code exists; HEIC/MOV, orientation, HDR/SDR, actual encoded quality, size, thumbnails, retries and iOS/Android/web playback still require sample acceptance. Do not weaken MIME or moderation checks. |
| Explore after Saved | This PR adds All/Saved/Explore, local search by post text and visible creator name, discussion/media/poll filters and existing pagination. Only already-loaded authorized rows; full catalog search, creator discovery and topics remain outstanding. |
| Report/block/unblock | Post/comment report and block controls plus Settings BlockedAccounts present; #1085 integrated safety PR open. Verify all content surfaces, server deny and actual ticket flow. |
| Edit/view profile and followers | Account/edit, career history and network routes exist. Reconcile #1089 coach profile and verify data persistence, exact counts, privacy, theme and other roles. |
| Admin options | Settings server-derived Owner/Ambassador HQ and AdminSafetyCenter exist; verify real owner vs ordinary user and admin/role-specific route access. |
| Native Settings, privacy, terms | Settings and native policy routes exist; #1113 reconciles compliance and repairs, #1092 privacy request center open. Device and legal acceptance outstanding. |
| HoopGroups and home module | Native screen uses default-off EXPO_PUBLIC_HOOPGROUPS_CHANNELS_ENABLED; not functional when disabled. Rehearse membership/channel authorization, group creation/join and home data; do not activate before safety approval. |
| Agents/scouts double header and relevant actions | No dedicated agents/scouts route in audited native route tree. Audit web redirects and role-specific existing components; implement authorized native discovery/actions, single header and real filters. |
| Creators page and content | Reels provider hold explicitly shown in feed. #915 old draft remains open; inspect surviving creator controls and implement missing studio pieces without activating public uploads or unapproved paid providers. |
| Teams/leagues directory dropdowns | Native routes exist; verify country > league, compact rows, canonical IDs, women/men, duplicate cleanup, logos and search. |
| Find Users/Players | Search has typed directory groups and role gate; verify privacy, pagination, navigation, role handling and error states. |
| Live Games | Reconcile HOOPDATA work, verify ingestion cadence/coverage, freshness, game status/quarter, schedule, standings and separate chat access. No synthetic live scores. |
| What's New/home shortcuts | Audit actual dashboard modules and feature flags; no promotion of unavailable features. |
| Loading/flicker/performance | Verify cold startup, duplicate requests, stable scroll and account-scoped cache, cancellation, network and image fallback. |

## Previous builds — carry forward only missing behavior

Do not wholesale merge historical branches. Open PRs can contain superseded work; use per-file comparison to the latest reconciled source and exact CI. These older PRs remain open as observed in the current audit, not proof all of their changes are missing.

| Prior request group | Evidence / acceptance |
| --- | --- |
| Build 11/12 styling and motion (#916, #910) | Liquid Glass isolated floating bars, small safe-area margins, correct brand typography, compact feed/home/account, dropdown menu, loading match website, reduced motion, safe-area contrast, dark/light/Midnight, animation battery behavior. Compare each behavior, avoid old branch wholesale. |
| Build 9/8 native recovery (#744, #741, #733, #721) | Signed Build16 launch/auth already passed owner smoke tests; verify older delayed auth, password reset, deep links, app-lock and account switching fixes in reconciled source. #1086 already incorporated into #1113 draft. |
| Older native profile/media/links (#723, #722, #716, #717, #729) | Verify profile cover/avatar/accent, privacy, native-only internal navigation, poll/media composer, no unnecessary external redirects, accessibility. |
| Older community/live (#714, #712, #711, #710, #653, #524, #486, #480) | Native groups separate from club fan groups, channel and direct messaging, real chat lifecycle, feed share/replies/Check/delete, live updates and season handling. |
| Reels (#915, #627) | Watch/create/instant photo/editor and provider HLS acceptance; retain public creation restrictions until approved. |
| Security/profile/evidence (#982, #755, #746, #739, #736, #735, #727, #527) | Compare current MFA, admin evidence access, profile privacy, upload ACL and legacy clients. No hosted migrations without approval. |
| Membership/ambassador (#894, #747, #732, #731, #730, #728, #568) | Preserve six SKU prices, eligibility, provider-specific management, trial policy and signed terms. No financial activation/change based on old drafts. |
| Career/trust (#1049) | Exact-season affiliation, former clubs/renamed/discontinued teams, independent verification, private evidence, credible reviews, fraud and appeals; preserve owner smoke pass without implying all cases passed. |
| Expansion (#970) | Compare already-approved 177 items to integrated source separately; not permission to activate unapproved providers, packages or new features. |

## Work order and merge boundaries

1. Close current #1113 reconciliation and #1085 safety verification; reconcile #1089, #1092, #1110, #1111, #1116 with current heads. This Explore PR is stacked on #1113's repair branch to avoid conflicting with concurrent reconciliation. If its parent merges first, retarget only after comparing ancestry and reviewing the resulting diff.
2. P0 functionality: report/block, HQ permissions, Settings, profile counts, HoopGroups, Live Games and performance. Reuse existing work and close source/device evidence per item.
3. P1 missing native features: dedicated camera, Stories, HD pipeline, complete Explore, agents/scouts, creators and directory. Keep Reels/provider flags off unless separately accepted.
4. Selectively carry forward previous build fixes in separate reviewable PRs. Record source and regression evidence for each, including why already-implemented or intentionally gated items aren't duplicated.
5. Reconcile separate Build17 and compliance before release; no main/production writes, hosted DB changes, paid services, extra signed Expo builds or App Store submission. Physical testing of the final separately approved signed candidate remains required. Existing source/CI does not override owner-reported failures.

