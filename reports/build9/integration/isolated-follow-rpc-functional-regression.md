# Build 9 isolated follow RPC functional regression — 2026-11-21

Target: HoopCheck-PR17-Test (`vcprqpjkyubzzcjatdpx`), not production.

In one rollback-only transaction, ran the committed canonical follow-table candidate and private follow RPC reconciliation candidate, then used two existing test-profile IDs, `SET LOCAL ROLE authenticated`, and `request.jwt.claim.sub` simulation.

Assertions passed without a reported SQL error:
- `public.can_user_follow_target` returned true for the simulated current profile following a team.
- It returned false for an attempt to supply another profile's user ID.
- It returned false for unsupported `fan` target type.
- After an owner-scoped follow insert, `public.get_follow_count('team', target)` returned 1.
- After switching simulated claim to the second profile, the first profile could not be impersonated in the eligibility RPC.

Independent post-rollback query confirmed the table was absent and both private functions retained their original null-returning stub definitions. No changes persisted.

**Limitations:** Role/JWT claim simulation, not signed Supabase JWT/API acceptance. Player/fan privacy counts, blocked-user behavior, real HTTP API, downstream follow lists, AAL1/AAL2, and legacy installed clients remain unverified. Protected profile-function ownership reconciliation remains blocked. No production changes, merge, deploy or EAS.
