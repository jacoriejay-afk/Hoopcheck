# HoopFeed Following / Global — security implementation gate

Status: design only; **do not apply to production**. Verified against the active HoopCheck schema and policies on 2026-11-10. Tracks #423.

## Existing behavior

- `feed_posts` has no `audience` or `visibility` column. The authenticated SELECT policy `player experience feed read` requires an unexpired post and `can_view_player_feed_post(author_id)`.
- `can_view_player_feed_post` currently allows the author, an authorized admin/moderator, or a Pro/Premium **player** following a **player** in the **same current country**. This is not a general-purpose public/follower visibility check.
- `follow_relationships` has `follower_id`, `target_type`, `target_id`; the existing management policy limits access to the follower's own rows.
- `feed_post_comments` and `feed_post_checks` read policies call the same helper. Bookmarks are owner-scoped.\n- **Additional verified risk:** `feed_poll_votes` SELECT policy (`feed poll votes read`) has `USING (true)`, so it does not check post visibility. Its INSERT/UPDATE/DELETE policies are owner-scoped but also need an authorized-post check where appropriate. Do not expose voter identities through the new Global feed.
- `team_fan_groups` are team-associated; do not conflate them with proposed Premium user-created HoopGroups.\n- **Critical media finding:** both `storage.buckets` `feed-images` and `feed-videos` currently have `public = true`. Existing public media URLs can bypass post-level RLS. Current storage policies checked are upload/delete/ownership controls, not post-specific read authorization.

## Verified code paths that must change together\n\n- `app/api/hoopfeed/moderate/route.ts` uploads images to `feed-images` and stores `getPublicUrl(path)` in `feed_posts.image_url` / `image_urls`; for videos it converts `video_path` into a `getPublicUrl(path)` stored as `video_url`. These are persisted public URLs, not short-lived authorized URLs.\n- `app/feed/page.tsx` uploads videos directly to `feed-videos` from the browser, then submits `video_path` to the moderation route. It renders the persisted media URLs from the post query.\n- Migration must coordinate upload, moderation, database representation, media display, and cleanup. Do not just flip the bucket `public` flag: that would break persisted media URLs without providing authorized replacements.\n\n## Required design before SQL

1. Choose an explicit, constrained post audience (`followers` / `public`). **Default existing and new posts to `followers`**, unless the author explicitly opts into public discovery. Backfill safely, never default existing posts to public.
2. Keep moderation, expiry, membership, block relationships, and account deactivation checks intact. Avoid making an audience toggle an authorization bypass.
3. Replace or version the read helper to take **post ID or post audience**, not just author ID. Current helper cannot distinguish two posts by the same author with different audiences.
4. Author and authorized moderators may view their own/assigned content; authenticated eligible followers may view follower-only posts. Public discovery requires explicit public audience and eligibility; document whether unauthenticated access is allowed (default: no).
5. Enforce the same post-visibility predicate for comments, checks, votes, bookmarks, shared posts, embeds, media storage and API endpoints. **Do not claim follower-only media privacy while the buckets remain public.** Design a backward-compatible move to private storage and short-lived authenticated signed URLs (or a securely authorized proxy) with per-post authorization. Inventory existing URL consumers and thumbnails before changing buckets; never expose service-role credentials or create long-lived share links. Audit all SELECT policies and foreign-key lookups. Do not rely on React filtering for privacy.
6. Verify `target_type` semantics and current membership rules for every account type before changing them. Explicitly decide whether the old same-country rule is retired.
7. Avoid recursive RLS helper queries, unguarded SECURITY DEFINER functions, and user-editable JWT metadata for authorization.
8. Add Following/Global tabs only after database and storage access rules pass tests; Following must include followed accounts' eligible posts and optionally own posts. Global must show only opted-in public posts.

## Mandatory tests

- Author sees own approved active post; non-follower cannot read followers-only post by direct ID or in lists.
- Valid follower can read followers-only post; unfollow revokes access.
- Global contains public opted-in posts only; existing posts never appear publicly by migration.
- Cross-country follower behavior matches newly agreed rules; all supported account types tested.
- Expired, removed, blocked, suspended, and unapproved posts cannot leak via post/comment/check/vote/share/media endpoints.\n- A non-follower cannot query poll votes for a followers-only post, including by direct post ID; test vote counts and individual voter identity separately.
- Anonymous vs authenticated access; Pro/Premium vs Free access; admin/moderator visibility.\n- Copy an existing public media URL and verify access after logout, after unfollow, and after expiry; follower-only assets must be denied. Test images, videos, previews, cached URLs, and existing content migration.
- Insert/update cannot set forbidden audience or mutate ownership; UPDATE has both USING and WITH CHECK.
- Test client and server APIs with real JWTs and RLS, not service-role queries; run security advisors and a full UI regression.

## Rollout

Prepare a migration in a development environment, audit policy diffs, run integration tests, and only then seek approval for production schema deployment. Keep feature flag off until verification is complete.

## Reshare amplification risk (verified in moderation API)

`kind === "share"` reads an accessible source post with a service-role client, then inserts a new approved post under the resharing user's `author_id`, copying `body`, `image_url`, `image_urls`, and `video_url` and setting `expires_at` to year 2100. A follower-only source can therefore be copied into a new post whose audience is determined by the resharing account; the copy may outlive the source and may be accessible to people who cannot read the original. The new caller-JWT read check in draft PR #431 confirms the resharing user may read the source, but **does not prove the new audience is authorized**. Before releasing follower-only privacy, disable reshares of non-public source posts (including older legacy posts) or redesign shares as references that always re-check source visibility and expiry; do not duplicate private media or text. Test unfollow, author deletion, source expiry, block and repost chains.
