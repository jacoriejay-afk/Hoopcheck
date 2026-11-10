-- Admin-only read access to guest business inquiries. Do not apply until inbox QA.
begin;
create or replace function public.admin_list_public_business_inquiries(p_limit integer default 50)
returns table(id uuid, name text, email text, type text, message text, created_at timestamptz)
language plpgsql security definer set search_path = public, pg_catalog
as $function$
begin
  if auth.uid() is null or not exists (
    select 1 from public.admin_roles ar
    where ar.user_id = (select auth.uid())
      and lower(trim(coalesce(ar.role, ''))) = 'admin'
  ) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Limit must be between 1 and 100' using errcode = '22023';
  end if;
  return query select i.id, i.name, i.email, i.type, i.message, i.created_at
    from public.public_business_inquiries i order by i.created_at desc, i.id desc limit p_limit;
end;
$function$;
revoke all on function public.admin_list_public_business_inquiries(integer) from public, anon;
grant execute on function public.admin_list_public_business_inquiries(integer) to authenticated;
commit;
