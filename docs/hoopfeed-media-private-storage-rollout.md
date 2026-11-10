# HoopCheck media privacy: coordinated rollout plan

Verified 2026-11-10 against Supabase (read-only) and repository source.

## Confirmed production configuration

- Storage bucket `feed-images`: `public = true`; 8 MiB limit; JPEG, PNG, WebP.
- Storage bucket `feed-videos`: `public = true`; 50 MiB limit; MP4, WebM, QuickTime.
- `app/api/hoopfeed/moderate/route.ts` uploads images and stores `getPublicUrl()` URLs.
- `app/api/fan-feed/moderate/route.ts` and `app/api/team-fanfeed/route.ts` **also** use `feed-images` and `getPublicUrl()`.
- HoopFeed client directly uploads videos to `feed-videos` and renders persisted video URLs.
- RLS on `feed_posts` does **not** revoke public object URLs. Anyone holding an existing URL can access the media independently of post visibility.

## Release blocker and dependency

Do **not** simply set `feed-images` or `feed-videos` to private. This would break existing HoopFeed and fan-feed media, including saved public URLs, and could interrupt uploads. Also do not claim the current PR protects media: it does not.

## Safe implementation sequence

1. Inventory **all** readers and writers of both buckets, including team fan-feed, fan feed, profile components, and any external embeds.
2. Define separate private HoopFeed buckets or scoped prefixes with least-privilege Storage RLS. Because `feed-images` is shared, favor new private buckets over flipping the shared bucket immediately.
3. Store object **paths** rather than public URLs for newly uploaded private media; keep a temporary legacy URL compatibility path for existing content.
4. Issue short-lived signed URLs only after validating a signed-in user's ability to read the corresponding approved, unexpired post under the **caller's** RLS. Do not let clients request arbitrary object paths without verifying post ownership/linkage.
5. Avoid caching signed URLs in public/CDN caches. Ensure short expiry, account block/revocation behavior, and expired-post access are tested.
6. Migrate legacy objects and persisted URLs carefully, including multi-image posts, reshares, videos, and fan-feed content. Test uploads, moderation, removal, and rollback.
7. Only after every reader has switched and old references are migrated should the old public objects be retired. Merely setting a bucket private does not invalidate copies of previously distributed media.

## Test matrix

- Post author; authorized follower; non-follower; different-country follower; blocked user; anonymous visitor; moderator.
- Approved, pending, rejected, expired, deleted, reshared, and archived posts.
- Image carousel, single image, video playback, fan feed, team fan-feed, mobile and desktop.
- Expired signed URL, forged post ID/object path, replay after unfollow/block, upload rejection cleanup.

**Status:** Documentation and risk analysis only. No storage policy, bucket, data, or production configuration was changed.
