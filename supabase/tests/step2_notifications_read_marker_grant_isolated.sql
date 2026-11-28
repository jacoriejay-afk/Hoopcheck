\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE TABLE public.notifications (
  id integer PRIMARY KEY, user_id uuid NOT NULL, title text NOT NULL, read_at timestamptz
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notifications TO service_role;
CREATE POLICY notifications_select_own ON public.notifications FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY notifications_update_own ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
INSERT INTO public.notifications (id, user_id, title) VALUES
  (1, '11111111-1111-4111-8111-111111111111', 'Viewer fixture'),
  (2, '22222222-2222-4222-8222-222222222222', 'Other fixture');

\ir ../candidates/step2_notifications_read_marker_grant_review_only.sql

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
DO $fixture$
DECLARE
  marked integer;
BEGIN
  UPDATE public.notifications SET read_at = now()
  WHERE user_id = auth.uid() AND read_at IS NULL RETURNING id INTO STRICT marked;
  IF marked <> 1 THEN RAISE EXCEPTION 'Unexpected notification marked'; END IF;

  UPDATE public.notifications SET read_at = now() WHERE id = 2;
  IF FOUND OR EXISTS (SELECT 1 FROM public.notifications WHERE id = 2) THEN
    RAISE EXCEPTION 'Cross-account notification access';
  END IF;
  IF has_column_privilege('public.notifications', 'title', 'UPDATE')
     OR has_column_privilege('public.notifications', 'user_id', 'UPDATE') THEN
    RAISE EXCEPTION 'Client can change server-authored notification fields';
  END IF;
END
$fixture$;

RESET ROLE;
SET LOCAL ROLE service_role;
INSERT INTO public.notifications (id, user_id, title) VALUES
  (3, '11111111-1111-4111-8111-111111111111', 'Server delivery fixture');
RESET ROLE;
ROLLBACK;
SELECT 'PASS owner read marker, cross-account denial, protected fields and service delivery' AS result;
