-- Serialize review submission rate-limit claims so concurrent requests cannot
-- exceed the five-review rolling 24-hour limit.
-- Review this migration before applying it to any live database.

create table if not exists public.review_submission_rate_limits (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists review_submission_rate_limits_user_created_idx
  on public.review_submission_rate_limits (user_id, created_at desc);

alter table public.review_submission_rate_limits enable row level security;
revoke all on table public.review_submission_rate_limits from anon, authenticated;

create or replace function public.claim_review_submission_slot()
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
declare
  v_user_id uuid;
  v_recent_count integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  -- Serialize claims per user inside the transaction.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  delete from public.review_submission_rate_limits
  where user_id = v_user_id
    and created_at < now() - interval '24 hours';

  select count(*)::integer
    into v_recent_count
  from public.review_submission_rate_limits
  where user_id = v_user_id
    and created_at >= now() - interval '24 hours';

  if v_recent_count >= 5 then
    return false;
  end if;

  insert into public.review_submission_rate_limits (user_id)
  values (v_user_id);

  return true;
end;
$function$;

revoke all on function public.claim_review_submission_slot() from public, anon;
grant execute on function public.claim_review_submission_slot() to authenticated;
