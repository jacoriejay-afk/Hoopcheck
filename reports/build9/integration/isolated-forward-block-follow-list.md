# Build 9 forward-block follower/following list regression — 2026-11-21

Target: isolated `HoopCheck-PR17-Test`. Executed canonical follow table prerequisite, historical public list function, guarded block-filter candidate, and a minimal transaction-local `user_blocks` fixture within `BEGIN ... ROLLBACK`.

Created a fan-to-player follow. Under `SET LOCAL ROLE authenticated` with simulated fan claim, verified one entry in fan's `following` list. Inserted a **fan blocks player** record and asserted both the fan's `following` list and the player's `followers` list return zero rows for the same fan viewer. SQL completed without reported error.

Independent post-rollback check: `user_blocks`, `follow_relationships`, and `get_public_follow_list` all absent.

Together with `isolated-follow-list-block-filter-rehearsal.md`, this covers both block directions in limited fixture scenarios. Still unverified: canonical block-table RLS/ACL, signed JWT HTTP requests, moderation, anonymous public discovery policy, cross-viewer block behavior and deployment compatibility. No persistent/production changes.
