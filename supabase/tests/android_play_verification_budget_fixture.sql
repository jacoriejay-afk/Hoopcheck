\set ON_ERROR_STOP on
do $test$ begin
 if has_function_privilege('authenticated','public.play_take_test_verification_budget(uuid)','EXECUTE') or has_function_privilege('anon','public.play_take_test_verification_budget(uuid)','EXECUTE') or has_table_privilege('authenticated','play_billing_candidate.verification_budget','SELECT,INSERT,UPDATE,DELETE') or has_column_privilege('service_role','play_billing_candidate.verification_budget','owner_id','UPDATE') then raise exception 'unsafe verification budget privileges'; end if;
end $test$;
set role service_role;
do $test$
declare a uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; b uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'; i int;
begin
 for i in 1..5 loop if not public.play_take_test_verification_budget(a) then raise exception 'early limit'; end if; end loop;
 if public.play_take_test_verification_budget(a) or public.play_take_test_verification_budget(null) then raise exception 'limit bypass'; end if;
 if not public.play_take_test_verification_budget(b) then raise exception 'independent owner blocked'; end if;
 update play_billing_candidate.verification_budget set window_started_at=clock_timestamp()-interval '11 minutes' where owner_id=a;
 if not public.play_take_test_verification_budget(a) then raise exception 'window reset failed'; end if;
 if (select attempts from play_billing_candidate.verification_budget where owner_id=a)<>1 then raise exception 'reset count wrong'; end if;
end $test$;
reset role;
