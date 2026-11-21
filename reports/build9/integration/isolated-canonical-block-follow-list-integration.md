# Build 9 canonical user-block + follow-list integration — 2026-11-21

Isolated project `HoopCheck-PR17-Test`. One rollback-only SQL transaction combined the canonical follow table prerequisite, the **actual** `user_blocks` table/RLS/ACL statements from `20261113182500_hoopfeed_follower_only_read_rls.sql`, the historical `get_public_follow_list`, and the guarded `build9_follow_list_block_filter.sql` candidate.

With two existing auth-backed fan profiles A and B, and an existing public player target, created A→player follow. Under `SET LOCAL ROLE authenticated` and simulated B claim, B saw one row in A's public `following` list. B then inserted an owner-authorized `user_blocks(B,A)` record through canonical RLS. The same function returned zero rows for B. SQL completed without reported error.

Independent post-rollback check confirmed `user_blocks`, `follow_relationships`, and `get_public_follow_list` absent. No persistent test or production changes.

Limitations: one canonical-RLS integration scenario; no signed JWT HTTP, reverse block under canonical policies, anonymous discovery policy, moderation or release compatibility. The historical function remains SECURITY DEFINER with anonymous EXECUTE and must receive final ACL/ownership review. Build 9 HOLD.
