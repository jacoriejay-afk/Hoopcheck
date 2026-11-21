# Build 9 public follower-list privacy — isolated regression (2026-11-21)

Target: `HoopCheck-PR17-Test` (`vcprqpjkyubzzcjatdpx`).

Source: `supabase/migrations/20261113161000_public_follow_list_privacy.sql`. The installed project lacks `public.get_public_follow_list(text,text,uuid,uuid)` and `public.follow_relationships`.

Ran the committed follow-table prerequisite and the exact historical public follow-list migration in a single rollback-only transaction. Function creation completed without reported SQL error.

Using existing isolated test-profile IDs, inserted a follower record for a public player, switched to `authenticated` with simulated fan claim, and asserted one follower-list row. Temporarily switched the target player to private inside the transaction and asserted the non-owner sees zero rows. Switched simulated claim to the player and asserted one row is available to the owner. The transaction completed without reported error.

Independent post-rollback query confirmed the follow table and public list function are both absent, and no private player profiles remain.

**Security warning:** This exercise used the historical `SECURITY DEFINER` function *inside a rolled-back transaction*. It is **not** a reviewed candidate for persistent rollout. The historical function's default function EXECUTE ACL, definer ownership, other follow-list modes, private follower visibility, anonymous HTTP exposure, moderation, and installed-client compatibility require separate review before considering deployment. Simulated claims are not signed JWTs.

No persistent test/production database changes, merges, deployments or EAS.
