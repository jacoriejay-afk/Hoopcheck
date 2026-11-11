# Client TRUNCATE privilege verification

Production read-only audit (2026-11-11): 21 `public` tables with RLS enabled granted `TRUNCATE` to both `anon` and `authenticated`. ACL spot-check confirmed explicit grants, not only inferred privileges. PostgreSQL RLS does **not** restrict `TRUNCATE`.

## Staging acceptance query (read-only)

Run **after** applying `20261111090000_revoke_client_truncate.sql` to staging:

```sql
select c.relname,
  has_table_privilege('anon', c.oid, 'TRUNCATE') as anon_can_truncate,
  has_table_privilege('authenticated', c.oid, 'TRUNCATE') as authenticated_can_truncate
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p')
  and (has_table_privilege('anon', c.oid, 'TRUNCATE')
       or has_table_privilege('authenticated', c.oid, 'TRUNCATE'))
order by c.relname;
```

Expected: **zero rows**. Do not execute an actual `TRUNCATE` on production or live staging data.

## Regression checks
- Authenticated users can still perform permitted SELECT/INSERT/UPDATE/DELETE under their existing RLS policies.
- Fan HQ joins, posts, reactions and moderation still function.
- HoopFeed polls, bookmarks and posting activity still function.
- Live chat presence and reporting still function.
- Profile claim requests still function.
- `service_role` and database maintenance privileges remain intact.

## Overlapping migration
PR #460 separately revokes `TRUNCATE` on `feed_poll_votes`. These revokes are idempotent; rebase and re-run checks before merge to avoid confusion about migration order.

This PR is not deployed.
