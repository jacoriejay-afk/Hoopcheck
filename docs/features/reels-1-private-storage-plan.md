# REELS-1 private video storage integration (verified inventory, 2026-11-14)

## Existing production infrastructure

The production Supabase project already has **private** bucket `hoopfeed-private-videos`, with a 104,857,600-byte object limit and MP4/WebM/MOV MIME allowlist. It also has private `feed-videos` with a smaller 52,428,800-byte limit. **Do not use `feed-videos` for 100 MB Reels, and do not create a public bucket.**

Supabase Storage documentation confirms that private objects require authenticated access checked by Storage RLS or short-lived signed URLs. Do not mistake a private bucket for a complete Reels authorization policy: its current policies were designed for HoopFeed and must be audited before reuse.

## Release-blocking design

1. Keep Reels disabled until `reels` RLS, private media authorization, reporting, blocking and moderation are deployed and verified. Existing preflight returns `uploadEnabled:false`.
2. Use the existing private `hoopfeed-private-videos` bucket **only after** confirming its current INSERT/SELECT/UPDATE/DELETE policies do not let Reels bypass follower/block/expiration checks or expose HoopFeed files. Prefer an isolated `reels-private-videos` private bucket if policy separation cannot be proven; no paid infrastructure required.
3. Issue a server-authorized, short-lived upload capability scoped to a new random path owned by the authenticated user; never accept caller-chosen object paths. Verify membership, suspension, new-account quota, metadata, and server-side moderation again on finalize. Forbid upsert.
4. Verify actual stored file size, content signature/MIME and decoded media duration on the server; do not trust `durationSeconds` or `mimeType` submitted to preflight. If duration verification is unavailable, fail closed instead of publishing.
5. Store the **bucket and object path**, not a public URL, in the Reels record. Only a dedicated delivery route may issue short-lived read URLs, after checking authenticated viewer, RLS-visible active Reel, author visibility, follows, blocks, and moderation. Use `Cache-Control: no-store`.
6. Add actual JWT test fixtures for author, eligible follower, non-follower, blocked viewer, expired subscriber, suspended author, and removed/under-review Reels. Confirm no listing, guessing, or direct object download bypass.
7. Confirm `Report` and `Block` work for reel, comment and author before enabling uploads. Reuse existing moderation rather than creating parallel rules.

## Evidence

Read-only production query: `select id,name,public,file_size_limit,allowed_mime_types from storage.buckets order by id;`.

Supabase docs: https://supabase.com/docs/guides/storage/buckets/fundamentals and https://supabase.com/docs/guides/storage/security/access-control.

This document is a **plan, not a migration**. No storage bucket, policy or production data was changed.
