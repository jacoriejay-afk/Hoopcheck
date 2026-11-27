\set ON_ERROR_STOP on
begin;
create schema auth;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create table auth.users(id uuid primary key,email_confirmed_at timestamptz,role text);
create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
create table auth.identities(user_id uuid,provider text,provider_id text);
create table public.admin_roles(user_id uuid,role text);
grant usage on schema auth to authenticated;
grant select on public.admin_roles to authenticated;
\i supabase/migrations/20261106190000_add_account_deletion_requests.sql
create schema hoopcheck_deletion_private;
\i supabase/candidates/appstore_deletion_worker_state.sql
\i .compliance-apple/supabase/candidates/appstore_apple_authorization_vault.sql
\i supabase/candidates/appstore_deletion_apple_revocations.sql
insert into auth.users values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now(),'authenticated'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',now(),'authenticated');
insert into auth.identities values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','apple','apple-a'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','apple','apple-b');
insert into auth.sessions values ('44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null);
insert into hoopcheck_apple_private.authorization_vault(owner_id,apple_subject,encrypted_refresh_token) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','apple-a','v1.fixtureIV.fixtureTag.fixtureCiphertext'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','apple-b','v1.otherIV.otherTag.otherCiphertext');
insert into public.account_deletion_requests(id,user_id,scheduled_for,status) values
('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now(),'processing');
update hoopcheck_deletion_private.worker_config set worker_enabled=true,policy_version='fixture-v1';
insert into hoopcheck_deletion_private.worker_state(request_id,policy_version,fence,lease_until,next_step) values
('11111111-1111-4111-8111-111111111111','fixture-v1','33333333-3333-4333-8333-333333333333',now()+interval '5 minutes',6);
insert into hoopcheck_deletion_private.worker_receipts(request_id,step_number,receipt) select '11111111-1111-4111-8111-111111111111',n,'fixture-'||n from generate_series(1,5)n;
do $$ begin
 if has_function_privilege('authenticated','public.list_account_deletion_apple_revocations(uuid,uuid,uuid)','EXECUTE')
 or has_function_privilege('anon','public.ack_account_deletion_apple_revocation(uuid,uuid,uuid,text,text)','EXECUTE')
 or has_table_privilege('service_role','hoopcheck_apple_private.authorization_vault','SELECT')
 or has_table_privilege('service_role','hoopcheck_deletion_private.apple_revocation_receipts','INSERT')
 then raise exception 'Unexpected credential privileges'; end if;
end $$;
set local role service_role;
do $$ begin
 begin perform public.list_account_deletion_apple_revocations('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333');
 raise exception 'Active session accepted'; exception when object_not_in_prerequisite_state then null; end;
end $$;
reset role;
delete from auth.sessions where user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set local role service_role;
do $$
declare rid uuid:='11111111-1111-4111-8111-111111111111'; own uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; f uuid:='33333333-3333-4333-8333-333333333333'; a record;
begin
 begin perform public.list_account_deletion_apple_revocations(rid,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',f); raise exception 'Wrong owner accepted'; exception when insufficient_privilege then null; end;
 begin perform public.list_account_deletion_apple_revocations(rid,own,'55555555-5555-4555-8555-555555555555'); raise exception 'Wrong fence accepted'; exception when insufficient_privilege then null; end;
 select * into a from public.list_account_deletion_apple_revocations(rid,own,f);
 if a.apple_subject is distinct from 'apple-a' or a.envelope is distinct from 'v1.fixtureIV.fixtureTag.fixtureCiphertext' then raise exception 'Wrong vault scope'; end if;
 if public.ack_account_deletion_apple_revocation(rid,own,f,'apple-b',a.envelope_digest)
 or public.ack_account_deletion_apple_revocation(rid,own,f,'apple-a',repeat('0',64)) then raise exception 'Unmatched acknowledgement accepted'; end if;
 if not public.ack_account_deletion_apple_revocation(rid,own,f,'apple-a',a.envelope_digest)
 or not public.ack_account_deletion_apple_revocation(rid,own,f,'apple-a',a.envelope_digest) then raise exception 'Retry not idempotent'; end if;
 if exists(select 1 from public.list_account_deletion_apple_revocations(rid,own,f)) then raise exception 'Apple credential remains'; end if;
end $$;
reset role;
do $$ begin
 if (select count(*) from hoopcheck_apple_private.authorization_vault)<>1 or not exists(select 1 from hoopcheck_apple_private.authorization_vault where apple_subject='apple-b')
 or (select count(*) from hoopcheck_deletion_private.apple_revocation_receipts)<>1 then raise exception 'Unexpected cross-account change'; end if;
end $$;
insert into auth.identities values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','apple','missing-credential');
set local role service_role;
do $$ begin
 begin perform public.list_account_deletion_apple_revocations('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333');
 raise exception 'Missing credential falsely acknowledged'; exception when object_not_in_prerequisite_state then null; end;
end $$;
reset role;
rollback;
\echo PASS: exact revocation scope, no active sessions, stale acknowledgement denial, retry and missing-credential protection
