\set ON_ERROR_STOP on
-- Disposable fixture only. The service-role auth.sessions grant is a synthetic
-- prerequisite; actual deployment must reconcile privileges separately.
begin;
create schema auth;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create table auth.sessions(id uuid primary key,user_id uuid not null);
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create table public.admin_roles(user_id uuid,role text);
grant usage on schema auth to service_role,authenticated;
grant select on auth.sessions to service_role;
grant select on public.admin_roles to authenticated;
\i supabase/migrations/20261106190000_add_account_deletion_requests.sql
\i supabase/candidates/appstore_deletion_request_only.sql
insert into auth.sessions values
('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
do $$ begin
 if has_function_privilege('anon','public.record_verified_account_deletion_request(uuid,uuid,text)','EXECUTE')
 or has_function_privilege('authenticated','public.record_verified_account_deletion_request(uuid,uuid,text)','EXECUTE')
 or has_table_privilege('authenticated','public.account_deletion_requests','INSERT')
 then raise exception 'Client mutation privileges exposed'; end if;
end $$;
set local role service_role;
do $$
declare a record; b record; c record; denied boolean;
begin
 denied := false;
 begin
 perform public.record_verified_account_deletion_request('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','as_soon_as_possible');
 exception when insufficient_privilege then denied := true; end;
 if not denied then raise exception 'Foreign session accepted'; end if;
 denied := false;
 begin
 perform public.record_verified_account_deletion_request('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333','as_soon_as_possible');
 exception when insufficient_privilege then denied := true; end;
 if not denied then raise exception 'Revoked or missing session accepted'; end if;
 denied := false;
 begin
 perform public.record_verified_account_deletion_request('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','unsafe');
 exception when invalid_parameter_value then denied := true; end;
 if not denied then raise exception 'Invalid mode accepted'; end if;
 select * into a from public.record_verified_account_deletion_request('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','as_soon_as_possible');
 select * into b from public.record_verified_account_deletion_request('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','after_30_days');
 select * into c from public.record_verified_account_deletion_request('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','after_30_days');
 if a.request_id is null or a.request_id is distinct from b.request_id or a.request_status <> 'pending'
 or a.scheduled_for <> a.requested_at or b.scheduled_for <> a.scheduled_for
 or c.request_id is null or c.request_id = a.request_id or c.scheduled_for <> c.requested_at + interval '30 days'
 then raise exception 'Request timing or idempotency failed'; end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
do $$ begin
 if (select count(*) from public.account_deletion_requests) <> 1
 then raise exception 'Foreign request readable'; end if;
end $$;
reset role;
do $$ begin
 if (select count(*) from auth.sessions) <> 2 or (select count(*) from public.account_deletion_requests) <> 2
 then raise exception 'Unexpected destructive change or duplicate request'; end if;
end $$;
rollback;
\echo PASS: isolated deletion request ledger, ACL, session ownership and timing
