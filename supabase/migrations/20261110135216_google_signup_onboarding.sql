-- Google OAuth creates an identity before returning to HoopCheck. Restrict
-- that identity to signed-out permissions until the signup form is complete.
create role hoopcheck_pending_signup nologin inherit;
grant anon to hoopcheck_pending_signup;
grant hoopcheck_pending_signup to authenticator;
grant usage on schema public to hoopcheck_pending_signup;

CREATE OR REPLACE FUNCTION private.create_signup_profile(user_id uuid, user_email text, metadata jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  account_type_value text := coalesce(metadata->>'account_type', 'player');
  gender_value text := coalesce(metadata->>'gender', '');
  birthdate_value date;
  terms_accepted_at_value timestamptz;
  years_pro_value integer;
  professional_experience_value boolean := false;
  username_value text;
BEGIN
  IF nullif(trim(metadata->>'birthdate'), '') IS NULL THEN
    RAISE EXCEPTION 'Birthdate is required';
  END IF;

  BEGIN
    birthdate_value := (metadata->>'birthdate')::date;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'A valid birthdate is required';
  END;

  IF birthdate_value > (current_date - interval '18 years')::date THEN
    RAISE EXCEPTION 'You must be 18 or older';
  END IF;

  IF account_type_value NOT IN ('player', 'coach', 'manager', 'scout', 'agent', 'fan') THEN
    RAISE EXCEPTION 'A valid account type is required';
  END IF;

  IF gender_value NOT IN ('male', 'female', 'non_binary', 'prefer_not_to_say') THEN
    RAISE EXCEPTION 'Gender is required';
  END IF;

  username_value := lower(nullif(trim(metadata->>'username'), ''));
  IF username_value IS NULL OR username_value !~ '^[a-zA-Z0-9_]{3,20}$' THEN
    RAISE EXCEPTION 'Username must be 3-20 letters, numbers, or underscores';
  END IF;

  IF account_type_value = 'player' THEN
    IF coalesce(metadata->>'position', '') NOT IN ('PG', 'SG', 'SF', 'PF', 'C') THEN
      RAISE EXCEPTION 'A valid player position is required';
    END IF;

    IF nullif(trim(metadata->>'years_pro'), '') IS NOT NULL THEN
      BEGIN
        years_pro_value := (metadata->>'years_pro')::integer;
      EXCEPTION WHEN others THEN
        RAISE EXCEPTION 'Years pro must be a whole number from 0 to 25';
      END;

      IF years_pro_value < 0 OR years_pro_value > 25 THEN
        RAISE EXCEPTION 'Years pro must be a whole number from 0 to 25';
      END IF;
    END IF;
  END IF;

  IF lower(coalesce(metadata->>'professional_experience', 'false')) NOT IN ('true', 'false') THEN
    RAISE EXCEPTION 'Professional experience must be true or false';
  END IF;
  professional_experience_value :=
    lower(coalesce(metadata->>'professional_experience', 'false')) = 'true';

  IF lower(coalesce(metadata->>'agreed_to_terms', 'false')) <> 'true'
     OR nullif(metadata->>'terms_accepted_at', '') IS NULL
     OR nullif(trim(metadata->>'terms_version'), '') IS NULL THEN
    RAISE EXCEPTION 'Acceptance of the current Terms of Service is required';
  END IF;

  BEGIN
    terms_accepted_at_value := (metadata->>'terms_accepted_at')::timestamptz;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'A valid Terms of Service acceptance timestamp is required';
  END;

  INSERT INTO public.profiles
    (id, display_name, first_name, last_name, username, account_type,
     position, years_pro, professional_experience, is_adult, agreed_to_terms,
     terms_accepted_at, terms_version, birthdate, gender, basketball_type)
  VALUES
    (user_id,
     coalesce(nullif(trim(metadata->>'full_name'), ''),
              split_part(user_email, '@', 1)),
     nullif(trim(metadata->>'first_name'), ''),
     nullif(trim(metadata->>'last_name'), ''),
     username_value,
     account_type_value,
     CASE WHEN account_type_value = 'player' THEN metadata->>'position' ELSE NULL END,
     CASE WHEN account_type_value = 'player' THEN years_pro_value ELSE NULL END,
     professional_experience_value,
     true,
     true,
     terms_accepted_at_value,
     trim(metadata->>'terms_version'),
     birthdate_value,
     gender_value,
     CASE WHEN account_type_value = 'player' AND gender_value = 'female'
          THEN 'womens' ELSE 'mens' END);

END;
$function$;

revoke all on function private.create_signup_profile(uuid, text, jsonb) from public, anon, authenticated, service_role;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.raw_app_meta_data->>'provider' is distinct from 'google' then
    perform private.create_signup_profile(new.id, new.email, new.raw_user_meta_data);
  end if;
  return new;
end;
$$;

create function private.restrict_pending_google_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Supabase Auth sets its default role after inserting auth.users, then
  -- reloads the record before issuing credentials. Guard both writes.
  if new.raw_app_meta_data->>'provider' = 'google'
    and not exists (select 1 from public.profiles where id = new.id) then
    new.role := 'hoopcheck_pending_signup';
  end if;
  return new;
end;
$$;

revoke all on function private.restrict_pending_google_role() from public, anon, authenticated, service_role;

create trigger restrict_pending_google_role
before insert or update of role on auth.users
for each row execute function private.restrict_pending_google_role();

create function private.complete_google_signup(signup jsonb)
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
    and raw_app_meta_data->>'provider' = 'google'
  for update;

  if verified_email is null or auth.jwt()->>'role' is distinct from 'hoopcheck_pending_signup' then
    raise exception 'A verified Google signup is required' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = current_user_id) then
    return;
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

revoke all on function private.complete_google_signup(jsonb) from public, anon, authenticated, service_role;
grant usage on schema private to hoopcheck_pending_signup;
grant execute on function private.complete_google_signup(jsonb) to hoopcheck_pending_signup;

create function public.complete_google_signup(signup jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.complete_google_signup(signup);
$$;

revoke all on function public.complete_google_signup(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.complete_google_signup(jsonb) to hoopcheck_pending_signup;

notify pgrst, 'reload schema';
