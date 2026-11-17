# NATIVE-2 — foundation and release gates

Status: **draft PR #685, all four feature flags OFF**. No native camera/location modules installed, no production database changes, no merge, no EAS build.

## Implemented in this branch
- Typed contracts and disabled flags for Arena Check-In, Travel Mode, Highlight Camera, and In-App Verification Video.
- Client preflight helpers for attendance location/time, travel country selection, chat/publishing gates, and owner-only media paths. **Client preflight is not authorization.**
- Four RLS-enabled tables in `20261117093000_native2_foundation.sql`: `native2_travel_preferences`, `native2_arena_checkins`, `native2_highlight_assets`, `native2_verification_video_assets`.
- `20261117094000_native2_explicit_privilege_lockdown.sql` revokes default table grants; only own travel preferences allow authenticated writes under RLS. Check-ins and media records are server-write-only.
- `20261117095000_native2_private_media_buckets.sql` creates private `native2-highlights` and `native2-verification-videos` buckets, 100 MiB limits, MP4/QuickTime MIME restrictions. No client storage policies or upload/download permissions.
- Security unit tests in `apps/mobile/src/lib/native2/*.test.mjs`, executed by `.github/workflows/native2-security.yml`.
- All three migrations applied to **isolated Supabase test project only** (`vcprqpjkyubzzcjatdpx`); production project (`ucbdceaieyenljcwlhnj`) untouched.
- Sandbox RLS test: user A sees only own travel preference, cannot see or update user B's preference; test transaction rolled back.
- Server owner-media policy in `lib/native2/server-media-policy.ts`, with unit tests. No caller-provided reviewer authorization.
- Default-disabled `POST /api/native2/highlight-download` endpoint authenticates Supabase bearer tokens with the project's publishable key, looks up the owner's ready asset server-side, requires confirmed baked watermark and end card, validates canonical private path, and issues a 60-second signed URL. Verification-video download is not exposed.
- Static and mocked server-behavior tests cover feature-off, invalid tokens/asset IDs, cross-user records, incomplete assets, invalid paths, signing errors, and successful owner requests. These tests do **not** substitute for real authenticated HTTP/Storage integration tests.
- All five workflows passed at commit `b08e575` (HoopCheck CI, Launch Test, Mobile App Checks, entitlement matrix, NATIVE-2 Security Tests).
- Isolated sandbox SQL rollback tests confirmed owner can read own highlight record (1), cross-user cannot (0), and unauthenticated identity cannot (0). These are database RLS checks, **not** signed-URL or API integration checks.
- Sandbox storage audit confirmed both NATIVE-2 buckets remain private, with 100 MiB and MP4/QuickTime restrictions; no NATIVE-2-specific client storage policies.

## Existing integration boundaries
- `apps/mobile/src/lib/supabase.ts`: Expo SecureStore-backed client.
- Existing player verification workflow: only authorized server-side reviewers can approve; uploaded video cannot approve itself.
- Existing game chat window, block/moderation, and HoopFeed entitlements remain authoritative.

## Not yet implemented — required before enabling features
1. Trusted server API for authenticated, rate-limited, short-lived upload/download access, verifying database record ownership, object path, bucket and content metadata. Never issue reviewer access based on a caller-supplied boolean. Ensure reviewer access uses existing verified owner/admin authorization.
2. Private video retention/deletion and orphan cleanup; verification request linkage and audit logging.
3. Arena venue provenance and server-side game-time, location/anti-spoof, duplicate and abuse checks. Attendance must never override game chat lifecycle.
4. Travel Mode UI with opt-in/manual country and no background location history.
5. Native camera capture, processing, watermark/end-card export, privacy consent and moderation checks. A preview overlay is not a baked-in watermark.
6. Expo native dependency compatibility review and new signed EAS builds for iOS/Android, physical-device and light/dark testing.
7. Isolated end-to-end server/storage/RLS tests, privacy and threat review, final owner signoff. Production migrations only after explicit approval and verified rollout plan.

## Scope protection
- Do not alter unrelated sandbox security advisor findings in this PR.
- No direct client access to private media buckets, public URLs, client-side verification approval, or premature feature flag activation.
- PR #685 remains draft and unmerged until the above gates pass.
