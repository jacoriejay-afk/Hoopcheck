\set ON_ERROR_STOP on
BEGIN;
\ir hoopchat_structured_replies_isolated.sql

-- Synthetic stand-ins for the separately reviewed session and bilateral RLS contracts.
CREATE SCHEMA hoopcheck_security;
GRANT USAGE ON SCHEMA hoopcheck_security TO authenticated;
CREATE FUNCTION hoopcheck_security.mfa_satisfied() RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT current_setting('fixture.mfa', true) = 'verified' $$;
CREATE FUNCTION public.confirm_active_account_session() RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT current_setting('fixture.session', true) = 'active' $$;
CREATE POLICY post16_contact_pair_block_guard ON public.player_contact_requests
AS RESTRICTIVE FOR SELECT TO authenticated
USING (id::text IS DISTINCT FROM current_setting('fixture.blocked_request', true));
CREATE POLICY post16_contact_message_block_guard ON public.player_contact_messages
AS RESTRICTIVE FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.player_contact_requests r WHERE r.id = request_id));

UPDATE public.player_contact_messages SET created_at = '2026-11-01 00:00:00.123456+00';
INSERT INTO public.player_contact_messages(id, request_id, sender_id, body, created_at) VALUES
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
   '22222222-2222-4222-8222-222222222222','same timestamp','2026-11-01 00:00:00.123456+00'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
   '11111111-1111-4111-8111-111111111111','outgoing','2026-11-01 00:00:01+00');
\ir ../candidates/step1_hoopchat_read_sync_review_only.sql

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
SET LOCAL fixture.session = 'active';
SET LOCAL fixture.mfa = 'verified';
DO $fixture$
DECLARE
  first_thread constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  other_thread constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
  pending_thread constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
  first_message constant uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
  other_message constant uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
  second_message constant uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3';
  own_message constant uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4';
BEGIN
  IF has_function_privilege('anon', 'public.get_hoopchat_unread(uuid[])', 'EXECUTE')
     OR has_function_privilege('anon', 'public.mark_hoopchat_read(uuid,uuid)', 'EXECUTE')
     OR (SELECT unread_count FROM public.get_hoopchat_unread(ARRAY[first_thread])) IS DISTINCT FROM 2
     OR public.mark_hoopchat_read(first_thread, other_message)
     OR public.mark_hoopchat_read(first_thread, own_message) THEN
    RAISE EXCEPTION 'Wrong sender, thread or initial unread count';
  END IF;

  IF NOT public.mark_hoopchat_read(first_thread, first_message) THEN
    RAISE EXCEPTION 'First read acknowledgement missing';
  END IF;
  IF (SELECT unread_count FROM public.get_hoopchat_unread(ARRAY[first_thread])) IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Same-timestamp unread cursor lost';
  END IF;
  IF NOT public.mark_hoopchat_read(first_thread, second_message) THEN
    RAISE EXCEPTION 'Second read acknowledgement missing';
  END IF;
  IF NOT public.mark_hoopchat_read(first_thread, first_message) THEN
    RAISE EXCEPTION 'Out-of-order retry was not acknowledged';
  END IF;
  IF (SELECT unread_count FROM public.get_hoopchat_unread(ARRAY[first_thread])) IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Marker was not idempotent and monotonic';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
  IF EXISTS (SELECT 1 FROM hoopcheck_chat_private.read_markers)
     OR EXISTS (SELECT 1 FROM public.get_hoopchat_unread(ARRAY[first_thread, other_thread]) WHERE request_id = first_thread)
     OR public.mark_hoopchat_read(first_thread, first_message)
     OR (SELECT unread_count FROM public.get_hoopchat_unread(ARRAY[pending_thread])) IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Cross-account or pending request visibility failed';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  PERFORM set_config('fixture.blocked_request', first_thread::text, true);
  IF EXISTS (SELECT 1 FROM hoopcheck_chat_private.read_markers)
     OR EXISTS (SELECT 1 FROM public.get_hoopchat_unread(ARRAY[first_thread]))
     OR public.mark_hoopchat_read(first_thread, second_message) THEN
    RAISE EXCEPTION 'Blocked thread retained unread or marker visibility';
  END IF;

  PERFORM set_config('fixture.mfa', 'pending', true);
  BEGIN
    PERFORM public.get_hoopchat_unread(ARRAY[first_thread]);
    RAISE EXCEPTION 'Incomplete MFA accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('fixture.mfa', 'verified', true);
  PERFORM set_config('fixture.session', 'revoked', true);
  BEGIN
    PERFORM public.mark_hoopchat_read(first_thread, first_message);
    RAISE EXCEPTION 'Revoked session accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$fixture$;
ROLLBACK;
SELECT 'PASS scoped cross-device marker, same-timestamp ordering, block, MFA and revoked-session boundaries' AS result;
