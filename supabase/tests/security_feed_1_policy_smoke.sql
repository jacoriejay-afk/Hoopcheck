-- SECURITY-FEED-1 smoke tests: run in a disposable/staging database
-- AFTER applying the matching migration. Rolls back all test data.
begin;
do $$
begin
 if to_regclass('public.user_blocks') is null then
   raise exception 'SECURITY-FEED-1 migration missing';
 end if;
 if not exists (
   select 1 from pg_policies
   where schemaname='public' and tablename='feed_posts'
   and policyname='unified hoopfeed approved posts read'
   and qual ilike '%user_blocks%'
   and qual ilike '%follow_relationships%'
 ) then
   raise exception 'Feed RLS does not include follower and block guards';
 end if;
 if not exists (
   select 1 from pg_policies
   where schemaname='public' and tablename='user_blocks'
   and cmd='INSERT' and with_check ilike '%blocker_id%'
 ) then
   raise exception 'Block insertion ownership policy missing';
 end if;
 if not exists (
   select 1 from pg_policies
   where schemaname='public' and tablename='user_blocks'
   and cmd='DELETE' and qual ilike '%blocker_id%'
 ) then
   raise exception 'Block deletion ownership policy missing';
 end if;
end $$;
rollback;
-- Follow-up: execute authenticated API matrix with real test users and
-- approved posts before promotion. These structural checks are not a
-- substitute for testing author/follower/nonfollower/blocked/moderator.
