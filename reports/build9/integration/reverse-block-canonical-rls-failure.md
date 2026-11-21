# Build 9 reverse-block canonical-RLS regression FAILURE — 2026-11-21

**Blocking finding.** In isolated `HoopCheck-PR17-Test`, a rollback-only integration assembled the canonical follow table, original `user_blocks` schema/RLS/ACL, historical `get_public_follow_list`, and `build9_follow_list_block_filter.sql`.

Two auth-backed fan fixtures A and B: A follows a public player; B inserts a canonical owner-authorized block against A. Switching to simulated authenticated A, direct SELECT on `user_blocks` correctly reveals no row (reverse block is private). **But A's `following` RPC still returned a row.** The test raised `P0001: reverse block not enforced`. This contradicts the simplified-fixture reverse-block pass and means the current candidate is **not safe for promotion**.

The failure may involve security-definer ownership/execution context or the block predicate; no root cause has yet been verified. Do not bypass block-table RLS, add broad SELECT grants, change protected function ownership, or claim this check passes. Investigate the actual function owner and effective execution privileges, then design a scoped, audited block check preserving reverse-block confidentiality. Re-run authenticated A/B and anon scenarios using canonical RLS and, separately, real signed JWT HTTP acceptance.

The SQL call failed and its transaction was rolled back. Independent check confirms no `user_blocks`, `follow_relationships`, or public follow-list function remained. No persistent or production changes. **Build 9 HOLD.**
