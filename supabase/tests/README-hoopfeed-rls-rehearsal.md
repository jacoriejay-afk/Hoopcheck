# HoopFeed RLS release rehearsal (PR #477)

**Do not run these migrations against production before approval.** Use an isolated, disposable Supabase/Postgres environment with the existing HoopCheck schema and auth functions. GitHub CI's placeholder Supabase keys do not test live RLS.

## Preparation
1. Create an isolated database without paid staging or production credentials. Apply the baseline schema, then migrations `20261111000100_secure_feed_poll_votes.sql` and `20261111000200_secure_feed_bookmarks.sql`.
2. Run `supabase/tests/verify_feed_poll_vote_policies.sql` and `supabase/tests/verify_feed_bookmark_policies.sql` as read-only definition checks.
3. Create **synthetic** fixtures: Player Pro follower in same country, Player Premium follower, Player Free follower, Fan Premium follower, unrelated Player Pro, author, moderator; approved/expired/pending/non-poll posts and a poll with two options. Keep fixture credentials and IDs out of Git.
4. For every request use the actual test user's authenticated JWT (not service-role credentials). Confirm the role and JWT subject in the isolated environment.

## Expected authorization cases
| Test | Expected |
| --- | --- |
| Player Pro/Premium, same-country follower, approved unexpired poll, valid option 0/1 | Vote INSERT permitted |
| Author voting on own approved unexpired poll, valid option | Visibility permitted; endpoint entitlement rules still apply |
| Player Free follower, unrelated Player Pro, cross-country follower, Fan Premium | Vote INSERT denied by visibility function, unless an independent author/moderator exception applies |
| Any user, expired/pending/non-poll post | Vote INSERT denied |
| Any user, negative/out-of-range option index | Vote INSERT denied |
| Any user, non-array/null poll options | Vote INSERT denied cleanly (no JSON array-length error) |
| Authorized reader, approved active poll | Vote SELECT returns only rows allowed by poll visibility and option bounds |
| Unauthorized reader | Vote SELECT returns no restricted rows |
| Voter attempts UPDATE of another user's vote | Denied |
| Voter updates own vote to valid option | Permitted when source poll remains visible/approved/active |
| Voter updates own vote to invalid option | Denied |
| Voter deletes own vote | Permitted by retained DELETE policy |
| User deletes another user's vote | Denied |
| Authorized user bookmarks visible approved active post | Bookmark INSERT permitted |
| User bookmarks inaccessible, expired or pending post | Bookmark INSERT denied |
| User bookmarks on behalf of another user | Denied |
| User SELECT/DELETE own bookmarks | Permitted under retained policies |
| User SELECT/DELETE another user's bookmarks | Denied |
| API vote/bookmark/share for inaccessible or expired source | Rejected without service-role visibility bypass |

## Release evidence
Record the isolated database version, migration hashes, role/fixture matrix, actual API responses, RLS SQLSTATEs, and test outcomes. Re-run all three GitHub workflows on the exact final commit. Only then request explicit approval to merge/deploy. Do not copy production data into the isolated environment.

## Read-only production authorization audit (2026-11-11)
Live Supabase policy metadata was inspected without modifying data or applying migrations:
- `profiles`: RLS enabled; authenticated SELECT permits public profiles, own profile, or the existing `private.is_admin_or_moderator()` exception.
- `subscriptions`: RLS enabled; authenticated SELECT is limited to `user_id = auth.uid()`.
- `follow_relationships`: RLS enabled; authenticated access is limited to rows where `follower_id = auth.uid()`.
- `admin_roles`: RLS enabled; authenticated SELECT is limited to `user_id = auth.uid()`.

**Integration gap:** The isolated test reproduces the current `can_view_player_feed_post` SQL predicate, but grants broad SELECT on its synthetic supporting tables. It does not reproduce supporting-table RLS, especially the author profile's `profile_visibility` setting. An authorized follower may be unable to see a private author through the SQL function's join even if the subscription/follow/country criteria match. Test public and private author profiles with actual JWT-scoped queries before release. Verify the expected product behavior with the owner before changing privacy rules. Do not bypass supporting-table RLS with service-role or SECURITY DEFINER shortcuts.

Additional release evidence required: actual authenticated Pro/Premium player and Fan JWTs; public versus private author profile; own and foreign subscription/follow/admin-role reads; vote/bookmark SELECT and write outcomes; API vote/bookmark/share outcomes. Use disposable accounts and avoid production writes.
