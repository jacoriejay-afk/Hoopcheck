-- Run only AFTER applying both SECURITY-FINAL migrations in a controlled environment.
-- Transaction rolls back all local settings. No rows are created, modified or deleted.
-- Uses an existing approved owner-admin ID without emitting personal information.
BEGIN;
DO $verify$
DECLARE
  owner_id uuid;
  denied boolean;
  function_name text;
BEGIN
  SELECT o.user_id INTO owner_id
  FROM hoopcheck_security.owner_accounts o
  JOIN public.admin_roles a ON a.user_id = o.user_id
  WHERE lower(trim(coalesce(a.role,''))) = 'admin'
  LIMIT 1;
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Missing owner-admin fixture'; END IF;

  -- Non-owner identity must be denied before input validation or data access.
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
  FOR function_name IN SELECT unnest(ARRAY['roles','directory','inquiries']) LOOP
    denied := false;
    BEGIN
      IF function_name = 'roles' THEN
        PERFORM * FROM public.admin_list_user_roles('security-test-no-match');
      ELSIF function_name = 'directory' THEN
        PERFORM public.admin_delete_directory_entry('invalid', '00000000-0000-4000-8000-000000000001'::uuid);
      ELSE
        PERFORM * FROM public.admin_list_public_business_inquiries(0);
      END IF;
    EXCEPTION WHEN insufficient_privilege THEN denied := true;
    END;
    IF NOT denied THEN RAISE EXCEPTION 'Non-owner authorization failed for %', function_name; END IF;
  END LOOP;

  -- Owner-admin must pass authorization and reach validation for safe invalid inputs.
  PERFORM set_config('request.jwt.claim.sub', owner_id::text, true);
  PERFORM * FROM public.admin_list_user_roles('security-test-no-match');
  BEGIN
    PERFORM public.admin_delete_directory_entry('invalid', '00000000-0000-4000-8000-000000000001'::uuid);
    RAISE EXCEPTION 'Expected invalid directory type';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Invalid directory type' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM * FROM public.admin_list_public_business_inquiries(0);
    RAISE EXCEPTION 'Expected invalid limit';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
END $verify$;
ROLLBACK;
-- Note: does not simulate an authenticated non-owner administrator.
-- That separate case requires a safely isolated admin fixture and remains a release gate.
