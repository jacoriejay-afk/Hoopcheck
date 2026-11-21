# Build 9 anonymous follower-list privacy regression — 2026-11-21

Target: isolated `HoopCheck-PR17-Test` (`vcprqpjkyubzzcjatdpx`).

Within one `BEGIN ... ROLLBACK` transaction, created the canonical follow-table prerequisite and the historical `get_public_follow_list` function. Selected existing test player/fan profiles, inserted a follow record, switched to `SET LOCAL ROLE anon`, and asserted the public player's follower list returned one row.

The first fixture-repair attempt failed because `authenticated` has no direct UPDATE privilege on `public.profiles`; **no grants were added**. In the successful attempt, restored the existing database owner role for fixture setup, set the simulated player owner claim, updated `profile_visibility='private'`, cleared the claim, switched back to `anon`, and asserted the follower list returned zero rows. The successful SQL completed without reported error.

Independent post-rollback query: follow table absent, follow-list function absent, and zero private player profiles. No persistent database changes.

**Limitations:** This is an isolated SQL role simulation, not a signed anonymous HTTP/PostgREST request. Historical SECURITY DEFINER/EXECUTE permissions need final review; other list modes, private follower visibility, blocked users, moderation, and legacy installed-client compatibility remain unverified. No production changes, merges, deployments or EAS.
