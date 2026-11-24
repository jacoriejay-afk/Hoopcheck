# Build 9 private-player follower-count privacy — isolated rollback rehearsal

On 2026-11-21 in `HoopCheck-PR17-Test`, executed the canonical follow-table and private RPC candidates together inside `BEGIN ... ROLLBACK`.

Selected an existing player test profile and fan test profile by account type, without exporting identifiers. Inserted a follow record for the player, then simulated authenticated fan JWT subject via `SET LOCAL ROLE authenticated` and `request.jwt.claim.sub`. Verified the public player's follower count was 1. Reset to database owner **inside the transaction only**, temporarily changed that player's `profile_visibility` to `private`, switched back to authenticated fan, and verified `public.get_follow_count('player', player_id)` returned 0. Switched simulated subject to the player and verified their own count returned 1.

SQL completed without reported error. Independent post-rollback checks: follow table absent, zero private player profiles, and original private count stub preserved. All profile visibility and follow record changes were rolled back.

This is simulated role/claim database acceptance, **not** signed JWT HTTP acceptance. Fan privacy, blocked users, list endpoints, AAL1/AAL2, migration dependency review, and installed-client compatibility remain outstanding. No persistent schema/data changes or production actions.
