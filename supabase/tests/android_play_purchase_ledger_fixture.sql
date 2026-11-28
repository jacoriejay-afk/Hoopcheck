-- Run after candidate schema in disposable PostgreSQL 17. No real tokens.
\set ON_ERROR_STOP on
do $test$
begin
 if has_schema_privilege('anon','play_billing_candidate','USAGE') or has_schema_privilege('authenticated','play_billing_candidate','USAGE') then raise exception 'client schema access'; end if;
 if has_table_privilege('anon','play_billing_candidate.purchase_claims','SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','play_billing_candidate.purchase_claims','SELECT,INSERT,UPDATE,DELETE') then raise exception 'client table access'; end if;
 if has_function_privilege('anon','play_billing_candidate.claim_test_purchase(text,uuid,smallint,text,text,text)','EXECUTE') or has_function_privilege('authenticated','play_billing_candidate.claim_test_purchase(text,uuid,smallint,text,text,text)','EXECUTE') then raise exception 'client claim access'; end if;
 if has_table_privilege('service_role','play_billing_candidate.purchase_claims','UPDATE,DELETE,TRUNCATE') then raise exception 'service can rewrite ownership'; end if;
end
$test$;
set role service_role;
do $test$
declare
 a uuid := '11111111-1111-4111-8111-111111111111';
 b uuid := '22222222-2222-4222-8222-222222222222';
 fp text := repeat('a',64);
 env text := 'v1.'||repeat('A',16)||'.'||repeat('B',22)||'.'||repeat('C',22);
 replacement text := 'v1.'||repeat('D',16)||'.'||repeat('E',22)||'.'||repeat('F',22);
 result text;
begin
 result := play_billing_candidate.claim_test_purchase(fp,a,1::smallint,env,'hoopcheck.pro','monthly');
 if result <> 'claimed' then raise exception 'first claim: %',result; end if;
 result := play_billing_candidate.claim_test_purchase(fp,a,1::smallint,replacement,'hoopcheck.pro','monthly');
 if result <> 'already_claimed' then raise exception 'replay: %',result; end if;
 result := play_billing_candidate.claim_test_purchase(fp,b,1::smallint,replacement,'hoopcheck.pro','monthly');
 if result <> 'foreign_owner' then raise exception 'foreign claim: %',result; end if;
 result := play_billing_candidate.claim_test_purchase(fp,a,1::smallint,replacement,'hoopcheck.premium','monthly');
 if result <> 'catalog_conflict' then raise exception 'catalog conflict: %',result; end if;
 if (select count(*) from play_billing_candidate.purchase_claims) <> 1 then raise exception 'duplicate ledger rows'; end if;
 if not exists(select 1 from play_billing_candidate.purchase_claims where fingerprint=fp and owner_id=a and credential_envelope=env and product_id='hoopcheck.pro' and base_plan_id='monthly') then raise exception 'claim was overwritten'; end if;
 begin
  perform play_billing_candidate.claim_test_purchase(repeat('b',64),a,1::smallint,'plain-credential','hoopcheck.pro','monthly');
  raise exception 'plaintext accepted';
 exception when check_violation then null;
 end;
 begin
  insert into play_billing_candidate.purchase_claims(environment,package_name,fingerprint,owner_id,credential_version,credential_envelope,product_id,base_plan_id) values ('production','online.hoopcheck.app',repeat('c',64),a,1,env,'hoopcheck.pro','monthly');
  raise exception 'production accepted';
 exception when check_violation or insufficient_privilege then null;
 end;
 begin
  update play_billing_candidate.purchase_claims set owner_id=b where fingerprint=fp;
  raise exception 'owner reassignment accepted';
 exception when insufficient_privilege then null;
 end;
 begin
  delete from play_billing_candidate.purchase_claims where fingerprint=fp;
  raise exception 'deletion accepted';
 exception when insufficient_privilege then null;
 end;
end
$test$;
reset role;
set role authenticated;
do $test$ begin
 begin
  perform play_billing_candidate.claim_test_purchase(repeat('d',64),'11111111-1111-4111-8111-111111111111'::uuid,1::smallint,'v1.'||repeat('A',16)||'.'||repeat('B',22)||'.'||repeat('C',22),'hoopcheck.pro','monthly');
  raise exception 'authenticated claim allowed';
 exception when insufficient_privilege then null;
 end;
end $test$;
reset role;
select 'Play candidate ownership and privilege checks passed' as result;
