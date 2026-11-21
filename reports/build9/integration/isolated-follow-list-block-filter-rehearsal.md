# Build 9 follower-list block filter candidate rehearsal — 2026-11-21

Candidate `supabase/candidates/build9_follow_list_block_filter.sql` is **review-only**, wraps BEGIN/ROLLBACK, and requires the follow and block tables and existing public list function.

In isolated `HoopCheck-PR17-Test`, one rollback-only transaction created a minimal temporary-to-transaction block fixture table, canonical follow table and historical public list function, then applied the candidate's function body. With an authenticated simulated fan claim, a public player follower list initially returned one row. After inserting a reverse block (player blocks fan), the same viewer received zero rows. SQL completed without reported error.

Independent post-rollback check found no user_blocks table, follow_relationships table, or public follow-list function.

**Not release-ready:** This regression covers one reverse-block scenario with a minimal table fixture, not the canonical block-table RLS/ACL migration. It does not cover both directions, following mode, signed JWT requests, or moderation. The candidate intentionally preserves anonymous public discovery; anonymous viewers have no identity against which to evaluate a personal block. Whether blocked accounts must be undiscoverable to anonymous visitors is a separate product/privacy decision. The historical SECURITY DEFINER implementation also needs ACL/ownership review.

No persistent database or production changes.
