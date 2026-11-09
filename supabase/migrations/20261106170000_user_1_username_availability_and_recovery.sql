create or replace function public.is_username_available(candidate_username text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    coalesce(candidate_username ~ '^[A-Za-z0-9_]{3,20}$', false)
    and not exists (
      select 1 from public.profiles p
      where lower(p.username) = lower(candidate_username)
        and (auth.uid() is null or p.id <> auth.uid())
    );
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

create or replace function public.save_my_username(candidate_username text)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  normalized_username text := lower(btrim(candidate_username));
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Please sign in before choosing a username.' using errcode = '28000';
  end if;
  if normalized_username !~ '^[a-zA-Z0-9_]{3,20}$' then
    raise exception 'Username must be 3–20 characters using only letters, numbers, or underscores.' using errcode = '22023';
  end if;
  update public.profiles set username = normalized_username, updated_at = now()
   where id = current_user_id;
  if not found then
    raise exception 'Your profile could not be found. Please contact support.' using errcode = 'P0002';
  end if;
exception when unique_violation then
  raise exception 'That username is taken.' using errcode = '23505';
end;
$$;

revoke all on function public.save_my_username(text) from public;
revoke all on function public.save_my_username(text) from anon;
grant execute on function public.save_my_username(text) to authenticated;
