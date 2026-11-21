# Private HoopFeed media migration — implementation contract

Status: code-path audit, **not a completed security fix**. Do not merge or deploy until staging tests pass. Addresses #434.

## Confirmed current code paths
- `app/api/hoopfeed/moderate/route.ts` uploads photos to public `feed-images`, stores `getPublicUrl` in `feed_posts.image_url` / `image_urls`, and stores video public URL from `feed-videos`.
- `app/feed/page.tsx` uploads video directly from browser to public `feed-videos` before server-side moderation, then sends `video_path` to moderation endpoint.
- Feed page renders stored image/video URLs directly, and delete logic parses `/storage/v1/object/public/feed-images/` and `feed-videos/` URLs.
- Feed reshares copy media URLs from source posts. Existing `feed-images` also serves fan feeds; never change that shared bucket to private in place.
- **Additional policy concern:** the moderation endpoint creates approved posts with `expires_at = 2100-01-01`; current code therefore does not implement the expected 24-hour HoopFeed expiry for new posts. Verify intended expiry rules before changing them.

## Required implementation sequence
1. Inventory storage references across all routes and migrations, and identify fan-feed shared objects.
2. Create separate private buckets for player HoopFeed images/videos, with size and MIME limits and no public SELECT. Restrict uploads to authenticated, eligible owners; prefer server-side uploads after moderation. No client-side upload of unmoderated video to publicly readable storage.
3. Store canonical private object keys (bucket + path), not public URLs. Keep legacy URLs readable during migration.
4. Add an authenticated server endpoint to issue short-lived signed URLs **only after verifying the specific post is visible to the caller** (including follower/country/membership, block, moderation, expiry and deletion). Validate object path belongs to that post; never accept an arbitrary bucket/path and sign it.
5. Update feed, reshare, multi-image, video, and deletion flows to use private media keys and authorized signed URL issuance. Ensure fan feeds continue working unchanged.
6. Backfill historic objects in small batches, with idempotent progress, reconciliation, rollback, and post-reference updates. Do not remove old objects until the private copy and authorization are verified.
7. Once all clients have migrated and audit confirms no remaining public player-media URLs, retire old public player-media objects. Do not flip shared fan buckets to private.

## Security regression matrix
- Authorized author and eligible follower can retrieve media; unrelated player, Free player, fan, blocked user and signed-out visitor cannot.
- Expired, moderated, deleted and unfollowed posts cannot mint new signed URLs.
- Signed URL TTL is short and responses use `Cache-Control: private, no-store`; note issued signed URLs remain usable until expiry even if permissions change.
- Video upload requires moderation and cannot bypass upload restrictions.
- Reshared posts do not disclose source media to unauthorized viewers.
- Fan-feed images remain functional.
- Tests cover mobile/desktop, all roles, Pro/Premium downgrades, and media cleanup.

## Release gate
Run staging integration tests with real distinct JWTs, repository checks and CI. Require owner approval before any production storage, schema or data change.
