-- REVIEW ONLY: requires the existing deletion ledger migration, live schema
-- reconciliation, full cleanup/finalization, and separate deployment approval.
-- This function only records a request; it never deletes or disables an account.
create or replace function public.record_verified_account_deletion_request(
  p_owner uuid, p_session uuid, p_mode text
) returns table(request_id uuid, request_status text, requested_at timestamptz, scheduled_for timestamptz)
language plpgsql security invoker set search_path = ''
as $$
declare
  existing public.account_deletion_requests%rowtype;
  due_at timestamptz;
begin
  if p_owner is null or p_session is null or p_mode is null or p_mode not in ('as_soon_as_possible', 'after_30_days') then
    raise exception 'Invalid deletion request' using errcode = '22023';
  end if;
  if not exists(select 1 from auth.sessions s where s.id = p_session and s.user_id = p_owner) then
    raise exception 'Session no longer active' using errcode = '42501';
  end if;
  -- Serialize repeated requests for this account. Never take a client-supplied
  -- owner or session from the HTTP request body; the server verifies them.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text, 17001));
  select r.* into existing from public.account_deletion_requests r
    where r.user_id = p_owner and r.status in ('pending','processing','failed')
    for update;
  if found then
    return query select existing.id, existing.status, existing.requested_at, existing.scheduled_for;
    return;
  end if;
  due_at := case when p_mode = 'after_30_days' then now() + interval '30 days' else now() end;
  insert into public.account_deletion_requests(user_id, scheduled_for)
    values(p_owner, due_at) returning * into existing;
  return query select existing.id, existing.status, existing.requested_at, existing.scheduled_for;
end;
$$;
revoke all on function public.record_verified_account_deletion_request(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.record_verified_account_deletion_request(uuid,uuid,text) to service_role;
-- Verify service_role's narrowly scoped access to auth.sessions in disposable
-- full schema. Do not grant client access or replace invoker with definer.
