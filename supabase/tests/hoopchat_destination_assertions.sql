DO $$
BEGIN
  IF has_function_privilege('anon', 'public.resolve_hoopchat_destination(uuid)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.resolve_hoopchat_destination(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Unexpected destination function privileges';
  END IF;
END $$;

CREATE FUNCTION public.assert_destination(target uuid, allowed boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT FROM public.resolve_hoopchat_destination(target)) IS DISTINCT FROM allowed THEN
    RAISE EXCEPTION 'Unexpected destination visibility';
  END IF;
END $$;

SET ROLE authenticated;
SELECT set_config('fixture.uid', '10000000-0000-4000-8000-000000000002', false);
SELECT public.assert_destination('10000000-0000-4000-8000-000000000001', true);
SELECT public.assert_destination('10000000-0000-4000-8000-000000000004', false);
SELECT set_config('fixture.uid', '10000000-0000-4000-8000-000000000005', false);
SELECT public.assert_destination('10000000-0000-4000-8000-000000000001', false);
SELECT set_config('fixture.uid', '', false);
SELECT public.assert_destination('10000000-0000-4000-8000-000000000001', false);
RESET ROLE;

INSERT INTO public.user_blocks VALUES
 ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003');
SET ROLE authenticated;
SELECT set_config('fixture.uid', '10000000-0000-4000-8000-000000000002', false);
SELECT public.assert_destination('10000000-0000-4000-8000-000000000001', false);
SELECT set_config('fixture.uid', '10000000-0000-4000-8000-000000000003', false);
SELECT public.assert_destination('10000000-0000-4000-8000-000000000001', false);
RESET ROLE;
