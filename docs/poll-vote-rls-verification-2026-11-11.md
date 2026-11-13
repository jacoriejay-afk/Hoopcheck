# Poll vote RLS verification — PR #460

## Confirmed baseline (read-only, 2026-11-11)
- `public.feed_poll_votes` RLS enabled; `post_id` references `feed_posts(id)`.
- SELECT policy for authenticated was `USING (true)`.
- `anon` and `authenticated` were granted `TRUNCATE` and other broad table privileges.
- Feed post SELECT policy requires unexpired post and `can_view_player_feed_post(author_id)`.

## Staging test plan (must execute before merging)
1. Apply migration on a **staging database**, not production.
2. Confirm `anon` has no table privileges; `authenticated` lacks TRUNCATE, TRIGGER, REFERENCES.
3. Confirm `authenticated` SELECT policy includes the authorized-post EXISTS predicate.
4. With real staging JWTs, direct-query poll votes as author, same-country paid follower, unrelated player, free player, fan, blocked user, admin/moderator, and signed-out user. Confirm visible/hidden votes match feed post visibility.
5. Repeat after post expiry and deletion.
6. Test casting a vote, changing own vote, removing own vote; verify another user's vote cannot be altered.
7. Confirm the feed UI still displays aggregate poll results correctly, including zero votes.
8. Run TypeScript, repo security audits, GitHub CI, Launch Test.
9. Require release approval and backup/rollback plan before production rollout.

## SQL inspection (read-only)
```sql
select policyname, cmd, roles, qual
from pg_policies
where schemaname='public' and tablename='feed_poll_votes';

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema='public' and table_name='feed_poll_votes'
  and grantee in ('anon','authenticated')
order by grantee, privilege_type;
```

Note: `SET ROLE authenticated` by itself does not simulate a genuine JWT or user identity. Run integration tests with distinct authenticated test accounts and direct REST calls.
