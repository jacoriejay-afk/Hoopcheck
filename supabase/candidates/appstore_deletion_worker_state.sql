-- REVIEW ONLY. Requires the deletion request ledger and request candidate.
-- Service-only state machine; never schedules or executes destructive effects.
-- The config is false by default. No credentials, email addresses or tokens in receipts.
create table if not exists hoopcheck_deletion_private.worker_config(
  singleton boolean primary key default true check(singleton),
  worker_enabled boolean not null default false,
  policy_version text
);
insert into hoopcheck_deletion_private.worker_config(singleton) values(true) on conflict do nothing;
revoke all on hoopcheck_deletion_private.worker_config from public,anon,authenticated,service_role;
grant select on hoopcheck_deletion_private.worker_config to service_role;

create table if not exists hoopcheck_deletion_private.worker_state(
  request_id uuid primary key references public.account_deletion_requests(id) on delete restrict,
  policy_version text not null check(length(policy_version) between 1 and 100),
  approved_at timestamptz not null default now(),
  fence uuid,
  lease_until timestamptz,
  next_step integer not null default 1 check(next_step between 1 and 13),
  retry_after timestamptz not null default now(),
  failure_code text check(failure_code in ('step_not_confirmed','invalid_checkpoint')),
  check((fence is null)=(lease_until is null))
);
create table if not exists hoopcheck_deletion_private.worker_receipts(
  request_id uuid not null references hoopcheck_deletion_private.worker_state(request_id) on delete restrict,
  step_number integer not null check(step_number between 1 and 12),
  receipt text not null check(receipt ~ '^[A-Za-z0-9_-]{1,128}$'),
  confirmed_at timestamptz not null default now(),
  primary key(request_id,step_number)
);
alter table hoopcheck_deletion_private.worker_config enable row level security;
alter table hoopcheck_deletion_private.worker_state enable row level security;
alter table hoopcheck_deletion_private.worker_receipts enable row level security;
revoke all on hoopcheck_deletion_private.worker_state,hoopcheck_deletion_private.worker_receipts from public,anon,authenticated,service_role;
grant usage on schema hoopcheck_deletion_private to service_role;
grant select,update on hoopcheck_deletion_private.worker_state to service_role;
grant select,insert on hoopcheck_deletion_private.worker_receipts to service_role;
-- Per-request scope approval is a separate reviewed operator action; the worker
-- cannot insert approvals or change configuration. All state changes use service RPCs.
create or replace function hoopcheck_deletion_private.step_names()
returns text[] language sql immutable security invoker set search_path='' as $$
select array['approve_scope','capture_completion_contact','freeze_account_writes','revoke_sessions',
'preserve_lawful_billing_records','revoke_apple_authorizations','remove_user_media',
'remove_or_anonymize_user_data','delete_auth_identity','verify_erasure','notify_completion','remove_completion_contact']::text[]
$$;
revoke all on function hoopcheck_deletion_private.step_names() from public,anon,authenticated,service_role;
grant execute on function hoopcheck_deletion_private.step_names() to service_role;

create or replace function public.claim_account_deletion_worker()
returns table(request_id uuid,owner_id uuid,fence uuid,policy_version text,completed text[])
language plpgsql security invoker set search_path='' as $$
declare rid uuid; owner uuid; f uuid; version text; pos integer;
begin
  if not exists(select 1 from hoopcheck_deletion_private.worker_config c where c.singleton and c.worker_enabled and c.policy_version is not null) then return; end if;
  select r.id,r.user_id,w.policy_version,w.next_step into rid,owner,version,pos
  from public.account_deletion_requests r
  join hoopcheck_deletion_private.worker_state w on w.request_id=r.id
  join hoopcheck_deletion_private.worker_config c on c.singleton and c.worker_enabled and c.policy_version=w.policy_version
  where r.status in ('pending','processing','failed') and r.scheduled_for<=now()
    and w.retry_after<=now() and (w.lease_until is null or w.lease_until<=now())
  order by r.scheduled_for,r.id
  limit 1 for update of r,w skip locked;
  if not found then return; end if;
  f:=gen_random_uuid();
  update hoopcheck_deletion_private.worker_state w set fence=f,lease_until=now()+interval '5 minutes',failure_code=null where w.request_id=rid;
  update public.account_deletion_requests r set status='processing',updated_at=now() where r.id=rid;
  return query select rid,owner,f,version,coalesce((hoopcheck_deletion_private.step_names())[1:pos-1],array[]::text[]);
end $$;
revoke all on function public.claim_account_deletion_worker() from public,anon,authenticated,service_role;
grant execute on function public.claim_account_deletion_worker() to service_role;

create or replace function public.assert_account_deletion_worker(p_request uuid,p_owner uuid,p_fence uuid)
returns boolean language sql security invoker set search_path='' as $$
select exists(select 1 from hoopcheck_deletion_private.worker_state w join public.account_deletion_requests r on r.id=w.request_id
 join hoopcheck_deletion_private.worker_config c on c.singleton and c.worker_enabled and c.policy_version=w.policy_version
 where w.request_id=p_request and r.user_id=p_owner and r.status='processing' and w.fence=p_fence and w.lease_until>now())
$$;
revoke all on function public.assert_account_deletion_worker(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.assert_account_deletion_worker(uuid,uuid,uuid) to service_role;

create or replace function public.checkpoint_account_deletion_worker(p_request uuid,p_owner uuid,p_fence uuid,p_step text,p_receipt text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare pos integer; expected_step integer;
begin
  expected_step:=array_position(hoopcheck_deletion_private.step_names(),p_step);
  if expected_step is null or p_receipt is null or p_receipt !~ '^[A-Za-z0-9_-]{1,128}$' then return false; end if;
  select w.next_step into pos from hoopcheck_deletion_private.worker_state w
    join public.account_deletion_requests r on r.id=w.request_id
    where w.request_id=p_request and r.user_id=p_owner and r.status='processing' and w.fence=p_fence and w.lease_until>now()
    for update of r,w;
  if not found or not public.assert_account_deletion_worker(p_request,p_owner,p_fence) then return false; end if;
  if expected_step<pos then
    return exists(select 1 from hoopcheck_deletion_private.worker_receipts v where v.request_id=p_request and v.step_number=expected_step and v.receipt=p_receipt);
  end if;
  if expected_step<>pos then return false; end if;
  insert into hoopcheck_deletion_private.worker_receipts(request_id,step_number,receipt) values(p_request,pos,p_receipt);
  update hoopcheck_deletion_private.worker_state w set next_step=pos+1,lease_until=now()+interval '5 minutes' where w.request_id=p_request;
  return true;
end $$;
revoke all on function public.checkpoint_account_deletion_worker(uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.checkpoint_account_deletion_worker(uuid,uuid,uuid,text,text) to service_role;

create or replace function public.complete_account_deletion_worker(p_request uuid,p_owner uuid,p_fence uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
declare pos integer;
begin
  select w.next_step into pos from hoopcheck_deletion_private.worker_state w join public.account_deletion_requests r on r.id=w.request_id
    where w.request_id=p_request and r.user_id=p_owner and r.status='processing' and w.fence=p_fence and w.lease_until>now()
    for update of r,w;
  if not found or pos<>13 or not public.assert_account_deletion_worker(p_request,p_owner,p_fence) then return false; end if;
  if (select count(*) from hoopcheck_deletion_private.worker_receipts where request_id=p_request)<>12 then return false; end if;
  update public.account_deletion_requests r set status='completed',completed_at=now(),updated_at=now() where r.id=p_request;
  update hoopcheck_deletion_private.worker_state w set fence=null,lease_until=null where w.request_id=p_request;
  return true;
end $$;
revoke all on function public.complete_account_deletion_worker(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.complete_account_deletion_worker(uuid,uuid,uuid) to service_role;

create or replace function public.fail_account_deletion_worker(p_request uuid,p_owner uuid,p_fence uuid,p_code text)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  if p_code is null or p_code not in ('step_not_confirmed','invalid_checkpoint') then return false; end if;
  perform 1 from hoopcheck_deletion_private.worker_state w join public.account_deletion_requests r on r.id=w.request_id
    where w.request_id=p_request and r.user_id=p_owner and r.status='processing' and w.fence=p_fence and w.lease_until>now()
    for update of r,w;
  if not found or not public.assert_account_deletion_worker(p_request,p_owner,p_fence) then return false; end if;
  update public.account_deletion_requests r set status='failed',updated_at=now() where r.id=p_request;
  update hoopcheck_deletion_private.worker_state w set fence=null,lease_until=null,retry_after=now()+interval '15 minutes',failure_code=p_code where w.request_id=p_request;
  return true;
end $$;
revoke all on function public.fail_account_deletion_worker(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.fail_account_deletion_worker(uuid,uuid,uuid,text) to service_role;
-- No cron/scheduler. No actual account cleanup. Before approval, review the
-- receipt/ledger retention policy, service-role trust boundary and all effect adapters.
