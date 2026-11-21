# Build 9 anonymous role-switch denial rehearsal — 2026-11-21

Target: isolated `HoopCheck-PR17-Test` only.

Within one `BEGIN ... ROLLBACK` transaction, executed the current canonical follow-table candidate, then:

```sql
SET LOCAL ROLE anon;
DO $anon$
BEGIN
  BEGIN
    EXECUTE 'SELECT count(*) FROM public.follow_relationships';
    RAISE EXCEPTION 'Anonymous SELECT unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END
$anon$;
RESET ROLE;
ROLLBACK;
```

The SQL executor reported no error. The assertion succeeds only when the anonymous SELECT fails with `insufficient_privilege`; an unexpected successful SELECT raises a different error. This tests the database role under a transaction, **not** a real PostgREST anonymous request or a user JWT. No persistent schema changes.

Pending: actual signed-in owner/non-owner API tests, authenticated follow write/read behavior, private counts, downstream follow list contracts, protected public-profile owner reconciliation, and final-head CI.
