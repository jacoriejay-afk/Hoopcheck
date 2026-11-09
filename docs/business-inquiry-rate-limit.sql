-- REVIEWED MIGRATION CANDIDATE — NOT APPLIED TO PRODUCTION.
-- Rate-limit authenticated inserts into the EXISTING sponsor_inquiries table.
-- A database trigger is necessary because the current client writes directly to Supabase.
-- An advisory transaction lock serializes concurrent submissions for one user.
-- Existing inquiries are retained; existing INSERT policy remains unchanged.

create or replace function public.limit_sponsor_inquiry_submissions()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  recent_minute integer;
  recent_hour integer;
begin
  if auth.uid() is null or new.user_id is distinct from auth.uid() then
    raise exception 'Authentication required for business inquiries' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text, 48102));

  select
    count(*) filter (where created_at >= pg_catalog.now() - interval '1 minute'),
    count(*) filter (where created_at >= pg_catalog.now() - interval '1 hour')
  into recent_minute, recent_hour
  from public.sponsor_inquiries
  where user_id = new.user_id
    and created_at >= pg_catalog.now() - interval '1 hour';

  if recent_minute >= 1 or recent_hour >= 3 then
    raise exception 'Too many inquiries. Please try again later.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.limit_sponsor_inquiry_submissions() from public, anon, authenticated;
drop trigger if exists sponsor_inquiries_submission_limit on public.sponsor_inquiries;
create trigger sponsor_inquiries_submission_limit
before insert on public.sponsor_inquiries
for each row execute function public.limit_sponsor_inquiry_submissions();

-- Verify with isolated test users: first insert succeeds, immediate repeat fails,
-- hourly quota blocks fourth insert, unrelated user remains unaffected,
-- anonymous insert denied, and admin inbox SELECT policy remains independent.
-- Production rollout requires monitoring and an explicit rollback plan.
