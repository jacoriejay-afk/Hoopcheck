# Build 8: HoopFeed country-authorization boundary (draft security decision)

## Verified production behavior
`public.can_view_player_feed_post(uuid)` currently checks post ownership, moderator/admin override, then a qualifying follower with an active Pro/Premium subscription. For player-to-player access it additionally compares viewer and author `current_country` case-insensitively. The function currently runs as SECURITY INVOKER and therefore depends on raw profile-country SELECT privileges.

## Unsafe shortcut — do not ship
The isolated test's `public.is_my_player_country_match(uuid)` prototype has EXECUTE granted to authenticated users. That standalone function exposes a country-equality oracle to any authenticated user, even when they do not follow the target or have an active subscription. **Do not deploy that helper or use it as the production solution.**

## Required release implementation
1. Keep the full existing follower, subscription, account-type, period-end, and moderator checks together with the private-country comparison inside **one** audited, narrowly scoped function. No separately callable country-comparison RPC.
2. Use a tightly scoped SECURITY DEFINER boundary only if necessary after revoking raw `profiles.current_country` SELECT. Fully qualify referenced objects, set `search_path = ''`, and explicitly revoke PUBLIC/anon EXECUTE; grant authenticated EXECUTE only. Review function owner, underlying table permissions, and RLS implications.
3. Preserve existing output semantics (boolean) and all role gates. Avoid exposing detailed denial reasons or private country.
4. Test owner, admin, matching/nonmatching player followers, non-followers, expired/free subscriptions, fan/coach access, missing JWT, and anon. Assert direct SELECT of private country fails.
5. Coordinate deployment with the owner-private-country reader RPC and website changes in this PR. Verify migration ordering, PostgREST schema refresh, and rollback before any production apply.

## Current status
Design-only blocker. Existing isolated authorization test models the behavior but its equality helper is **not approved for production**. No production migration revoking the country column or replacing feed authorization has been staged.
