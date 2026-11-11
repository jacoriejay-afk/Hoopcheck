# HoopFeed private-media security release verification

Status: **NOT RELEASE-READY**. This checklist is for staging, not production. No live media or customer data should be modified during verification.

## Required integration order
1. Apply private-bucket migration in an isolated staging Supabase project; confirm both buckets are private and that anon/authenticated have no broad storage SELECT/DELETE policies.
2. Integrate the feed-action visibility fixes from PR #464 and poll-vote visibility fixes from PR #460, or demonstrate equivalent protections in the release branch.
3. Confirm the 24-hour post/reshare expiry behavior is present (also covered by PR #467). PR #473 includes equivalent expiry changes; reconcile before merging.
4. Keep HOOPFEED_PRIVATE_IMAGES_ENABLED and HOOPFEED_PRIVATE_VIDEOS_ENABLED unset/false until all staging cases pass.
5. Confirm environment variables for Supabase publishable/service-role keys and moderation provider are configured only server-side where appropriate.

## Test identities (staging only)
- Player A: active Pro, original author
- Player B: active Premium, follows A
- Player C: active Pro, does not follow A
- Fan D: appropriate membership but not authorized to access player-only posts
- Player E: expired/free membership
- Admin: privileged account for entitlement parity

## Mandatory negative and positive cases
- A creates image/video post. B sees it and obtains a signed URL. C and D cannot obtain a URL by guessing post ID and exact media reference. Signed URL endpoint rejects unauthenticated requests.
- C cannot reshare A's followers-only post by supplying its ID directly to the moderation API. B can reshare when eligible.
- C follows B but not A: even if C can view B's reshare, the private-media endpoint must deny signing media from A. Unfollowing A revokes new signing.
- An expired post and a reshare after original expiry both deny media signing; reshare expiry never exceeds original expiry.
- A can upload supported videos; unsupported MIME, zero bytes, >100MB, wrong user path, and nonexistent object are rejected.
- Upload succeeds but AI moderation rejects: cleanup endpoint removes the unreferenced private video. A cannot delete B's file or any published video.
- Force database insert failure after successful upload: server removes newly uploaded private images/video; inspect storage for orphans.
- Refresh images after signed URL expiry; verify video playback and seeking for clips longer than 60 seconds on iOS Safari and desktop.
- Verify the old public buckets still work while feature flags are disabled, and the new private buckets work when enabled.
- Verify Player Pro/Premium, Free, Fan, Agent/Scout, Team Manager, and Admin entitlements remain consistent with the canonical matrix.
- Confirm image/video attachments remain private when reshared, and signed links are not exposed in logs, caches, analytics, or HTML rendered to unauthorized viewers.

## Release decision
Require green HoopCheck CI, HoopCheck Launch Test, and VERIFY-1 on the **final** commit; complete staging tests with evidence and peer review of storage RLS, signed URL TTL, and moderation/cleanup race conditions. Do not merge, enable private buckets, apply production migrations, or deploy until approved.
