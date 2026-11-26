-- REVIEW ONLY. Apply after the Apple vault and deletion worker candidates in a
-- disposable database. No provider calls and no scheduler are installed here.
-- Actual freeze and session revocation must be enforced by the approved worker.
create table if not exists hoopcheck_deletion_private.apple_revocation_receipts(
  request_id uuid not null references public.account_deletion_requests(id) on delete restrict,
  apple_subject text not null check(length(apple_subject) between 1 and 255),
  envelope_digest text not null check(envelope_digest ~ '^[a-f0-9]{64}$'),
  acknowledged_at timestamptz not null default now(),
  primary key(request_id,apple_subject)
);
alter table hoopcheck_deletion_private.apple_revocation_receipts enable row level security;
revoke all on hoopcheck_deletion_private.apple_revocation_receipts from public,anon,authenticated,service_role;

create or replace function hoopcheck_deletion_private.assert_apple_revocation_step(p_request uuid,p_owner uuid,p_fence uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if not public.assert_account_deletion_worker(p_request,p_owner,p_fence)
    or not exists(select 1 from hoopcheck_deletion_private.worker_state w where w.request_id=p_request and w.next_step=6)
    or (select count(*) from hoopcheck_deletion_private.worker_receipts r where r.request_id=p_request and r.step_number between 1 and 5)<>5
  then raise exception 'Invalid deletion revocation lease' using errcode='42501'; end if;
  if exists(select 1 from auth.sessions s where s.user_id=p_owner and (s.not_after is null or s.not_after>now()))
  then raise exception 'Account sessions are still active' using errcode='55000'; end if;
end $$;
revoke all on function hoopcheck_deletion_private.assert_apple_revocation_step(uuid,uuid,uuid) from public,anon,authenticated,service_role;

-- Narrow service-only private definer: the worker receives only the exact
-- approved owner's encrypted credentials, never access to the underlying table.
create or replace function hoopcheck_deletion_private.list_apple_revocations(p_request uuid,p_owner uuid,p_fence uuid)
returns table(apple_subject text,envelope text,envelope_digest text)
language plpgsql security definer set search_path='' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text,17001));
  perform hoopcheck_deletion_private.assert_apple_revocation_step(p_request,p_owner,p_fence);
  -- Missing credential is not proof of revocation. A prior acknowledged
  -- receipt is required for every current Apple identity with no vault row.
  if exists(select 1 from auth.identities i where i.user_id=p_owner and i.provider='apple'
    and not exists(select 1 from hoopcheck_apple_private.authorization_vault v where v.owner_id=p_owner and v.apple_subject=i.provider_id)
    and not exists(select 1 from hoopcheck_deletion_private.apple_revocation_receipts a where a.request_id=p_request and a.apple_subject=i.provider_id))
  then raise exception 'Apple authorization missing; reconciliation required' using errcode='55000'; end if;
  return query select v.apple_subject,v.encrypted_refresh_token,
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(v.encrypted_refresh_token,'UTF8')),'hex')
    from hoopcheck_apple_private.authorization_vault v where v.owner_id=p_owner order by v.apple_subject;
end $$;
revoke all on function hoopcheck_deletion_private.list_apple_revocations(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function hoopcheck_deletion_private.list_apple_revocations(uuid,uuid,uuid) to service_role;
create or replace function public.list_account_deletion_apple_revocations(p_request uuid,p_owner uuid,p_fence uuid)
returns table(apple_subject text,envelope text,envelope_digest text)
language sql security invoker set search_path='' as $$
select * from hoopcheck_deletion_private.list_apple_revocations(p_request,p_owner,p_fence)
$$;
revoke all on function public.list_account_deletion_apple_revocations(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.list_account_deletion_apple_revocations(uuid,uuid,uuid) to service_role;

-- Call only after Apple /auth/revoke returns 200. Compare the current encrypted
-- envelope's digest; a stale acknowledgment cannot remove a replacement.
create or replace function hoopcheck_deletion_private.ack_apple_revocation(p_request uuid,p_owner uuid,p_fence uuid,p_subject text,p_digest text)
returns boolean language plpgsql security definer set search_path='' as $$
declare current_digest text;
begin
  if p_subject is null or length(p_subject) not between 1 and 255 or p_digest is null or p_digest !~ '^[a-f0-9]{64}$' then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text,17001));
  perform hoopcheck_deletion_private.assert_apple_revocation_step(p_request,p_owner,p_fence);
  select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(v.encrypted_refresh_token,'UTF8')),'hex') into current_digest
    from hoopcheck_apple_private.authorization_vault v where v.owner_id=p_owner and v.apple_subject=p_subject for update;
  if not found then
    return exists(select 1 from hoopcheck_deletion_private.apple_revocation_receipts a where a.request_id=p_request and a.apple_subject=p_subject and a.envelope_digest=p_digest);
  end if;
  if current_digest is distinct from p_digest then return false; end if;
  insert into hoopcheck_deletion_private.apple_revocation_receipts(request_id,apple_subject,envelope_digest)
    values(p_request,p_subject,p_digest)
    on conflict(request_id,apple_subject) do update set envelope_digest=excluded.envelope_digest,acknowledged_at=now();
  delete from hoopcheck_apple_private.authorization_vault v where v.owner_id=p_owner and v.apple_subject=p_subject;
  return found;
end $$;
revoke all on function hoopcheck_deletion_private.ack_apple_revocation(uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function hoopcheck_deletion_private.ack_apple_revocation(uuid,uuid,uuid,text,text) to service_role;
create or replace function public.ack_account_deletion_apple_revocation(p_request uuid,p_owner uuid,p_fence uuid,p_subject text,p_digest text)
returns boolean language sql security invoker set search_path='' as $$
select hoopcheck_deletion_private.ack_apple_revocation(p_request,p_owner,p_fence,p_subject,p_digest)
$$;
revoke all on function public.ack_account_deletion_apple_revocation(uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.ack_account_deletion_apple_revocation(uuid,uuid,uuid,text,text) to service_role;
-- Receipts contain provider subjects and must be removed under the reviewed
-- finalization/retention policy. Do not enable without that cleanup.
