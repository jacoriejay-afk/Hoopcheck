\set ON_ERROR_STOP on
-- Disposable local PostgreSQL, never hosted.
begin;
create schema auth;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create table public.admin_roles(user_id uuid,role text);
grant usage on schema auth to authenticated;
grant select on public.admin_roles to authenticated;
\i supabase/migrations/20261106190000_add_account_deletion_requests.sql
create schema hoopcheck_deletion_private;
\i supabase/candidates/appstore_deletion_worker_state.sql
insert into public.account_deletion_requests(id,user_id,scheduled_for) values
('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now()-interval '1 hour'),
('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',now()+interval '1 day'),
('33333333-3333-4333-8333-333333333333','cccccccc-cccc-4ccc-8ccc-cccccccccccc',now()-interval '2 hours');
insert into hoopcheck_deletion_private.worker_state(request_id,policy_version) values
('11111111-1111-4111-8111-111111111111','fixture-v1'),
('22222222-2222-4222-8222-222222222222','fixture-v1');
do $$ begin
 if has_function_privilege('authenticated','public.claim_account_deletion_worker()','EXECUTE')
 or has_function_privilege('anon','public.complete_account_deletion_worker(uuid,uuid,uuid)','EXECUTE')
 or has_table_privilege('service_role','hoopcheck_deletion_private.worker_config','UPDATE')
 or has_table_privilege('service_role','hoopcheck_deletion_private.worker_state','INSERT')
 then raise exception 'Unexpected worker permissions'; end if;
end $$;
set local role service_role;
do $$ begin
 if exists(select 1 from public.claim_account_deletion_worker()) then raise exception 'Disabled worker claimed request'; end if;
end $$;
reset role;
update hoopcheck_deletion_private.worker_config set worker_enabled=true,policy_version='fixture-v1';
set local role service_role;
do $$ declare l record; begin
 select * into l from public.claim_account_deletion_worker();
 if l.request_id is distinct from '11111111-1111-4111-8111-111111111111'::uuid or cardinality(l.completed)<>0 then raise exception 'Wrong request claimed'; end if;
 if exists(select 1 from public.claim_account_deletion_worker()) then raise exception 'Duplicate or premature claim'; end if;
 if public.complete_account_deletion_worker(l.request_id,l.owner_id,l.fence) then raise exception 'Premature completion'; end if;
 if public.checkpoint_account_deletion_worker(l.request_id,l.owner_id,l.fence,'delete_auth_identity','bad') then raise exception 'Out-of-order checkpoint accepted'; end if;
 if public.checkpoint_account_deletion_worker(l.request_id,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',l.fence,'approve_scope','bad') then raise exception 'Wrong owner accepted'; end if;
 if not public.checkpoint_account_deletion_worker(l.request_id,l.owner_id,l.fence,'approve_scope','fixture-1')
 or not public.checkpoint_account_deletion_worker(l.request_id,l.owner_id,l.fence,'approve_scope','fixture-1') then raise exception 'Checkpoint failed or replay not idempotent'; end if;
 if public.checkpoint_account_deletion_worker(l.request_id,l.owner_id,l.fence,'approve_scope','different') then raise exception 'Receipt overwrite accepted'; end if;
 perform set_config('fixture.old_fence',l.fence::text,true);
 if not public.fail_account_deletion_worker(l.request_id,l.owner_id,l.fence,'step_not_confirmed') then raise exception 'Retry state not recorded'; end if;
 if exists(select 1 from public.claim_account_deletion_worker()) then raise exception 'Backoff ignored'; end if;
end $$;
reset role;
update hoopcheck_deletion_private.worker_state set retry_after=now()-interval '1 second' where request_id='11111111-1111-4111-8111-111111111111';
set local role service_role;
do $$ declare l record; s text; n integer:=1; begin
 select * into l from public.claim_account_deletion_worker();
 if l.request_id is null or l.completed is distinct from array['approve_scope']::text[] or l.fence=current_setting('fixture.old_fence')::uuid then raise exception 'Retry checkpoint/fence invalid'; end if;
 if public.assert_account_deletion_worker(l.request_id,l.owner_id,current_setting('fixture.old_fence')::uuid) then raise exception 'Old fence valid'; end if;
 foreach s in array (hoopcheck_deletion_private.step_names())[2:12] loop
  n:=n+1;
  if not public.checkpoint_account_deletion_worker(l.request_id,l.owner_id,l.fence,s,'fixture-'||n) then raise exception 'Step not acknowledged: %',s; end if;
 end loop;
 if not public.complete_account_deletion_worker(l.request_id,l.owner_id,l.fence) then raise exception 'Completion not acknowledged'; end if;
 if exists(select 1 from public.claim_account_deletion_worker()) then raise exception 'Completed or unapproved request reclaimed'; end if;
end $$;
reset role;
do $$ begin
 if (select count(*) from hoopcheck_deletion_private.worker_receipts)<>12
 or not exists(select 1 from public.account_deletion_requests where id='11111111-1111-4111-8111-111111111111' and status='completed' and completed_at is not null)
 or (select count(*) from public.account_deletion_requests where status='pending')<>2
 then raise exception 'Unexpected final state'; end if;
end $$;
rollback;
\echo PASS: disabled gate, scope approval, due date, fencing, ordering, idempotency, backoff and completion
