-- Execute only against the disposable CI PostgreSQL service.
SET ROLE authenticated;
DO $$
DECLARE
  i integer;
  visible_count integer;
  check_count integer;
  expected integer;
BEGIN
  FOR i IN 1..10 LOOP
    PERFORM set_config('request.jwt.claim.sub',
      '00000000-0000-0000-0000-' || lpad(i::text,12,'0'), true);
    SELECT count(*) INTO visible_count FROM public.feed_posts
      WHERE id = '10000000-0000-0000-0000-000000000001'::uuid;
    expected := CASE WHEN i <= 6 THEN 1 ELSE 0 END;
    IF visible_count <> expected THEN
      RAISE EXCEPTION 'Role fixture % approved permanent post visibility %, expected %', i, visible_count, expected;
    END IF;
    SELECT count(*) INTO check_count FROM public.feed_posts
      WHERE id = '10000000-0000-0000-0000-000000000002'::uuid;
    IF check_count <> CASE WHEN i = 1 THEN 1 ELSE 0 END THEN
      RAISE EXCEPTION 'Role fixture % pending post visibility incorrect', i;
    END IF;
    IF i <= 6 THEN
      INSERT INTO public.feed_post_checks(post_id,user_id)
      VALUES ('10000000-0000-0000-0000-000000000001'::uuid,
        ('00000000-0000-0000-0000-' || lpad(i::text,12,'0'))::uuid);
    ELSE
      BEGIN
        INSERT INTO public.feed_post_checks(post_id,user_id)
        VALUES ('10000000-0000-0000-0000-000000000001'::uuid,
          ('00000000-0000-0000-0000-' || lpad(i::text,12,'0'))::uuid);
        RAISE EXCEPTION 'Unexpectedly allowed check for fixture %', i;
      EXCEPTION WHEN insufficient_privilege THEN
        NULL;
      END;
    END IF;
  END LOOP;
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
  BEGIN
    INSERT INTO public.feed_post_checks(post_id,user_id)
    VALUES ('10000000-0000-0000-0000-000000000002'::uuid,
      '00000000-0000-0000-0000-000000000002'::uuid);
    RAISE EXCEPTION 'Pending post check unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  IF (SELECT count(*) FROM public.feed_post_checks) <> 6 THEN
    RAISE EXCEPTION 'Expected exactly six authorized checks';
  END IF;
END $$;
RESET ROLE;
-- Permanent posts have no 24-hour default after the migration.
SELECT CASE WHEN column_default IS NULL THEN 'PASS: permanent posts have no expiry default'
  ELSE (1/0)::text END
FROM information_schema.columns
WHERE table_schema='public' AND table_name='feed_posts' AND column_name='expires_at';
