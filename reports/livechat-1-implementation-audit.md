# LIVECHAT-1 implementation audit and acceptance gates

## Verified baseline (2026-11-11)
- app/fan-live/page.tsx currently computes roomOpen client-side with a 30-minute pre-tip window and closes on final status.
- supabase/migrations/20261022200000_harden_fan_live_chat.sql defines fan_live_chat_room_open with a 30-minute pre-tip check and read policies gated on room openness.
- supabase/migrations/20261102190000_tier_1_player_live_game_hub.sql extends membership access to Pro/Premium players and fans.
- A search of the default branch found no isLeagueInSeason implementation. SEASON-1 must be integrated before seasonal room enforcement.

## Required implementation sequence
1. Integrate SEASON-1 canonical server-side season resolver and league identifiers for fan_live_games. Avoid league-name-only joins.
2. Implement country ordering matching /teams, searchable country filter, league sections and per-game cards in /fan-live.
3. Replace game room lifecycle checks in SQL and UI: opens at scheduled tip minus 60 minutes; remains writable through final plus 2 hours; history remains readable after closure. Store authoritative final timestamp; do not use provider estimated end.
4. Enforce membership and season on database INSERT policies and server endpoints. Preserve read-only historical access for eligible users.
5. Add league lobby rooms and messages with distinct league-scoped identifiers, season-only listing and posting, report/block and moderation.
6. Add Team Hub deep links with country, league, game targeting.
7. Cover two countries and separate games, pre-tip denial and opening boundary, final +2h boundary, off-season absence, lobby season gating, mobile light/dark, fresh deployment origin.
8. Run typecheck, theme audits, membership tests, CI and Launch Test before marking ready.

## Safety
No production data changes, merge, or deploy until acceptance evidence is complete.
