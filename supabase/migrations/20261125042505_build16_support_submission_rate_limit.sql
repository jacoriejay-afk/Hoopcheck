-- Throttle direct authenticated support submissions; no changes to trusted
-- moderation or service-role workflows. Apply only after full-schema tests.
create schema if not exists private;

create index if not exists support_tickets_requester_created_idx
  on public.support_tickets (requester_id, created_at desc);

create or replace function private.enforce_support_ticket_submission_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_recent integer;
  v_daily integer;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  v_user := auth.uid();
  if v_user is null or new.requester_id is distinct from v_user then
    raise exception 'Invalid support ticket requester' using errcode = '42501';
  end if;

  -- Prevent concurrent submissions from the same account bypassing the limits.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('hoopcheck:support:' || v_user::text, 0)
  );
  v_now := pg_catalog.clock_timestamp();

  -- The client must not be able to backdate a new ticket to evade throttling.
  new.created_at := v_now;
  new.updated_at := v_now;

  select
    pg_catalog.count(*) filter (where t.created_at > v_now - interval '10 minutes'),
    pg_catalog.count(*)
  into v_recent, v_daily
  from public.support_tickets t
  where t.requester_id = v_user
    and t.created_at > v_now - interval '24 hours';

  if v_recent >= 10 or v_daily >= 40 then
    raise exception 'Support submission rate limit reached. Please try again later.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_support_ticket_submission_limit()
  from public, anon, authenticated;

drop trigger if exists enforce_support_ticket_submission_limit on public.support_tickets;
create trigger enforce_support_ticket_submission_limit
  before insert on public.support_tickets
  for each row execute function private.enforce_support_ticket_submission_limit();
