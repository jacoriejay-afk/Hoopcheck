-- Pre-deployment permission inventory for private-country isolation.
-- Execute against the target database in READ-ONLY mode before scheduling a
-- column-level revoke. This query does not change permissions or data.
SELECT
  role_name,
  has_table_privilege(role_name, 'public.profiles', 'SELECT') AS can_select_profiles,
  has_column_privilege(role_name, 'public.profiles', 'current_country', 'SELECT') AS can_select_private_country,
  has_function_privilege(role_name, 'public.get_public_player_profile(uuid)', 'EXECUTE') AS can_execute_profile_reader,
  has_function_privilege(role_name, 'public.search_public_players(text,text,integer,integer)', 'EXECUTE') AS can_execute_username_search,
  has_function_privilege(role_name, 'public.search_public_players(text,text,text,boolean,integer)', 'EXECUTE') AS can_execute_legacy_search,
  has_function_privilege(role_name, 'public.search_public_players_page(text,text,text,boolean,integer,integer)', 'EXECUTE') AS can_execute_paginated_search
FROM (VALUES ('anon'), ('authenticated')) AS roles(role_name);

-- Any additional SECURITY INVOKER functions that directly reference
-- current_country must be reviewed before a column revoke. A function
-- relying on invoker column SELECT may fail after the permission change.
SELECT n.nspname AS schema_name, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosrc ILIKE '%current_country%'
ORDER BY 1,2,3;
