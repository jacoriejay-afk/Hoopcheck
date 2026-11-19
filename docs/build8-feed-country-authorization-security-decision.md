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

## Additional dependency: masked directory RPCs and column revocation

The pending `20261118162305_player_profile_country_privacy.sql` migration defines `get_public_player_profile`, the four-argument `search_public_players`, and legacy search overloads as SECURITY INVOKER functions. Their SQL still references `profiles.current_country` to produce masked output or to apply public-only country filters. **A column-level SELECT revoke can therefore break these otherwise masked RPCs**: the caller must still possess permission to read every referenced column.

Do not deploy the column revoke based only on the current synthetic feed test. The coordinated release must either move the masked read logic into carefully audited, owner-controlled SECURITY DEFINER boundaries (preserving public profile visibility, moderation, fan restrictions and result signatures), or choose an equivalent table-level access design that demonstrably prevents raw column reads. Add regression tests for each directory RPC under actual anon/authenticated grants after the revoke.

This is a release-blocking dependency alongside HoopFeed and owner profile editing.
