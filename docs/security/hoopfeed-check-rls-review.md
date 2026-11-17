# HoopFeed Check RLS correction — review gate

## Confirmed production mismatch (read-only inspection, 2026-11-11)

The `public.feed_post_checks` INSERT policy `player feed checks insert` requires:
- `feed_post_checks.user_id = auth.uid()`
- `profiles.account_type = 'player'`
- active/trialing Pro or Premium subscription
- `feed_posts.expires_at > now()`
- `can_view_player_feed_post(feed_posts.author_id)`

The client-side unified HoopFeed allows reading for more roles. Its Check button inserts directly into `feed_post_checks`, so eligible non-player members receive an RLS failure.

## Safe implementation requirements

1. Preserve the `user_id = auth.uid()` predicate. Never allow a client to Check on another user's behalf.
2. Replace the player-only restriction with the **same server-authoritative active Pro/Premium entitlement** as the unified feed. Include admin override only if its scope is explicitly intended.
3. Preserve per-post visibility, approval, expiration and any follower/private audience restrictions. Do **not** make all posts globally visible just to make Check succeed.
4. Audit `can_view_player_feed_post` and `feed_posts` SELECT policy first: both currently encode player/follower/country visibility. Decide how each account type can see posts before changing the Check policy. A Check policy alone cannot enable non-player feed access.
5. Keep the unique `(post_id, user_id)` constraint, DELETE-own policy and read privacy. Ensure the post status is approved when inserting.
6. Create a real Supabase migration using the repository's CLI workflow; review SQL and security advisors. Do not run unreviewed SQL on production.

## Verification matrix — non-production first

| Viewer | Subscription | Post | Expected |
|---|---|---|---|
| Player | Pro active | Visible approved unexpired | Can Check and uncheck |
| Fan | Premium active | Visible approved unexpired | Can Check and uncheck |
| Coach/Agent/Manager | Pro active | Visible approved unexpired | Can Check and uncheck |
| Any | Free, expired or canceled | Any | Cannot Check |
| Any | Pro active | Private post not visible to viewer | Cannot read or Check |
| Any | Pro active | Expired or unapproved post | Cannot Check |
| Any | Pro active | Own already-checked post | No duplicate Check |
| Any | Pro active | Another user's Check row | Cannot delete |

Test each row with distinct JWTs (not service-role requests) and confirm the RLS-visible post list matches the frontend. Re-run HoopCheck CI, Launch Test, and entitlement matrix before merging.

**Status:** Review plan only. No migration or production DB change has been made.
