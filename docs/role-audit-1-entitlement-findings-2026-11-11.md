# ROLE-AUDIT-1 — Unified HoopFeed role and moderation audit

Decision confirmed 2026-11-11: **One unified HoopFeed** for Player, Fan, Coach, Scout, Agent, and Club Admin accounts. Admin override is preserved. Do not restore a separate Fan Feed UI.

## Changes
- The canonical entitlement helper recognizes only supported account types for paid HoopFeed access, rather than treating arbitrary nonempty role strings as authorized.
- Player, Fan, Coach, Scout, Agent, and Club Admin Pro/Premium retain read/post permissions; Free cannot post. Admin override remains.
- Tests assert all six supported roles, unknown-role denial, and existing Fan Pro posting contract.
- `/fan-feed` remains a redirect to `/feed`; the legacy `/api/fan-feed/moderate` remains in place for compatibility pending caller inventory. It is Fan-only and must not become a second public composer.

## Legacy Fan Feed compatibility finding
- `app/api/fan-feed/moderate/route.ts` still writes `fan_feed_posts` and `fan_feed_comments`, while the unified `/feed` page uses `feed_posts` and `/api/hoopfeed/moderate`. This is a real divergent write path, not evidence of a second active UI.
- Do not delete legacy rows or remove the endpoint until callers, saved deep links, and any migration/archival requirements are inventoried. Test that no active UI invokes the legacy route.

## Source findings and release blockers
- `app/feed/page.tsx` posts through `/api/hoopfeed/moderate` and has one composer.
- `app/api/hoopfeed/moderate/route.ts` checks the canonical entitlement server-side, and restricts pinning and official news to Admin.
- On current main, vote, bookmark, share, and other actions use service-role reads. **PR #464** contains visibility fixes and must be integrated before claiming cross-account privacy. **PR #467/#473** address 24-hour expiry. Do not infer privacy solely from UI checks.
- Legacy `/api/fan-feed/moderate` uses a separate Fan-only authorization path; audit callers and sunset it in a follow-up after compatibility verification.
- Static source review does not establish successful staging login, posting, moderation, or RLS isolation.

## Staging verification matrix
1. For each role (Player, Fan, Coach, Scout, Agent, Club Admin), verify Free cannot post and active Pro/Premium can create a text post, image, video, poll, comment, reaction, bookmark, and permitted reshare.
2. Check Fan Free/Pro/Premium review restrictions: Fans never write reviews; Fan Pro teaser only; Fan Premium full reviews.
3. Verify non-admin roles cannot pin or publish official news; Admin can. Moderator alone does not inherit Admin.
4. Verify content moderation rejects flagged content for all roles; failures must not publish. Verify report/block workflows.
5. Verify expired posts and followers-only posts are not accessible through guessed IDs, direct API calls, or signed media URLs; validate PR #464/#473 together.
6. Check role-specific dashboards, Fan HQ, Team HQ, Agent HQ, live games, subscriptions, and logout/session restoration separately.

No production data changes, merges, or deployments authorized.
