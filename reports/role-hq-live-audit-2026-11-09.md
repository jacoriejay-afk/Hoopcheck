# ROLE-HQ / LIVE audit — issue #366

Date: 2026-11-09. This document records code inspection findings, not a production verification.

## Existing entry points
- `app/dashboard/page.tsx`: profile.account_type supports player, coach, scout, agent, fan; shared dashboard.
- `app/team-dashboard/page.tsx`: club management surface, approved team claims, group summary and official posts; permits coach/manager/admin roles, then checks approved claims.
- `app/team-hub/page.tsx`: **fan** followed-team hub, not manager HQ.
- `app/fan-live/page.tsx`: chat, presence, game filtering, game winner prediction, entitlement check.
- `app/feed/page.tsx`: player feed.
- `app/fan-feed/page.tsx`: fan feed.
- `app/api/team-fanfeed/route.ts`: official team posting endpoint.
- `supabase/migrations/20261022200000_harden_fan_live_chat.sql`: live-chat policies and moderation.

## Implementation checklist
1. Trace all account types through signup/profile persistence, dashboard routing, shared navigation and API authorization. Decide whether manager is stored as account_type or approved claim; avoid assuming an enum migration.
2. Create dedicated Agents HQ for agent/scout, with player/team discovery and watchlists, no unauthorized contact details or team edits.
3. Distinguish Fan Team Hub from Team Manager HQ; link approved team manager accounts to /team-dashboard and fans to /team-hub. Keep claim-based club scoping server enforced.
4. Trace fan-live eligibility from membership-tier, subscriptions, RLS and game state. Repair any mismatch and verify eligible fan chat access end-to-end, including realtime and reconnect. Do not bypass subscription checks or RLS.
5. Verify prediction polls before tip and player-of-game polls after final, unique votes, final/24h closing logic and live tally consistency.
6. Find redundant Post to Feed CTA in every nav/dashboard; remove duplicates but retain role-appropriate composers.
7. Audit reaction storage and UI; optimistic feedback, rollback, no duplicate votes, animation and reduced-motion support.
8. Run tests and real account journeys across fan Free/Pro/Premium, player Free/Pro/Premium, agent, scout, manager and signed-out, desktop and mobile.
9. Verify migrations and production deployment independently before declaring live activation.

## Known risks
- Fan-live `load` uses `getHoopCheckEntitlements` and fan_live_games query; a missing subscription row or restrictive RLS can produce a blank room list even if the UI exists.
- Team manager routing cannot be based only on the generic role name: an approved team claim is required.
- Do not broaden chat eligibility silently; confirm the intended fan tier matrix.
