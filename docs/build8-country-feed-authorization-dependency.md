# Build 8 country privacy: feed authorization dependency

Read-only production inspection of `public.can_view_player_feed_post(p_author_id uuid)` found a **critical compatibility dependency** not covered by the earlier country-only RPC prototype.

The function is SECURITY INVOKER and currently grants a premium follower access to a player's feed post only when both users' `profiles.current_country` values are non-null and equal (for player-to-player pairs). It also checks subscription, follow relationship, role, and owner/admin exceptions. The country comparison is **authorization logic**, not just a public display field.

If we simply revoke `authenticated` SELECT on `profiles.current_country`, this function can fail with a permission error. If we instead compare only public country projections, players who opt to hide their country may unexpectedly lose feed visibility. Neither behavior is acceptable without explicit product decision.

## Mandatory design and test gates

- Preserve the current player-to-player same-country feed access decision while keeping both private country strings hidden from callers.
- Keep the function's existing owner/admin, subscription, follower, role, and visibility behavior intact.
- Candidate: narrowly scoped SECURITY DEFINER boolean predicate for country match that only returns a decision and validates its caller/context; the feed policy must use that predicate without exposing country text. **Not implemented or approved.** Audit potential RLS recursion and privilege escalation first.
- Test matching and nonmatching private countries, public/private flags, missing country, owner, fan, coach, subscription expiry, no follow, and unauthorized requests.
- Ensure owner profile edits still update the underlying country and immediately affect feed eligibility.
- Rehearse all of this in an isolated, production-equivalent database before any permission migration.

Evidence: production `pg_get_functiondef` for `public.can_view_player_feed_post(uuid)` retrieved read-only on 2026-11-19. No production data was read or changed.
