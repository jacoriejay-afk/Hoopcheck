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
  terms_accepted_at_value timestamptz;
  years_pro_value integer;
  professional_experience_value boolean := false;
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

  IF account_type_value NOT IN ('player', 'coach', 'scout', 'agent', 'fan') THEN
    RAISE EXCEPTION 'A valid account type is required';
  END IF;

  IF gender_value NOT IN ('male', 'female', 'non_binary', 'prefer_not_to_say') THEN
    RAISE EXCEPTION 'Gender is required';
  END IF;

  IF nullif(trim(new.raw_user_meta_data->>'username'), '') IS NULL
     OR trim(new.raw_user_meta_data->>'username') !~ '^[A-Za-z0-9_]{3,20}

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
          THEN years_pro_value ELSE NULL END,
     professional_experience_value,
     true,
     true,
     terms_accepted_at_value,
     new.raw_user_meta_data->>'terms_version',
     birthdate_value,
     gender_value,
     CASE WHEN account_type_value = 'player' AND gender_value = 'female'
          THEN 'womens' ELSE 'mens' END);

  RETURN new;
END;
$function$;
 THEN
    RAISE EXCEPTION 'Username must be 3-20 letters, numbers, or underscores';
  END IF;

  IF account_type_value = 'player' THEN
    IF coalesce(new.raw_user_meta_data->>'position', '') NOT IN ('PG', 'SG', 'SF', 'PF', 'C') THEN
      RAISE EXCEPTION 'A valid player position is required';
    END IF;
    IF nullif(new.raw_user_meta_data->>'years_pro', '') IS NOT NULL THEN
      BEGIN
        years_pro_value := (new.raw_user_meta_data->>'years_pro')::integer;
      EXCEPTION WHEN others THEN
        RAISE EXCEPTION 'Years pro must be a whole number from 0 to 25';
      END;
      IF years_pro_value < 0 OR years_pro_value > 25 THEN
        RAISE EXCEPTION 'Years pro must be a whole number from 0 to 25';
      END IF;
    END IF;
  END IF;

  IF lower(coalesce(new.raw_user_meta_data->>'professional_experience', 'false')) NOT IN ('true', 'false') THEN
    RAISE EXCEPTION 'Professional experience must be true or false';
  END IF;
  professional_experience_value := lower(coalesce(new.raw_user_meta_data->>'professional_experience', 'false')) = 'true';

  IF lower(coalesce(new.raw_user_meta_data->>'agreed_to_terms', 'false')) <> 'true'
     OR nullif(new.raw_user_meta_data->>'terms_accepted_at', '') IS NULL
     OR nullif(new.raw_user_meta_data->>'terms_version', '') IS NULL THEN
    RAISE EXCEPTION 'Acceptance of the current Terms of Service is required';
  END IF;

  BEGIN
    terms_accepted_at_value := (new.raw_user_meta_data->>'terms_accepted_at')::timestamptz;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'A valid Terms of Service acceptance timestamp is required';
  END;

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
