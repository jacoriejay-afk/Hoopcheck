# SECURITY-FINAL — blocking implementation source trace

Repository source review, 2026-11-12:

- Searches for `blocked_user` returned no matching files; searches for `blocked` found game-chat and moderation logic, not a demonstrated user-to-user block source of truth.
- `app/admin/rights/page.tsx` uses the word `blocked` for licensing/production approval, unrelated to interpersonal blocking.
- `components/ProtectionLayer.tsx` prevents context menus, drag-start and some keyboard shortcuts; it is not user-blocking functionality.
- Production catalog queries found no table named with `block` or `mute` across non-system schemas, and no public RPC with `block` in its name.
- The privileged follower RPCs have no block-relationship predicates.

**Assessment:** No server-enforced user-to-user blocking mechanism has been verified. This is a moderation/release-readiness gap, not a demonstrated unauthorized private-profile disclosure. Further inspect generic moderation data and all API endpoints before concluding the feature is entirely absent.

**Proposed implementation direction, not yet applied:** user-to-user block table with owner-scoped RLS; server-enforced checks in follower reads/writes, feed interactions and direct messaging; unblock behavior and abuse-resistant rate limits; regression tests for blocked and private users. Avoid client-only filtering. Preserve public profile browsing for nonblocked users.

No production changes.
