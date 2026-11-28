\set ON_ERROR_STOP on
do $test$ begin
 if has_table_privilege('authenticated','play_billing_candidate.notification_jobs','SELECT,INSERT,UPDATE,DELETE') or has_function_privilege('anon','play_billing_candidate.lease_test_notification()','EXECUTE') then raise exception 'client queue access'; end if;
 if has_column_privilege('service_role','play_billing_candidate.notification_jobs','fingerprint','UPDATE') then raise exception 'fingerprint mutable'; end if;
end $test$;
set role service_role;
do $test$
declare sub text:='projects/fixture-project/subscriptions/fixture-play'; fp text:=repeat('a',64); j record; old_lease uuid; n int;
begin
 if play_billing_candidate.enqueue_test_notification(sub,'101',fp)<>'queued' or play_billing_candidate.enqueue_test_notification(sub,'101',fp)<>'duplicate' or play_billing_candidate.enqueue_test_notification(sub,'101',repeat('b',64))<>'conflict' then raise exception 'dedupe failed'; end if;
 select * into j from play_billing_candidate.lease_test_notification();
 if not found or j.fingerprint<>fp then raise exception 'lease failed'; end if;
 old_lease:=j.lease_id;
 if exists(select 1 from play_billing_candidate.lease_test_notification()) then raise exception 'double lease'; end if;
 update play_billing_candidate.notification_jobs set lease_until=clock_timestamp()-interval '1 second' where message_id='101';
 select * into j from play_billing_candidate.lease_test_notification();
 if not found or j.lease_id=old_lease then raise exception 're-lease failed'; end if;
 if play_billing_candidate.finish_test_notification(sub,'101',old_lease,true) then raise exception 'stale lease accepted'; end if;
 if not play_billing_candidate.finish_test_notification(sub,'101',j.lease_id,true) then raise exception 'finish failed'; end if;
 if exists(select 1 from play_billing_candidate.lease_test_notification()) then raise exception 'completed leased again'; end if;
 if play_billing_candidate.enqueue_test_notification(sub,'102',fp)<>'queued' then raise exception 'second enqueue failed'; end if;
 for n in 1..5 loop
  select * into j from play_billing_candidate.lease_test_notification();
  if not found then raise exception 'retry lease missing'; end if;
  if not play_billing_candidate.finish_test_notification(sub,'102',j.lease_id,false) then raise exception 'retry finish failed'; end if;
  update play_billing_candidate.notification_jobs set ready_at=clock_timestamp()-interval '1 second' where message_id='102';
 end loop;
 if not exists(select 1 from play_billing_candidate.notification_jobs where message_id='102' and status='dead' and attempts=5) or exists(select 1 from play_billing_candidate.lease_test_notification()) then raise exception 'retry bound failed'; end if;
end $test$;
reset role;
select 'Synthetic notification queue checks passed' as result;
