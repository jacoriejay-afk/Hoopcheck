# HoopGroups V2 — user-owned communities & personalized chat

Status: **code candidate, staging database verified; production activation blocked** (2026-11-22).

## What users will be able to do
- Create up to three topic-based servers with a name, description, category, icon and preset accent color
- Automatically join the created server with #welcome, #general and #game-talk
- Search public communities, join or leave, switch servers, and share invite links through sign-in
- Add and rename channels in owned servers (maximum 12); no destructive channel deletion
- Set chat layout (bubble / classic), spacing (comfortable / compact) and font size (default / large), saved per user and server on the current device
- Receive approved channel updates via 15-second refresh polling when the tab is visible
- View a private owner moderation queue; approve or reject only messages from owned servers, with recorded audit events

This is **not** Discord's full feature set: no voice rooms, live presence, unmoderated instant messaging, file uploads or bot integrations. Team Fan Groups are a different feature and are unchanged.

## Test backend results
Staging project: `HoopCheck-PR17-Test` (never production). Requires v1 community schema already installed.

- Executed `supabase/candidates/hoopgroups_owner_spaces_v2_review_only.sql` first with ROLLBACK, then applied **only** to the separate test database.
- Verified real PostgreSQL role/RLS behavior in rollback-only transactions: starter member and 3 channels are created atomically; owner can customize server and add/rename channels; nonowner cannot edit; fourth server is denied; unauthorized clients cannot execute the moderation RPC.
- A separate test of the updated service-role RPC confirmed a server owner can approve a member's pending post in **their** server, a non-owner cannot, an audit event is written, and the member can then read the approved message. Transaction rolled back.
- Test database retains zero test posts and memberships. Existing seeded servers and channels are preserved.
- RLS remains enabled; client UPDATE grants are column-scoped. The moderator RPC remains restricted to `service_role`; API validates bearer token and owner/channel association again before calling it.
- An index for `owner_id` was added. There are no direct client grants on moderation audit tables.

## Release/activation gates
1. Review the separate additive v1/v2 candidates against the current **production schema**, sequence and existing policies. Prepare versioned migrations, rollout and rollback plan. Do not alter production function ownership, relax RLS or grant broad public privileges.
2. Complete actual staging HTTP E2E with signed-in accounts for creation, quota, discovery, join, leaving, invited navigation, owner edit, new channels, posts pending, approval/rejection, report, block and cross-server IDOR denial.
3. Check that an authorized HoopCheck platform moderator can still remove an owner-approved message and that safety/report queues remain functional.
4. Verify the real iPhone Safari/PWA at 320/375/390 px in both themes and Spanish/English where relevant. Confirm keyboard, bottom tab, dropdown/popovers and high text zoom.
5. Obtain exact-head build, launch/entitlement and Vercel preview checks.
6. Apply reviewed production migrations only after backend authorization and acceptance, then set **both** `NEXT_PUBLIC_HOOPGROUPS_CHANNELS_ENABLED=true` and `HOOPGROUPS_CHANNELS_SERVER_ENABLED=true` on the verified HoopCheck production project and rebuild it. Never point public preview/production at the test database.
7. Monitor error rates and moderation queue capacity; use both feature switches to roll back immediately if needed while preserving all content for retention review.

## Current known blockers
The production database has no `hoop_group_%` tables and both production HoopGroups feature flags are absent as of this review. No production SQL, Vercel flag edits or native/EAS builds are part of this PR.
