-- Review-only candidate. Apply in a single transaction on a disposable PG17 baseline.
-- Existing alert clients only update read_at; RLS continues to select the owner.
SET LOCAL lock_timeout = '4s';
SET LOCAL statement_timeout = '15s';

DO $guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE oid = 'public.notifications'::regclass AND relrowsecurity
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.notifications'::regclass
      AND polname = 'notifications_update_own' AND polcmd = 'w'
  ) OR NOT has_table_privilege('authenticated', 'public.notifications', 'SELECT')
  THEN
    RAISE EXCEPTION 'Notification policy baseline differs from the reviewed contract';
  END IF;
END
$guard$;

REVOKE UPDATE ON TABLE public.notifications FROM authenticated;
GRANT UPDATE (read_at) ON TABLE public.notifications TO authenticated;

DO $guard$
BEGIN
  IF has_table_privilege('authenticated', 'public.notifications', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'public.notifications', 'read_at', 'UPDATE')
     OR has_any_column_privilege('anon', 'public.notifications', 'UPDATE')
     OR EXISTS (
       SELECT 1 FROM pg_attribute
       WHERE attrelid = 'public.notifications'::regclass AND attnum > 0 AND NOT attisdropped
         AND attname <> 'read_at'
         AND has_column_privilege('authenticated', attrelid, attnum, 'UPDATE')
     )
  THEN
    RAISE EXCEPTION 'Unexpected inherited notification write privileges';
  END IF;
END
$guard$;
