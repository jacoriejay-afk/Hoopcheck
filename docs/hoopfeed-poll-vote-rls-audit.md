# HoopFeed poll vote RLS — verified release blocker

Verified against the live Supabase schema on 2026-11-10 (read-only inspection; no production changes).

## Current policies on public.feed_poll_votes

- `feed poll votes read`: SELECT TO authenticated USING (true).
- `feed poll votes insert own`: INSERT TO authenticated WITH CHECK (user_id = auth.uid()).
- `feed poll votes update own`: UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid()).
- `feed poll votes delete own`: DELETE TO authenticated USING (user_id = auth.uid()).

Columns: `post_id uuid`, `user_id uuid`, `option_index integer`, `created_at timestamptz`.

## Risk

Any authenticated client with table SELECT privileges can read individual votes, including votes for posts the client cannot see under `feed_posts` RLS. This leaks voter identities and choices. An API-level viewer check on voting does not protect direct Supabase reads.

## Required fix (not yet deployed)

1. Inventory client queries and confirm whether public poll totals are computed from raw vote rows.
2. Replace unrestricted SELECT with a policy scoped to the voter's own rows, **or** a viewer-authorized policy tied to the underlying approved/unexpired post if exposing voter identities is a deliberate product requirement. Prefer own-vote SELECT and aggregate-only poll totals.
3. If aggregate counts are needed, design a narrowly scoped RPC/view that checks the caller's post visibility and does not expose `user_id`. Review any SECURITY DEFINER usage and grants.
4. Test authenticated voter, different eligible viewer, non-follower, expired post, blocked user, and anonymous user. Confirm users can still change their own vote.
5. Stage and review the migration, then apply to production only after explicit approval.

**Do not merge the HoopFeed release until the vote RLS, audience policies, and public media exposure are resolved.**
