-- HOOPFEED-SHARE-1 permission regression checks.
-- Run after the direct-shares migration in a disposable PostgreSQL database.
-- Does not create users, change production data, or require service credentials.
DO $$
DECLARE
  policy_count integer;
BEGIN
  IF to_regclass('public.hoopfeed_direct_shares') IS NULL THEN
    RAISE EXCEPTION 'Direct-share table missing';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.hoopfeed_direct_shares'::regclass) THEN
    RAISE EXCEPTION 'Direct-share RLS disabled';
  END IF;
  SELECT count(*) INTO policy_count FROM pg_policies
    WHERE schemaname='public' AND tablename='hoopfeed_direct_shares';
  IF policy_count <> 3 THEN
    RAISE EXCEPTION 'Expected 3 direct-share policies; found %', policy_count;
  END IF;
  IF has_table_privilege('anon','public.hoopfeed_direct_shares','SELECT')
     OR has_table_privilege('anon','public.hoopfeed_direct_shares','INSERT') THEN
    RAISE EXCEPTION 'Anonymous users have share access';
  END IF;
  IF has_table_privilege('authenticated','public.hoopfeed_direct_shares','UPDATE') THEN
    RAISE EXCEPTION 'Authenticated users can update shares';
  END IF;
  IF has_column_privilege('authenticated','public.hoopfeed_direct_shares','created_at','INSERT')
     OR has_column_privilege('authenticated','public.hoopfeed_direct_shares','id','INSERT') THEN
    RAISE EXCEPTION 'Authenticated users can forge server-controlled share fields';
  END IF;
  IF NOT has_column_privilege('authenticated','public.hoopfeed_direct_shares','post_id','INSERT')
     OR NOT has_column_privilege('authenticated','public.hoopfeed_direct_shares','recipient_id','INSERT') THEN
    RAISE EXCEPTION 'Authenticated share inserts are missing required column grants';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.hoopfeed_direct_shares'::regclass
      AND tgname='hoopfeed_direct_share_rate_limit' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Share rate-limit trigger missing';
  END IF;
  RAISE NOTICE 'HOOPFEED-SHARE-1 structural permission checks passed';
END $$;

-- A signed-in user who is neither party must not be able to probe recipient
-- access through the SECURITY DEFINER helper.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
DO $$
BEGIN
  IF private.hoopfeed_share_recipient_can_read(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid
  ) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Unrelated authenticated user can probe recipient access';
  END IF;
  IF private.hoopfeed_share_not_blocked(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid
  ) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Unrelated authenticated user can probe block status';
  END IF;
END $$;
RESET ROLE;
