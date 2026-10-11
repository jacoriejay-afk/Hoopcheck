-- Fix signup metadata mapping for mobile and web clients.
-- Review and apply through the normal migration/release process; this file is not executed by this commit.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  account_type_value text := coalesce(new.raw_user_meta_data->>'account_type', 'player');
  gender_value text := coalesce(new.raw_user_meta_data->>'gender', '');
  birthdate_value date;
BEGIN
  IF nullif(new.raw_user_meta_data->>'birthdate', '') IS NULL THEN
    RAISE EXCEPTION 'Birthdate is required';
  END IF;

  BEGIN
    birthdate_value := (new.raw_user_meta_data->>'birthdate')::date;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'A valid birthdate is required';
  END;

  IF birthdate_value > (current_date - interval '18 years')::date THEN
    RAISE EXCEPTION 'You must be 18 or older';
  END IF;

  IF gender_value NOT IN ('male', 'female', 'non_binary', 'prefer_not_to_say') THEN
    RAISE EXCEPTION 'Gender is required';
  END IF;

  IF coalesce((new.raw_user_meta_data->>'agreed_to_terms')::boolean, false) IS NOT TRUE
     OR nullif(new.raw_user_meta_data->>'terms_accepted_at', '') IS NULL
     OR nullif(new.raw_user_meta_data->>'terms_version', '') IS NULL THEN
    RAISE EXCEPTION 'Acceptance of the current Terms of Service is required';
  END IF;

  INSERT INTO public.profiles
    (id, display_name, first_name, last_name, username, account_type,
     position, years_pro, professional_experience, is_adult, agreed_to_terms,
     terms_accepted_at, terms_version, birthdate, gender, basketball_type)
  VALUES
    (new.id,
     coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
              split_part(new.email, '@', 1)),
     nullif(trim(new.raw_user_meta_data->>'first_name'), ''),
     nullif(trim(new.raw_user_meta_data->>'last_name'), ''),
     lower(nullif(trim(new.raw_user_meta_data->>'username'), '')),
     account_type_value,
     CASE WHEN account_type_value = 'player' THEN new.raw_user_meta_data->>'position' ELSE NULL END,
     CASE WHEN account_type_value = 'player'
          THEN nullif(new.raw_user_meta_data->>'years_pro', '')::integer ELSE NULL END,
     coalesce((new.raw_user_meta_data->>'professional_experience')::boolean, false),
     true,
     true,
     (new.raw_user_meta_data->>'terms_accepted_at')::timestamptz,
     new.raw_user_meta_data->>'terms_version',
     birthdate_value,
     gender_value,
     CASE WHEN account_type_value = 'player' AND gender_value = 'female'
          THEN 'womens' ELSE 'mens' END);

  RETURN new;
END;
$function$;
