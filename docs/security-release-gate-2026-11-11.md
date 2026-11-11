# HoopCheck™ security release gate — 2026-11-11

Status: **audit evidence recorded; remediation not deployed**. No production database writes authorized by this document.

## Confirmed production findings (read-only)
1. Storage buckets `feed-images` and `feed-videos` have `public=true`. Public object URLs can bypass feed post visibility checks. Shared fan-feed usage means **do not** toggle the existing bucket to private in place. See #434.
2. `public.feed_poll_votes` SELECT policy `feed poll votes read` applies to authenticated users with `USING (true)`. The feed post SELECT policy is `expires_at > now() AND can_view_player_feed_post(author_id)`. The vote policy must be scoped to posts visible to the requesting viewer, without broadening post visibility. See #422.
3. Security advisor flags public-executable SECURITY DEFINER RPCs (4 anonymous and 35 authenticated) for review. This is an exposure warning, **not** proof that callers can bypass authorization. Inspect function bodies, grants, and direct RPC responses before changing privileges.

## Required fixes and verification
### A. Poll votes
- Inspect exact column types, foreign keys, all grants and policies; confirm poll vote's post FK and `can_view_player_feed_post` semantics.
- Add a reviewed migration replacing permissive SELECT with an EXISTS check against visible, unexpired posts, preserving necessary author/moderator access.
- Verify direct REST calls with anonymous, author, follower, non-follower, blocked, expired-post and moderator identities; test INSERT/UPDATE/DELETE as well.
- Run automated regression checks and staging migration rehearsal before production approval.

### B. Private feed media
- Inventory all readers and writers (HoopFeed, fan feeds, team feeds, embeds, reshares, multi-image and videos).
- Introduce new private media storage and strict upload/delete policies; do not disrupt shared public fan-feed media.
- Authorize signed-URL issuance server-side for each permitted post and viewer, with short expiry and no-store responses; deny arbitrary object paths.
- Backfill safely with compatibility, verify historical content and rollback, then retire public references after audit.
- Test direct URLs and signed URLs for authorized viewer, non-follower, blocked, signed-out, expired and deleted posts.

### C. Privileged RPCs and roles
- Inspect `SECURITY DEFINER` functions exposed to `anon` and `authenticated`, especially admin membership/role and moderation RPCs.
- Verify authorization inside each function and revoke unnecessary EXECUTE grants without breaking legitimate public profile lookups.
- Verify admin-role entitlements are consistent between feed UI and moderation API (#415).

## Account feature QA after security gate
Test each role against server-side permissions (not merely hidden UI): Player Free/Pro/Premium; Fan Free/Pro/Premium; Coach; Agent/Scout; Team Manager; Admin/Moderator. For every role test login, session refresh, dashboard, profile, navigation, permitted writes, forbidden writes, downgrade, block, logout, and light/dark mobile/desktop.

## Release conditions
- TypeScript and repository audit scripts pass.
- CI and Launch Test pass on the exact candidate SHA.
- Staging RLS/storage tests show expected 200/403 or empty-row outcomes for each access case.
- No production bucket, schema, role or data mutation until reviewed and approved.
