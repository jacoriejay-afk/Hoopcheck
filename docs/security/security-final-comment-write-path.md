# SECURITY-FINAL — verified comment write path (2026-11-12)

Source inspected: `app/api/hoopfeed/moderate/route.ts` on main.

- POST requires a Bearer token and validates it with `db.auth.getUser(token)`.
- `adminClient()` uses `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS). Before a comment is written, `canInteractWithPost(postId)` creates a separate publishable-key client using the caller's JWT and selects an approved, unexpired-or-permanent post, relying on feed_posts RLS.
- Reply parent_id is UUID-validated, must match the same post, and production has a parent validation trigger.
- Comment body length is checked and `moderate(text,null)` must allow content; the moderation function fails closed when its provider key is unavailable.
- The server then inserts into `feed_post_comments` using the service-role client.

**Implication:** No direct authenticated INSERT policy for feed_post_comments is necessary for this route. Do not add one: that could bypass server moderation.

**Remaining risks to test:** Service-role write path must never be reachable without JWT; block/follower enforcement depends on feed_posts RLS; test race between visibility check and insert, account entitlements, rate limits, and whether all other comment write paths share this authorization. Verify edit/delete routes independently. These are review items, not verified vulnerabilities.

**No production changes.**
