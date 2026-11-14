# REELS-1 — RLS acceptance matrix (pre-implementation)

Production read-only inspection, 2026-11-14:
- `feed_posts` approved SELECT uses `can_use_unified_hoopfeed()` and `private.hoopfeed_can_read_author(author_id)`.
- `feed_post_checks` INSERT requires own user ID and an approved referenced post. Its effective audience depends on SELECT visibility for the referenced post.
- Reels must not blindly copy policies: unlike expiring feed posts, Reels may persist, and media access must be authorized separately.

## Test matrix (distinct real JWTs; never service-role substitutes)

| Actor | Reel | Read/play | Check/comment/save | Upload |
|---|---|---|---|---|
| Signed out | Active public | Deny | Deny | Deny |
| Player Free | Active public | Deny + upgrade | Deny | Deny |
| Player Pro | Active public | Allow | Allow | Allow |
| Creator Pro | Active public | Allow | Allow | Allow |
| Fan Pro | Active public | Allow | Allow | Allow |
| Coach Pro | Active public | Allow | Allow | Allow |
| Expired Premium | Active public | Deny | Deny | Deny |
| Pro viewer | Blocked author | Deny | Deny | N/A |
| Pro viewer | Followers-only, nonfollower | Deny | Deny | N/A |
| Pro follower | Followers-only, not blocked | Allow | Allow | N/A |
| Pro viewer | Removed or under_review | Deny | Deny | N/A |
| Author | Own under_review | Metadata only, no public playback | Deny public engagement | N/A |
| Pro viewer | Other user's bookmark | Deny | Cannot modify | N/A |
| Pro viewer | Other user's comment | Visible only if approved and reel visible | Cannot edit/delete | N/A |

## Required server enforcement
- Read/write access must call the same authoritative entitlement source as HoopFeed.
- Any RLS helper function must be reviewed for search_path, grants, and security-definer behavior.
- Storage must be private, with short-lived authorization-aware delivery; direct object paths and stale signed URLs must be tested.
- Reject mismatched `author_id`, `user_id`, and `reel_id` before insert; protect count and status fields from client updates.
- Enforce max 1 reel per day for new accounts atomically on server; never trust client clocks.
- Report and Block must operate for reels, comments, and accounts before launch.
- Validate duplicate Checks, repeated uploads, deleted/removed reels, blocked-after-open, and subscription expiry mid-session.
- No RLS acceptance claim until actual JWT fixture tests pass in an isolated production-like database.

## Next work
1. Inspect existing `private.hoopfeed_can_read_author` and `can_use_unified_hoopfeed` definitions for reuse.
2. Implement access helpers and private bucket policies in a versioned migration.
3. Exercise matrix using role-specific JWTs, then run advisors and CI.
