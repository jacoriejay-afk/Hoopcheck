# SECURITY-FINAL — social RPC block enforcement inventory

Read-only source review of `supabase/migrations/20261102150000_ig1_public_follow_lists.sql` and latest production security context.

## Additional surfaces requiring enforcement
- `get_shared_team_followers(p_team_id)`: SECURITY DEFINER, authenticated; traverses the caller's followed players and returns up to three public display names. Must suppress blocked users.
- `get_social_suggestions()`: SECURITY DEFINER, authenticated; traverses second-degree follow graph and suggests public player profiles or teams. Must suppress blocked player candidates, and review whether blocked intermediaries should contribute to suggestions.
- `get_public_follow_list(...)`: anon/authenticated; preserve public browsing for nonblocked users, but hide blocked person-to-person edges for signed-in viewers.
- `get_public_following_count(p_user_id)`: anon/authenticated; define count semantics after blocking and ensure counts cannot reveal private edges.

## Release implications
A block-table migration by itself is **not** a complete safety fix. Any privileged function bypassing ordinary RLS needs explicit block filtering, and server-role routes must check blocks before returning private content or accepting interactions. Avoid enabling a client-only feature before the server enforcement matrix is complete.

## Required tests
1. A blocks B: neither appears as a suggestion or shared follower to the other.
2. Third-party public profiles and team suggestions remain available.
3. Public anonymous follower lists remain privacy-filtered.
4. Private-profile followers are not revealed by privileged functions.
5. Block/unblock does not corrupt follow counts or restore follows automatically.

No production change, no executable migration.
