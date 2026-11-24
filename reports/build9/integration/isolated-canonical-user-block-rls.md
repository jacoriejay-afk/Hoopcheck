# Build 9 canonical user-block RLS regression — 2026-11-21

Isolated `HoopCheck-PR17-Test` project. In a rollback-only transaction, used the original `user_blocks` table, grants and RLS policies from `supabase/migrations/20261113182500_hoopfeed_follower_only_read_rls.sql`, alongside the follow prerequisite (the full unrelated HoopFeed migration was **not** replayed).

Using two existing fan profiles backed by `auth.users`, `SET LOCAL ROLE authenticated` and simulated `request.jwt.claim.sub` values:
- Fan A inserted a block of Fan B and saw their own block row.
- Fan B's SELECT returned no rows, preventing enumeration of who blocked them.
- Fan B's attempted INSERT with Fan A as blocker raised an expected privilege/RLS exception caught by the test.

The first test statement had a SQL syntax error in a test-only exception block; it was corrected and the successful run completed without reported SQL error.

Independent post-rollback check confirmed `public.user_blocks` and `public.follow_relationships` absent. No persistent schema/data changes.

This tests canonical block-table RLS only; it does not prove the follower-list candidate behaves correctly under the canonical block-table policies, nor signed JWT HTTP behavior, delete permissions, moderation, or full migration rollout compatibility.
