# Build 9 following-list privacy — isolated regression (2026-11-21)

Isolated test project `HoopCheck-PR17-Test` only. In one `BEGIN ... ROLLBACK` transaction, executed the canonical follow table prerequisite and the historical `20261113161000_public_follow_list_privacy.sql` function, using existing test player and fan profiles.

Created a fan-to-player follow. With `SET LOCAL ROLE anon`, asserted the public fan's `following` list has one entry. Changed the fan's visibility to private under the existing database role with a simulated matching owner claim (no new grants). Then asserted zero rows for anon and zero for a separate authenticated fan claim. Finally, asserted one row for the private fan's own authenticated claim. All assertions completed without reported SQL error.

Independent post-rollback check: `public.follow_relationships` absent, `public.get_public_follow_list` absent, and zero private fan profiles. No persistent database changes.

Limitations: SQL claim simulation, not signed HTTP JWT; historical SECURITY DEFINER/EXECUTE exposure, blocked users, moderation, other list variants, and installed-client compatibility still require review. No production changes, merges, deployments, or EAS.
