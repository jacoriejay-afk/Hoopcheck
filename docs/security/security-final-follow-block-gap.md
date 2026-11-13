# SECURITY-FINAL — follow privacy and blocking enforcement gap

Production read-only schema review, 2026-11-12:

- `public.follow_relationships` exists.
- A catalog search for table names containing `block` or `mute` across non-system schemas returned no rows.
- A search for public functions named with `block` returned no rows.
- `get_public_follow_list` enforces `profile_visibility='public'` for public profile rows, but its SQL contains no explicit user-to-user block exclusion.
- `get_public_following_count` counts publicly visible targets and team targets, but has no explicit block exclusion.

**Scope and uncertainty:** These findings do not prove that blocking is absent throughout the application: a separate service, generic moderation table, or differently named relation may implement it. They do establish that these privileged follower RPCs do not directly enforce a block relationship. Do not assert a proven private-profile leak without authenticated test fixtures.

**Recommended non-production next steps:**
1. Search moderation routes, generic tables and account settings for any existing block representation.
2. Define whether blocks should hide follow edges, profile cards, counts, and search results bidirectionally.
3. Implement a server-enforced block source of truth if absent; avoid relying only on client filtering.
4. Test blocked/public/private combinations with signed-in and anonymous callers.
5. Preserve existing public-browse semantics for non-blocked users.

No schema or policy modifications executed.
