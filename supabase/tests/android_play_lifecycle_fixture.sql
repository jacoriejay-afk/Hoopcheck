\set ON_ERROR_STOP on
do $test$
begin
 if has_function_privilege('authenticated','play_billing_candidate.finish_test_refresh(text,uuid,bigint,text,timestamptz)','EXECUTE') or has_function_privilege('anon','play_billing_candidate.read_test_observation(text,uuid)','EXECUTE') then raise exception 'client lifecycle access'; end if;
 if has_column_privilege('service_role','play_billing_candidate.purchase_observations','fingerprint','UPDATE') or has_table_privilege('service_role','play_billing_candidate.purchase_observations','DELETE,TRUNCATE') then raise exception 'lifecycle ownership mutable'; end if;
end $test$;
set role service_role;
do $test$
declare
 a uuid:='11111111-1111-4111-8111-111111111111'; b uuid:='22222222-2222-4222-8222-222222222222';
 fp text:=repeat('a',64);
 g1 bigint; g2 bigint; g3 bigint; g4 bigint;
 future timestamptz:=clock_timestamp()+interval '1 day';
begin
 if play_billing_candidate.read_test_observation(fp,a)<>'unavailable' then raise exception 'missing observation'; end if;
 if play_billing_candidate.begin_test_refresh(fp,b) is not null then raise exception 'foreign refresh'; end if;
 g1:=play_billing_candidate.begin_test_refresh(fp,a);
 g2:=play_billing_candidate.begin_test_refresh(fp,a);
 if g1<>1 or g2<>2 then raise exception 'generation mismatch'; end if;
 if play_billing_candidate.finish_test_refresh(fp,a,g1,'eligible_for_reconciliation',future) then raise exception 'stale generation accepted'; end if;
 if play_billing_candidate.finish_test_refresh(fp,b,g2,'eligible_for_reconciliation',future) then raise exception 'foreign observation'; end if;
 if play_billing_candidate.finish_test_refresh(fp,a,g2,'eligible_for_reconciliation',clock_timestamp()-interval '1 day') then raise exception 'expired observation accepted'; end if;
 if play_billing_candidate.finish_test_refresh(fp,a,g2,'eligible_for_reconciliation','infinity'::timestamptz) then raise exception 'infinite expiry accepted'; end if;
 if not play_billing_candidate.finish_test_refresh(fp,a,g2,'pending_ack',future) then raise exception 'pending result rejected'; end if;
 if play_billing_candidate.read_test_observation(fp,a)<>'pending_ack' then raise exception 'pending result changed'; end if;
 if play_billing_candidate.finish_test_refresh(fp,a,g2,'eligible_for_reconciliation',future) then raise exception 'duplicate completion accepted'; end if;
 g3:=play_billing_candidate.begin_test_refresh(fp,a);
 if play_billing_candidate.read_test_observation(fp,a)<>'unavailable' then raise exception 'in-flight observation accepted'; end if;
 if not play_billing_candidate.finish_test_refresh(fp,a,g3,'eligible_for_reconciliation',future) then raise exception 'valid observation rejected'; end if;
 if play_billing_candidate.read_test_observation(fp,a)<>'eligible_for_reconciliation' or play_billing_candidate.read_test_observation(fp,b)<>'unavailable' then raise exception 'owner projection invalid'; end if;
 -- Simulate aging with synthetic fixture-only privileged timestamps.
 update play_billing_candidate.purchase_observations set checked_at=clock_timestamp()-interval '31 minutes' where fingerprint=fp;
 if play_billing_candidate.read_test_observation(fp,a)<>'unavailable' then raise exception 'stale evidence accepted'; end if;
 g4:=play_billing_candidate.begin_test_refresh(fp,a);
 update play_billing_candidate.purchase_observations set started_at=clock_timestamp()-interval '61 seconds' where fingerprint=fp;
 if play_billing_candidate.finish_test_refresh(fp,a,g4,'eligible_for_reconciliation',future) then raise exception 'expired lease accepted'; end if;
 g4:=play_billing_candidate.begin_test_refresh(fp,a);
 if not play_billing_candidate.finish_test_refresh(fp,a,g4,'inactive',null) then raise exception 'inactive result rejected'; end if;
 if play_billing_candidate.read_test_observation(fp,a)<>'inactive' then raise exception 'inactive result incorrect'; end if;
end $test$;
reset role;
select 'Play candidate lifecycle fencing and freshness checks passed' as result;
