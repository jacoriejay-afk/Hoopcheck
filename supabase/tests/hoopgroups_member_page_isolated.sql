-- Supplemental disposable-only fixture, following private access tests.
\ir ../candidates/hoopgroups_member_page_review_only.sql
INSERT INTO auth.users(id) SELECT ('50000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid FROM generate_series(1,151) i;
INSERT INTO public.profiles SELECT id,CASE WHEN id='50000000-0000-4000-8000-000000000151' THEN 'last member needle' ELSE 'Fixture roster member' END,CASE WHEN id='50000000-0000-4000-8000-000000000150' THEN 'private' ELSE 'public' END FROM auth.users WHERE id::text LIKE '50000000%';
INSERT INTO public.hoop_group_members(space_id,user_id) SELECT '20000000-0000-4000-8000-000000000002',id FROM auth.users WHERE id::text LIKE '50000000%';
SET fixture.active='yes';SET fixture.mfa='yes';SET ROLE authenticated;SET request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
DO $f$ DECLARE p jsonb; after_id uuid; n integer:=0; steps integer:=0; BEGIN
 LOOP
 p:=public.hoop_group_member_page('20000000-0000-4000-8000-000000000002',after_id);
 n:=n+jsonb_array_length(p->'rows');steps:=steps+1;
 EXIT WHEN NOT(p->>'has_more')::boolean;
 after_id:=(p->'rows'->49->>'user_id')::uuid;
 IF steps>5 THEN RAISE EXCEPTION 'roster loop'; END IF;
 END LOOP;
 IF n<>152 OR steps<>4 THEN RAISE EXCEPTION 'roster truncated: %',n; END IF;
 IF jsonb_array_length(public.hoop_group_member_page('20000000-0000-4000-8000-000000000002',NULL,'needle')->'rows')<>1 THEN RAISE EXCEPTION 'roster search incomplete'; END IF;
 IF jsonb_array_length(public.hoop_group_member_page('20000000-0000-4000-8000-000000000002',NULL,'HoopCheck member')->'rows')<>1 THEN RAISE EXCEPTION 'private label not respected'; END IF;
 PERFORM set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000001',false);
 BEGIN PERFORM public.hoop_group_member_page('20000000-0000-4000-8000-000000000002'); RAISE EXCEPTION 'member saw owner roster'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('fixture.active','no',false);
 BEGIN PERFORM public.hoop_group_member_page('20000000-0000-4000-8000-000000000002'); RAISE EXCEPTION 'revoked roster'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $f$;
RESET ROLE;
SELECT 'PASS owner-only roster search and pagination beyond 100 members';
