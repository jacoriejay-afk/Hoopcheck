-- REVIEW ONLY: no hosted migration or account mutation. Requires the prior
-- ledger, audited fulfillment, cancellation, notices and retention decisions.
-- A separate private schema prevents exposing Auth tables or granting broad
-- service-role SELECT. The only authenticated capability is own request creation.
create schema if not exists hoopcheck_deletion_private;
revoke all on schema hoopcheck_deletion_private from public, anon, authenticated, service_role;
grant usage on schema hoopcheck_deletion_private to authenticated;
create table if not exists hoopcheck_deletion_private.config (
  singleton boolean primary key default true check (singleton),
  request_enabled boolean not null default false
);
insert into hoopcheck_deletion_private.config(singleton) values(true) on conflict do nothing;
revoke all on hoopcheck_deletion_private.config from public, anon, authenticated, service_role;

create or replace function hoopcheck_deletion_private.verify_request_owner()
returns uuid language plpgsql security invoker set search_path='' as $$
declare
  owner_id uuid:=auth.uid();
  claims jsonb:=auth.jwt();
  session_id uuid;
  now_epoch numeric:=extract(epoch from now());
begin
  if not exists(select 1 from hoopcheck_deletion_private.config where singleton and request_enabled) then
    raise exception 'Deletion workflow unavailable' using errcode = '55000';
  end if;
  if owner_id is null or claims->>'sub' is distinct from owner_id::text or claims->>'role' is distinct from 'authenticated'
    or coalesce(claims->>'is_anonymous','false') <> 'false' or claims ? 'client_id'
    or coalesce(claims->>'session_id','') !~ '^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$'
    or coalesce(claims->>'exp','') !~ '^[0-9]{1,12}$'
  then raise exception 'Invalid session' using errcode = '42501'; end if;
  if (claims->>'exp')::numeric <= now_epoch then
    raise exception 'Session expired' using errcode = '42501';
  end if;
  session_id := (claims->>'session_id')::uuid;
  if not exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
    where s.id=session_id and s.user_id=owner_id and (s.not_after is null or s.not_after>now())
      and u.email_confirmed_at is not null and u.role='authenticated') then
    raise exception 'Session no longer active' using errcode = '42501';
  end if;
  if exists(select 1 from auth.mfa_factors f where f.user_id=owner_id and f.status::text='verified')
    and claims->>'aal' is distinct from 'aal2' then
    raise exception 'Authenticator verification required' using errcode = '42501';
  end if;
  if jsonb_typeof(claims->'amr') is distinct from 'array' then
    raise exception 'Fresh authentication required' using errcode = '42501';
  end if;
  if not exists(select 1 from jsonb_array_elements(claims->'amr') e
    where e->>'method' in ('password','oauth')
      and case when coalesce(e->>'timestamp','') ~ '^[0-9]{1,12}$'
          then (e->>'timestamp')::numeric between now_epoch-300 and now_epoch+5 else false end)
  then raise exception 'Fresh authentication required' using errcode = '42501'; end if;
  return owner_id;
end $$;
revoke all on function hoopcheck_deletion_private.verify_request_owner() from public,anon,authenticated,service_role;

create or replace function hoopcheck_deletion_private.record_request(
  p_confirm text, p_mode text
) returns table(request_id uuid, request_status text, requested_at timestamptz, scheduled_for timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  owner_id uuid;
  existing public.account_deletion_requests%rowtype;
  due_at timestamptz;
begin
  if p_confirm is distinct from 'DELETE' or p_mode is null or p_mode not in ('as_soon_as_possible','after_30_days') then
    raise exception 'Invalid deletion request' using errcode = '22023';
  end if;
  owner_id := hoopcheck_deletion_private.verify_request_owner();
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text,17001));
  select r.* into existing from public.account_deletion_requests r
    where r.user_id=owner_id and r.status in ('pending','processing','failed') for update;
  if found then
    -- An explicit immediate-processing request can expedite a scheduled one.
    -- A retry cannot push an existing request into the future.
    if existing.status='pending' and p_mode='as_soon_as_possible' and existing.scheduled_for>now() then
      update public.account_deletion_requests r set scheduled_for=now(),updated_at=now()
        where r.id=existing.id returning r.* into existing;
    end if;
    return query select existing.id,existing.status,existing.requested_at,existing.scheduled_for;
    return;
  end if;
  due_at := case when p_mode='after_30_days' then now()+interval '30 days' else now() end;
  insert into public.account_deletion_requests(user_id,scheduled_for)
    values(owner_id,due_at) returning * into existing;
  return query select existing.id,existing.status,existing.requested_at,existing.scheduled_for;
end;
$$;
revoke all on function hoopcheck_deletion_private.record_request(text,text) from public, anon, authenticated, service_role;
grant execute on function hoopcheck_deletion_private.record_request(text,text) to authenticated;

create or replace function public.record_verified_account_deletion_request(p_confirm text,p_mode text)
returns table(request_id uuid,request_status text,requested_at timestamptz,scheduled_for timestamptz)
language sql security invoker set search_path = ''
as $$ select * from hoopcheck_deletion_private.record_request(p_confirm,p_mode) $$;
revoke all on function public.record_verified_account_deletion_request(text,text) from public, anon, authenticated, service_role;
grant execute on function public.record_verified_account_deletion_request(text,text) to authenticated;
-- The candidate's config remains false. No hosted grants, schema changes,
-- activation, cleanup or deletion is authorized by this file.
-- Cancellation is allowed only before processing is claimed, with the same
-- fresh identity checks and per-owner lock as creation/expediting.
create or replace function hoopcheck_deletion_private.cancel_request(p_request uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare
  owner_id uuid:=hoopcheck_deletion_private.verify_request_owner();
  request_state text;
begin
  if p_request is null then raise exception 'Invalid request' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text,17001));
  select r.status into request_state from public.account_deletion_requests r
    where r.id=p_request and r.user_id=owner_id for update;
  if not found then return false; end if;
  if request_state='cancelled' then return true; end if;
  if request_state<>'pending' then return false; end if;
  update public.account_deletion_requests r set status='cancelled',cancelled_at=now(),updated_at=now()
    where r.id=p_request and r.user_id=owner_id and r.status='pending';
  return found;
end $$;
revoke all on function hoopcheck_deletion_private.cancel_request(uuid) from public,anon,authenticated,service_role;
grant execute on function hoopcheck_deletion_private.cancel_request(uuid) to authenticated;
create or replace function public.cancel_verified_account_deletion_request(p_request uuid)
returns boolean language sql security invoker set search_path='' as $$
 select hoopcheck_deletion_private.cancel_request(p_request)
$$;
revoke all on function public.cancel_verified_account_deletion_request(uuid) from public,anon,authenticated,service_role;
grant execute on function public.cancel_verified_account_deletion_request(uuid) to authenticated;
