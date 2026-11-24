# HoopCheck™ Build 12 — Owner plan and verification gates

**Branch sequence (not production):** PR #917 (A) → PR #918 (B) → PR #919 (C), each tested before merging into `integration/build9-backend-completion-20261121`. Current TestFlight Build 11 is the comparison baseline. **Do not merge the draft integration PR #755 to `main` or publish public App Store changes from this document.**

## Phase A — Live Games / Game Center reliability (PR #917)

- [x] Bound mobile Game Center and authenticated free-player predictions API to recent + upcoming games **before** row limits, preventing old finals from evicting future fixtures
- [x] Keep member access, chat RLS and team-side entitlements unchanged
- [x] Distinguish provider-reported LIVE, FINAL, overdue SCHEDULED, CANCELLED, POSTPONED, and status-unverified; never show a stale period label on a final
- [x] Show **database checked-at** age, not an invented provider-update timestamp; preserve authenticated last checked data on temporary refresh failure
- [ ] Verify signed physical iPhone experience in light and dark, all account levels
- [ ] **Upstream game source** — production read-only 2026-11-24 count: 1,122 `api-sports-basketball` rows; 811 final, 298 scheduled, 13 cancelled; **289** scheduled over four hours past tipoff; **8** scheduled future. The existing `app/api/cron/live-basketball/route.ts` fetches **only the current Baku date**. `vercel.json` declares no `crons` entries. An external scheduler may still exist; its status has not been independently confirmed. Do not claim actual continuous score coverage based on a 20-second UI poll. Research provider entitlement, quotas, active schedule trigger and matching quality before extending ingestion. Do not introduce paid infrastructure without owner approval.

## Phase B — Alerts and HoopChat (PR #918)

- [x] Accessible `Activity | HoopChat | Requests` segmented alerts surface
- [x] Reuse the original private contact-request/messaging logic with accepted-vs-pending filters; do not expand permission or expose peer identifiers
- [x] Reduce alert card bulk, avoid unnecessary auth-refresh clears, and preserve explicit logout/account-switch invalidation
- [ ] Real-device tests: player acceptance, free-fan view, account-switch isolation, chat timeout and offline recovery
- [ ] Real-world push alert preferences and unread counts after owner QA; do **not** fabricate typing/read receipt states without server support

## Phase C — HoopFeed and HoopReels (PR #919)

- [x] Remove HoopBot's redundant feed banner and simplify the one-tap post entry
- [x] Measured full-screen Reel offsets and at most one adjacent Reel media preauthorization using the caller's own authorized signing endpoint
- [x] Playback remains paused off-screen/background; no eligibility bypass; blocked/hidden creators excluded before prefetch
- [ ] Actual on-device tests on poor network, low memory and reduced motion; verify video trim/draft/covers separately before shipping editor promises
- [ ] Validate moderation, report/block, private media token expiration, and multi-role subscriptions

## Remaining Build 12 work — separate scoped jobs, not already implemented

**D — HoopGroups (PR #920):** Implemented owner-scoped edits of the existing group name/description, six preset accent colors and six emblems with server RLS and checked update acknowledgments. Group banner uploads, moderator invitations/audit trail, member onboarding, community rules and live reporting queues remain **not implemented**. Keep `EXPO_PUBLIC_HOOPGROUPS_CHANNELS_ENABLED` off until moderated test accounts verify owner, member, blocked and guest permissions; HoopGroups are NOT official Team Fan Groups. Use existing free database/RLS; no blind production grants.

**E — Courtside Mode:** Combine reliable live score, league/game lobby chat, predictions, fan reactions, and Player of the Game voting using already verified entitlements, official game lifecycle and vote windows. Never backfill synthetic scores or pretend LIVE when stale.

**F — Profile / Explore / Trust:** Player Passport sharing and export, global player/team/creator search, verification/trust surfaces and verified logo coverage. Unverified logo gaps remain placeholders—not invented club artwork. Do not expose private reviews to Free/fan roles.

## Final release acceptance (required)

- [ ] Exact merged SHA passes Mobile App Checks, web CI, synthetic PG17 rehearsal, launch gate, entitlement matrix and unsigned iOS verification
- [ ] New **signed** EAS iOS Build 12 uses exact integration SHA and next monotonic iOS build number; App Store Connect/TestFlight processing independently confirmed
- [ ] Real iPhone dark/light, safe-area, Liquid Glass floating navigation, VoiceOver, reduced motion, 320pt responsive, hot/warm startup, game chat, HoopFeed/Reels, Groups, Alerts and Account acceptance
- [ ] Free/Pro/Premium and all supported roles tested; Apple Sandbox purchase/cancel/restore and previous installed Build 7/8/9/10/11 compatibility verified
- [ ] Signed JWT/MFA, owner RPC, private-profile RLS, public moderation and supported legacy clients independently approved; no paid Supabase staging branch
- [ ] **No production deployment or `main` merge** until all non-waived security and release holds are satisfied.
