# ROLE-AUDIT-1 — Account access findings (2026-11-11)

## Verified from source and CI
- `lib/membership-tier.ts` grants `canWriteHoopFeed` to any recognized active Pro/Premium role, plus admins.
- `scripts/test-membership-tier.mjs` explicitly expects Fan Pro `canWriteHoopFeed=true`. Restricting this to Players caused VERIFY-1 to fail (run 43029486441). The proposed restriction was reverted.
- `app/fan-feed/page.tsx` redirects to `/feed` and says the feeds are unified.
- `app/feed/page.tsx` posts through `/api/hoopfeed/moderate` and displays one community feed.
- `app/api/hoopfeed/moderate/route.ts` enforces `getHoopCheckEntitlements().canWriteHoopFeed` server-side.
- `app/api/fan-feed/moderate/route.ts` still enforces Fan-only `canWriteFanFeed` for its separate legacy API. Its continued use and access model require review.

## Product decision required before changing permissions
Choose one:
1. **Unified community feed**: Players, Fans, Coaches, Agents/Scouts and other eligible roles can post through the shared endpoint with consistent moderation and entitlement tests.
2. **Separate feeds**: Player HoopFeed restricted to Players; Fan Feed restored with a working separate route and tests.

Do not change entitlements based solely on naming conventions. Existing tests and current UI reflect unified mode. Until confirmed, preserve current contract.

## Next audit coverage
- Fan Free/Pro/Premium: read/write feed, reviews read vs write, Fan HQ, men/women switch, live chat.
- Player Free/Pro/Premium: review verification, Pro Passport, recruiting, feed, game hub.
- Coach, Agent/Scout, Team Manager: dashboards, claim verification, moderation, recruiting.
- Admin: moderation and membership management.
- Validate both UI gating and server/RLS enforcement using separate staging accounts; static inspection cannot establish successful end-to-end behavior.

No production data changes, migrations, merges, or deployments authorized.
