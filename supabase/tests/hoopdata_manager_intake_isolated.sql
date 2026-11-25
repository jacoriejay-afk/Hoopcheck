\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database()<>'hoopcheck_hoopdata_budget_test' THEN RAISE EXCEPTION 'Disposable fixture database required'; END IF; END $$;
\ir ../candidates/hoopdata_manager_intake_review_only.sql
DO $$ BEGIN
 IF has_function_privilege('anon','public.hoopdata_submit_manager_game(uuid,uuid,uuid,timestamptz,text,integer,integer,text,uuid)','EXECUTE') OR
 has_function_privilege('service_role','public.hoopdata_submit_manager_game(uuid,uuid,uuid,timestamptz,text,integer,integer,text,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Intake privilege too broad'; END IF;
END $$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
DO $intake$
DECLARE a uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; b uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'; l uuid:='33333333-3333-4333-8333-333333333333'; req uuid:='77777777-7777-4777-8777-777777777777'; tip timestamptz:=now()+interval '2 days'; r jsonb;
BEGIN
 r:=public.hoopdata_submit_manager_game(a,b,l,tip,'schedule',NULL,NULL,' official fixture ',req);
 IF r IS NULL OR r->>'status'<>'pending' THEN RAISE EXCEPTION 'Verified intake failed'; END IF;
 IF r IS DISTINCT FROM public.hoopdata_submit_manager_game(a,b,l,tip,'schedule',NULL,NULL,'official fixture',req) THEN RAISE EXCEPTION 'Exact retry did not resolve same request'; END IF;
 IF public.hoopdata_submit_manager_game(a,b,l,tip,'schedule',NULL,NULL,'changed evidence',req) IS NOT NULL THEN RAISE EXCEPTION 'Conflicting idempotency payload accepted'; END IF;
 IF (SELECT count(*) FROM public.hoopdata_manager_submissions WHERE request_id=req)<>1 THEN RAISE EXCEPTION 'Duplicate pending submission'; END IF;
 BEGIN
  PERFORM public.hoopdata_submit_manager_game(b,a,l,tip,'schedule',NULL,NULL,'wrong team',gen_random_uuid());
  RAISE EXCEPTION 'Unclaimed team accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.hoopdata_submit_manager_game(a,b,l,now()-interval '1 day','result',90,90,'invalid tied final',gen_random_uuid());
  RAISE EXCEPTION 'Tied final accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
END $intake$;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.hoopdata_manager_submissions WHERE request_id='77777777-7777-4777-8777-777777777777') THEN RAISE EXCEPTION 'Other manager private proposal leaked'; END IF;
 BEGIN
  PERFORM public.hoopdata_submit_manager_game('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333',now()+interval '2 days','schedule',NULL,NULL,'pending claim',gen_random_uuid());
  RAISE EXCEPTION 'Pending claim accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
