# HoopFeed authenticated release verification — PR #431

Status: **NOT EXECUTED**. This is a required test plan, not evidence of passing tests.

## Environment and setup
- Test on a non-production Supabase project with the pending RLS migration applied, and a preview deployment for this PR.
- Use at least four isolated accounts: A (Premium player), B (Premium player following A), C (Premium player not following A), and D (Fan).
- Create an approved poll, a discussion post with an image, a video post, and an expired post under A. Do not use real user content.
- Test as signed out, A, B, C, and D. Capture HTTP statuses and database row counts, not access tokens.
- Verify audience semantics against the currently deployed policy. **Per-post Global/Following audiences are NOT implemented yet.** Do not assume the current country/follower RLS enforces future Global semantics.

## Required release gates

| Test | Expected result |
| --- | --- |
| Anonymous POST to /api/hoopfeed/poll-results | 401; no voter data |
| B requests an A poll B can see | Aggregate counts, total, B's own choice only; no voter identities |
| C requests A poll C cannot see | No aggregate for that post |
| D requests player-only poll | No aggregate |
| A/B/C request expired or unapproved poll | No aggregate |
| Invalid UUID, >30 IDs, malformed JSON | 400 (or documented safe failure), no raw voter data |
| More than 1,000 votes on a visible poll | Correct complete counts across pagination |
| Invalid persisted option index | Temporary unavailable; never silently undercount |
| Direct authenticated SELECT feed_poll_votes | Own rows only, not other users' votes |
| Direct INSERT/UPDATE vote on expired/unapproved/inaccessible post | Rejected by RLS |
| Direct INSERT bookmark on expired/unapproved/inaccessible post | Rejected by RLS |
| Direct SELECT comments/checks for expired/unapproved post | Rejected by RLS |
| Attempt to vote/comment/bookmark/share an inaccessible post via moderation API | Rejected |
| Attempt cross-author reshare | Rejected until audience-safe implementation |
| Publish text-only post | Expiration approximately 24 hours from creation |
| Self-reshare old post with distant expiry | Expires within 24 hours of reshare |
| Submit missing, cross-user, mismatched-extension or mismatched-MIME video path | Rejected |
| Upload video without caption | Rejected |
| Submit multiple images including one unsafe image | Rejected; all images reviewed |
| Poll results endpoint unavailable | UI shows unavailable state, not fabricated zero votes |
| Vote request fails | Optimistic vote state rolls back |

## Outstanding hard blockers
1. **Private media**: feed-images and feed-videos are currently public buckets. Post RLS cannot revoke a public object URL. Follow docs/hoopfeed-media-private-storage-rollout.md; verify fan/team feed consumers before switching buckets.
2. **Per-post audience**: feed_posts has no Global/Following visibility column and current RLS is author/follower based. Implement and test audience-specific RLS before enabling a Global feed.
3. **Video safety**: caption moderation and MIME/path checks do not moderate video frames or audio. Design a real video safety review workflow before treating videos as fully moderated.
4. **Migration**: supabase/migrations/20261110000700_hoopfeed_poll_vote_private_read.sql has not been applied to production. Apply and test on staging first, with a rollback plan.

## Release decision
Keep PR #431 in draft until the authenticated matrix is executed and failures addressed. Passing Vercel checks and static source guards are necessary but insufficient. Do not merge, deploy, or change production data without owner approval.
