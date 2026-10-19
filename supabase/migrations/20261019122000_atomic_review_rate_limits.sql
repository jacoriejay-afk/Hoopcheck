-- Serialize review submission rate-limit claims so concurrent requests cannot
-- exceed the five-review rolling 24-hour limit.
-- Review before applying to any live database.

create table if not exists public.review_submission_rate_limits (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists review_submission_rate_limits_user_created_idx
  on public.review_submission_rate_limits (user_id, created_at desc);

alter table public.review_submission_rate_limits enable row level security;
revoke all on table public.review_submission_rate_limits from anon, authenticated;

-- Seed from existing reviews so rollout does not reset the rolling allowance.
insert into public.review_submission_rate_limits (user_id, created_at)
select author_id, created_at
from public.reviews
where created_at >= now() - interval '24 hours'
union all
select author_id, created_at
from public.womens_team_reviews
where created_at >= now() - interval '24 hours';

create or replace function public.claim_review_submission_slot()
returns bigint
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
declare
  v_user_id uuid;
  v_recent_count integer;
  v_slot_id bigint;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

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
    return null;
  end if;

  insert into public.review_submission_rate_limits (user_id)
  values (v_user_id)
  returning id into v_slot_id;

  return v_slot_id;
end;
$function$;

create or replace function public.release_review_submission_slot(
  p_slot_id bigint,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $function$
declare
  v_deleted_count integer;
begin
  -- This is an internal rollback operation used only when the server-side
  -- review insert fails. Do not let authenticated clients erase their own
  -- rate-limit history through a directly callable RPC.
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  if p_user_id is null then
    raise exception 'Review owner is required';
  end if;

  delete from public.review_submission_rate_limits
  where id = p_slot_id
    and user_id = p_user_id;

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count = 1;
end;
$function$;

revoke all on function public.claim_review_submission_slot() from public, anon;
revoke all on function public.release_review_submission_slot(bigint, uuid) from public, anon, authenticated;
grant execute on function public.claim_review_submission_slot() to authenticated;
grant execute on function public.release_review_submission_slot(bigint, uuid) to service_role;
