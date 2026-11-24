# Build 9 isolated rollback-only SQL rehearsal — 2026-11-21

Project: **HoopCheck-PR17-Test** (`vcprqpjkyubzzcjatdpx`). Production untouched.

## Rehearsal 1: canonical follow table prerequisite

Executed exact candidate `supabase/candidates/build9_follow_relationships_prerequisite.sql` through the connected isolated Supabase SQL executor, including its `BEGIN` and `ROLLBACK`. SQL returned `[]` without reported error.

Independent post-query:
```sql
select to_regclass('public.follow_relationships')::text as table_after_rollback;
```
Result: `null`.

## Rehearsal 2: combined table and private RPC implementation

Loaded the exact committed table candidate and `supabase/candidates/build9_follow_rpc_stub_reconciliation.sql`, removed their individual transaction delimiters and executed their contents sequentially under **one** `BEGIN; ... ROLLBACK;` transaction. SQL returned `[]` without reported error.

Independent post-query:
```sql
select to_regclass('public.follow_relationships')::text as table_after_combined_rollback,
 pg_get_functiondef(to_regprocedure('private.can_user_follow_target(uuid,text,uuid)'))
   like '%null::boolean%' as eligibility_stub_preserved,
 pg_get_functiondef(to_regprocedure('private.get_follow_count(text,uuid)'))
   like '%null::bigint%' as count_stub_preserved;
```
Result: `table_after_combined_rollback=null`, `eligibility_stub_preserved=true`, `count_stub_preserved=true`.

## Scope and remaining gates

These results prove the guarded SQL can run and rollback on the isolated test schema. They **do not** establish functional authorization correctness, canonical follow-table grants for authenticated users, real owner/non-owner/anonymous API acceptance, all downstream migrations, production compatibility, or the separate protected player-profile function ownership requirement. In particular, do not claim full backend completion based on successful rollback.

No production changes, persistent isolated schema changes, migration-history writes, merges, deployments or EAS builds.
