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
