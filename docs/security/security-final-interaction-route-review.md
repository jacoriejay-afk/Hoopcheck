# SECURITY-FINAL — interaction route and deletion review

Inspected `app/api/hoopfeed/moderate/route.ts` on main (2026-11-12).

- Accepted `kind` values: post, edit, comment, share, vote, bookmark, pin.
- No `edit_comment` or `delete_comment` action exists in this route.
- Comment creation is server-moderated, uses an authenticated JWT visibility check, and then uses service-role insert.
- Production feed_post_comments has a DELETE-own policy but no direct INSERT policy. Deletion may be performed through an authenticated Data API client; absence of a delete UI is not proof that deletion is inaccessible.
- No evidence from this route alone that blocked-user restrictions are enforced in feed_posts RLS. Treat blocked-user verification as an open test, not a confirmed bypass.

## Follow-up before executable security migration

1. Inventory all API routes and client calls that modify feed_post_comments. Ensure every insert is moderated.
2. Test authenticated DELETE own vs another user's comment, and SELECT visibility for permanent/expired/blocked posts.
3. Inspect `feed_posts` RLS and any block relationships before defining a global or follower-only visibility contract.
4. Add a safe comment-edit endpoint only if required by the product; do not grant direct UPDATE casually.
5. Test moderator/admin membership RPC authorization without mutating production.

No application behavior was changed.
