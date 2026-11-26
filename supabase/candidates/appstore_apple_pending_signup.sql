-- REVIEW-ONLY candidate for #1073. NOT a migration; do not run on hosted DB.
-- Requires verified current function owners, grants, trigger definitions and
-- full-schema rehearsal before generating a migration with the CLI.
-- Keep the Google completion RPC unchanged. Apple receives a distinct RPC.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.raw_app_meta_data->>'provider' is distinct from 'google' and new.raw_app_meta_data->>'provider' is distinct from 'apple' then
    perform private.create_signup_profile(new.id, new.email, new.raw_user_meta_data);
  end if;
  return new;
end;
$$;

create or replace function private.restrict_pending_google_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Supabase Auth sets its default role after inserting auth.users, then
  -- reloads the record before issuing credentials. Guard both writes.
  if new.raw_app_meta_data->>'provider' in ('google', 'apple')
    and not exists (select 1 from public.profiles where id = new.id) then
    new.role := 'hoopcheck_pending_signup';
  end if;
  return new;
end;
$$;

revoke all on function private.restrict_pending_google_role() from public, anon, authenticated, service_role;

create function private.complete_apple_signup(signup jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  verified_email text;
  signup_metadata jsonb;
begin
  select email into verified_email
  from auth.users
  where id = current_user_id
    and email_confirmed_at is not null
    and raw_app_meta_data->>'provider' = 'apple'
  for update;

  if verified_email is null or auth.jwt()->>'role' is distinct from 'hoopcheck_pending_signup' then
    raise exception 'A verified Apple signup is required' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = current_user_id) then
    return;
  end if;
  if not exists (select 1 from auth.users where id = current_user_id and role = 'hoopcheck_pending_signup') then
    raise exception 'A pending Apple signup is required' using errcode = '42501';
  end if;

  if length(btrim(coalesce(signup->>'first_name', ''))) not between 2 and 80
    or length(btrim(coalesce(signup->>'last_name', ''))) not between 2 and 80
    or nullif(signup->>'account_type', '') is null
    or coalesce(signup->>'birthdate', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or signup->>'terms_version' is distinct from '2026-10-01' then
    raise exception 'Complete all required signup fields' using errcode = '22023';
  end if;

  -- Only allow signup fields from the form. Record consent time on the server.
  signup_metadata := jsonb_build_object(
    'first_name', btrim(signup->>'first_name'),
    'last_name', btrim(signup->>'last_name'),
    'full_name', concat_ws(' ', btrim(signup->>'first_name'), btrim(signup->>'last_name')),
    'username', lower(btrim(signup->>'username')),
    'account_type', signup->>'account_type',
    'position', signup->>'position',
    'years_pro', signup->>'years_pro',
    'professional_experience', signup->'professional_experience',
    'former_team_ids', case
      when signup->>'account_type' = 'player' and jsonb_typeof(signup->'former_team_ids') = 'array'
        then jsonb_path_query_array(signup->'former_team_ids', '$[*] ? (@.type() == "string")')
      else '[]'::jsonb
    end,
    'favorite_teams', left(signup->>'favorite_teams', 500),
    'birthdate', signup->>'birthdate',
    'gender', signup->>'gender',
    'basketball_type', case when signup->>'account_type' = 'player' and signup->>'gender' = 'female' then 'womens' else 'mens' end,
    'is_adult', true,
    'agreed_to_terms', signup->'agreed_to_terms',
    'terms_accepted_at', now(),
    'terms_version', signup->>'terms_version'
  );

  perform private.create_signup_profile(current_user_id, verified_email, signup_metadata);
  update auth.users
    set role = 'authenticated', raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || signup_metadata
    where id = current_user_id;
end;
$$;

revoke all on function private.complete_apple_signup(jsonb) from public, anon, authenticated, service_role;
grant usage on schema private to hoopcheck_pending_signup;
grant execute on function private.complete_apple_signup(jsonb) to hoopcheck_pending_signup;

create function public.complete_apple_signup(signup jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.complete_apple_signup(signup);
$$;

revoke all on function public.complete_apple_signup(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.complete_apple_signup(jsonb) to hoopcheck_pending_signup;

notify pgrst, 'reload schema';
