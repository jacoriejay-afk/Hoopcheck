\set ON_ERROR_STOP on
do $test$ begin
 if has_table_privilege('authenticated','play_billing_candidate.shadow_membership_entitlements','SELECT') or has_table_privilege('anon','play_billing_candidate.shadow_membership_authorizations','SELECT') then raise exception 'test entitlement client exposure'; end if;
end $test$;
set role service_role;
do $test$
declare
 a uuid:='11111111-1111-4111-8111-111111111111';
 b uuid:='22222222-2222-4222-8222-222222222222';
 d uuid:='55555555-5555-4555-8555-555555555555';
 fp text:=repeat('f',64); fp2 text:=repeat('9',64);
 envelope text:='v1.'||repeat('A',16)||'.'||repeat('B',22)||'.'||repeat('C',22);
 future timestamptz:=now()+interval '10 days'; g bigint; g2 bigint;
begin
 if (select provider from play_billing_candidate.shadow_membership_entitlements where user_id=a)<>'stripe' then raise exception 'existing premium masked'; end if;
 if (select provider from play_billing_candidate.shadow_membership_entitlements where user_id=b)<>'manual' or (select provider from play_billing_candidate.shadow_membership_authorizations where user_id=b)<>'apple' then raise exception 'legacy authorization difference lost'; end if;
 if play_billing_candidate.claim_test_purchase(fp,a,1::smallint,envelope,'hoopcheck.pro','monthly')<>'claimed' then raise exception 'test claim failed'; end if;
 g:=play_billing_candidate.begin_test_refresh(fp,a);
 if not play_billing_candidate.finish_test_refresh(fp,a,g,'pending_ack',future) or not play_billing_candidate.commit_test_fulfillment(fp,a,g,future) then raise exception 'pending setup failed'; end if;
 if exists(select 1 from play_billing_candidate.shadow_play_sources where source_id=fp) then raise exception 'pending acknowledgment granted'; end if;
 g:=play_billing_candidate.begin_test_refresh(fp,a);
 if not play_billing_candidate.finish_test_refresh(fp,a,g,'eligible_for_reconciliation',future) or not play_billing_candidate.commit_test_fulfillment(fp,a,g,future) then raise exception 'acknowledged setup failed'; end if;
 if not exists(select 1 from play_billing_candidate.shadow_play_sources where source_id=fp) then raise exception 'test source missing'; end if;
 if (select provider from play_billing_candidate.shadow_membership_entitlements where user_id=a)<>'stripe' then raise exception 'Play Pro displaced Stripe Premium'; end if;
 if play_billing_candidate.claim_test_purchase(fp2,d,1::smallint,envelope,'hoopcheck.premium','annual')<>'claimed' then raise exception 'second claim failed'; end if;
 g2:=play_billing_candidate.begin_test_refresh(fp2,d);
 if not play_billing_candidate.finish_test_refresh(fp2,d,g2,'eligible_for_reconciliation',future) then raise exception 'second refresh failed'; end if;
 if exists(select 1 from play_billing_candidate.shadow_membership_entitlements where user_id=d) then raise exception 'unfulfilled test purchase granted'; end if;
 if not play_billing_candidate.commit_test_fulfillment(fp2,d,g2,future) then raise exception 'receipt missing'; end if;
 if not exists(select 1 from play_billing_candidate.shadow_membership_entitlements where user_id=d and provider='google_play_test' and plan='premium' and billing_interval='year') then raise exception 'fulfilled test premium missing'; end if;
 if exists(select 1 from public.membership_sources where user_id=d) then raise exception 'test source leaked into public membership'; end if;
 -- New refresh, expiry or stale evidence must not appear in the shadow.
 perform play_billing_candidate.begin_test_refresh(fp2,d);
 if exists(select 1 from play_billing_candidate.shadow_membership_entitlements where user_id=d) then raise exception 'superseded test access'; end if;
 update play_billing_candidate.purchase_observations set checked_at=now()-interval '31 minutes' where fingerprint=fp;
 if exists(select 1 from play_billing_candidate.shadow_play_sources where source_id=fp) then raise exception 'stale source eligible'; end if;
 if (select provider from play_billing_candidate.shadow_membership_authorizations where user_id=a)<>'stripe' then raise exception 'valid Stripe fallback lost'; end if;
end $test$;
reset role;
select 'Private shadow membership resolution checks passed' as result;
