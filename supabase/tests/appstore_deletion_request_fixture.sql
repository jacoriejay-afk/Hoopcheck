\set ON_ERROR_STOP on
-- Disposable fixture only; no credentials or hosted database.
begin;
create schema auth;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create table auth.users(id uuid primary key,email_confirmed_at timestamptz,role text);
create table auth.sessions(id uuid primary key,user_id uuid not null,not_after timestamptz);
create table auth.mfa_factors(user_id uuid,status text);
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create function auth.jwt() returns jsonb language sql stable as $$
 select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb
$$;
create table public.admin_roles(user_id uuid,role text);
grant usage on schema auth to authenticated,service_role;
grant select on public.admin_roles to authenticated;
\i supabase/migrations/20261106190000_add_account_deletion_requests.sql
\i supabase/candidates/appstore_deletion_request_only.sql
insert into auth.users values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now(),'authenticated'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',now(),'authenticated');
insert into auth.sessions values
('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null),
('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',null),
('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now()-interval '1 day');
insert into auth.mfa_factors values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','verified');
do $$ begin
 if has_function_privilege('anon','public.record_verified_account_deletion_request(text,text)','EXECUTE')
 or has_function_privilege('service_role','public.record_verified_account_deletion_request(text,text)','EXECUTE')
 or has_table_privilege('authenticated','public.account_deletion_requests','INSERT')
 or has_table_privilege('authenticated','auth.sessions','SELECT')
 or has_table_privilege('service_role','auth.sessions','SELECT')
 or has_table_privilege('authenticated','hoopcheck_deletion_private.config','UPDATE')
 then raise exception 'Unexpected broad mutation or Auth access'; end if;
end $$;
select set_config('fixture.a',jsonb_build_object(
 'sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','role','authenticated',
 'session_id','11111111-1111-4111-8111-111111111111','aal','aal1',
 'exp',extract(epoch from now())::bigint+600,'amr',jsonb_build_array(jsonb_build_object('method','oauth','timestamp',extract(epoch from now())::bigint)))::text,true);
select set_config('fixture.b',(current_setting('fixture.a')::jsonb || '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","session_id":"22222222-2222-4222-8222-222222222222"}')::text,true);
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select set_config('request.jwt.claims',current_setting('fixture.a'),true);
do $$ begin
 begin
 perform public.record_verified_account_deletion_request('DELETE','as_soon_as_possible');
 raise exception 'Disabled config allowed request';
 exception when object_not_in_prerequisite_state then null; end;
end $$;
reset role;
update hoopcheck_deletion_private.config set request_enabled=true;
set local role authenticated;
do $$
declare a record; b record; c record; bad jsonb; valid jsonb:=current_setting('fixture.a')::jsonb;
begin
 foreach bad in array array[
   valid || '{"session_id":"22222222-2222-4222-8222-222222222222"}',
   valid || '{"session_id":"33333333-3333-4333-8333-333333333333"}',
   valid || '{"session_id":"44444444-4444-4444-8444-444444444444"}',
   valid || '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}',
   valid || '{"role":"hoopcheck_pending_signup"}',
   valid || '{"amr":[{"method":"token_refresh","timestamp":1}]}',
   valid || '{"client_id":"oauth-client"}',
   valid || '{"exp":1}'
 ] loop
  perform set_config('request.jwt.claims',bad::text,true);
  begin
   perform public.record_verified_account_deletion_request('DELETE','as_soon_as_possible');
   raise exception 'Invalid signed claim accepted';
  exception when insufficient_privilege then null; end;
 end loop;
 perform set_config('request.jwt.claims',valid::text,true);
 select * into a from public.record_verified_account_deletion_request('DELETE','after_30_days');
 select * into b from public.record_verified_account_deletion_request('DELETE','as_soon_as_possible');
 select * into c from public.record_verified_account_deletion_request('DELETE','after_30_days');
 if a.request_id is null or a.request_id is distinct from b.request_id or b.request_id is distinct from c.request_id
 or a.scheduled_for <> a.requested_at+interval '30 days' or b.scheduled_for<>b.requested_at or c.scheduled_for<>b.scheduled_for
 then raise exception 'Request timing, expedite or idempotency failed'; end if;
 perform set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
 perform set_config('request.jwt.claims',current_setting('fixture.b'),true);
 begin
  perform public.record_verified_account_deletion_request('DELETE','as_soon_as_possible');
  raise exception 'MFA bypass';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claims',(current_setting('fixture.b')::jsonb || '{"aal":"aal2"}')::text,true);
 select * into c from public.record_verified_account_deletion_request('DELETE','as_soon_as_possible');
 if c.request_id is null or c.request_id=a.request_id then raise exception 'Wrong request identity'; end if;
 if (select count(*) from public.account_deletion_requests)<>1 then raise exception 'Foreign request readable'; end if;
end $$;
reset role;
do $$ begin
 if (select count(*) from auth.sessions)<>3 or (select count(*) from auth.users)<>2 or (select count(*) from public.account_deletion_requests)<>2
 then raise exception 'Unexpected destructive change or duplicate request'; end if;
end $$;
rollback;
\echo PASS: disabled gate, restricted Auth ACL, verified owner/session/MFA, expiry, timing and idempotency
