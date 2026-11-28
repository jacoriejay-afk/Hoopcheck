\set ON_ERROR_STOP on
do $test$ begin
 if has_table_privilege('authenticated','play_billing_candidate.purchase_intents','SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('anon','play_billing_candidate.test_fulfillments','SELECT,INSERT,UPDATE,DELETE') then raise exception 'client intent or receipt access'; end if;
 if has_function_privilege('authenticated','play_billing_candidate.consume_test_intent(uuid,uuid,uuid,text,text,text,text,text)','EXECUTE') or has_function_privilege('anon','play_billing_candidate.commit_test_fulfillment(text,uuid,bigint,timestamptz)','EXECUTE') then raise exception 'client invocation allowed'; end if;
 if has_column_privilege('service_role','play_billing_candidate.purchase_intents','owner_id','UPDATE') or has_table_privilege('service_role','play_billing_candidate.test_fulfillments','UPDATE,DELETE,TRUNCATE') then raise exception 'ownership mutable'; end if;
end $test$;
set role service_role;
do $test$
declare
 a uuid:='11111111-1111-4111-8111-111111111111';
 b uuid:='22222222-2222-4222-8222-222222222222';
 s uuid:='33333333-3333-4333-8333-333333333333';
 id uuid; i integer; g bigint; fp text:=repeat('a',64);
 future timestamptz:=clock_timestamp()+interval '1 day';
begin
 id:=play_billing_candidate.issue_test_intent(a,s,repeat('a',64),'hoopcheck.pro','monthly','4990000','USD');
 if id is null then raise exception 'issue failed'; end if;
 if play_billing_candidate.consume_test_intent(id,b,s,repeat('a',64),'hoopcheck.pro','monthly','4990000','USD') then raise exception 'foreign owner'; end if;
 if play_billing_candidate.consume_test_intent(id,a,b,repeat('a',64),'hoopcheck.pro','monthly','4990000','USD') then raise exception 'foreign session'; end if;
 if play_billing_candidate.consume_test_intent(id,a,s,repeat('b',64),'hoopcheck.pro','monthly','4990000','USD') then raise exception 'foreign account'; end if;
 if play_billing_candidate.consume_test_intent(id,a,s,repeat('a',64),'hoopcheck.pro','monthly','5990000','USD') then raise exception 'price changed'; end if;
 if not play_billing_candidate.consume_test_intent(id,a,s,repeat('a',64),'hoopcheck.pro','monthly','4990000','USD') then raise exception 'consume failed'; end if;
 if play_billing_candidate.consume_test_intent(id,a,s,repeat('a',64),'hoopcheck.pro','monthly','4990000','USD') then raise exception 'intent replay'; end if;
 for i in 1..4 loop
  if play_billing_candidate.issue_test_intent(a,s,repeat('a',64),'hoopcheck.pro','monthly','4990000','USD') is null then raise exception 'premature rate limit'; end if;
 end loop;
 if play_billing_candidate.issue_test_intent(a,s,repeat('a',64),'hoopcheck.pro','monthly','4990000','USD') is not null then raise exception 'missing rate limit'; end if;
 id:=gen_random_uuid();
 insert into play_billing_candidate.purchase_intents(intent_id,owner_id,session_id,account_id,product_id,base_plan_id,price_micros,currency,issued_at,expires_at)
 values(id,b,s,repeat('b',64),'hoopcheck.pro','monthly','4990000','USD',clock_timestamp()-interval '2 minutes',clock_timestamp()-interval '1 minute');
 if play_billing_candidate.consume_test_intent(id,b,s,repeat('b',64),'hoopcheck.pro','monthly','4990000','USD') then raise exception 'expired intent accepted'; end if;
 g:=play_billing_candidate.begin_test_refresh(fp,a);
 if play_billing_candidate.commit_test_fulfillment(fp,a,g,future) then raise exception 'unverified fulfillment'; end if;
 if not play_billing_candidate.finish_test_refresh(fp,a,g,'pending_ack',future) then raise exception 'refresh failed'; end if;
 if play_billing_candidate.commit_test_fulfillment(fp,b,g,future) or play_billing_candidate.commit_test_fulfillment(fp,a,g,future+interval '1 second') then raise exception 'invalid receipt'; end if;
 if not play_billing_candidate.commit_test_fulfillment(fp,a,g,future) or not play_billing_candidate.confirm_test_fulfillment(fp,a,g,future) then raise exception 'receipt not durable'; end if;
 if not play_billing_candidate.commit_test_fulfillment(fp,a,g,future) then raise exception 'idempotent commit failed'; end if;
 if (select count(*) from play_billing_candidate.test_fulfillments where fingerprint=fp and generation=g)<>1 then raise exception 'duplicate receipt'; end if;
 perform play_billing_candidate.begin_test_refresh(fp,a);
 if play_billing_candidate.confirm_test_fulfillment(fp,a,g,future) or play_billing_candidate.commit_test_fulfillment(fp,a,g,future) then raise exception 'superseded receipt accepted'; end if;
end $test$;
reset role;
select 'Synthetic purchase intent and fulfillment receipt checks passed' as result;
