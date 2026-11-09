-- Atomic, database-backed throttling and insertion.
-- Run after public-business-inquiries.sql. Service-role only.
-- Restrict function execution to the server role; revoke default PUBLIC grants
-- in the same transaction as function creation.
begin;
create or replace function public.submit_business_inquiry(
  p_name text, p_email text, p_type text, p_message text
) returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_email));
  v_count integer;
begin
  if char_length(btrim(p_name)) not between 2 and 120
     or char_length(v_email) > 254
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     or p_type not in ('sponsor','donate','inquire')
     or char_length(btrim(p_message)) not between 10 and 3000 then
    raise exception 'Invalid inquiry';
  end if;

  -- Serializes submissions for this address across server instances.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_email, 0));
  select count(*) into v_count
  from public.public_business_inquiries
  where lower(email) = v_email and created_at > now() - interval '24 hours';
  if v_count >= 3 then return false; end if;

  insert into public.public_business_inquiries (name,email,type,message)
  values (btrim(p_name), v_email, p_type, btrim(p_message));
  return true;
end;
$$;
revoke all on function public.submit_business_inquiry(text,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_business_inquiry(text,text,text,text) to service_role;
commit;
