-- Disposable synthetic PG17 fixture only. No application connection or user data.
-- The narrow baseline below reproduces the message table and participant policies.
-- It is not an effective production schema or full schema parity proof.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
CREATE TABLE public.profiles(id uuid PRIMARY KEY);
CREATE TABLE public.player_contact_requests (
 id uuid PRIMARY KEY, requester_id uuid NOT NULL REFERENCES public.profiles(id),
 player_id uuid NOT NULL REFERENCES public.profiles(id),
 status text NOT NULL CHECK(status IN ('accepted','pending','rejected'))
);
CREATE TABLE public.player_contact_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL REFERENCES public.player_contact_requests(id) ON DELETE CASCADE,
 sender_id uuid NOT NULL REFERENCES public.profiles(id),
 body text NOT NULL CHECK(char_length(trim(body)) BETWEEN 1 AND 4000),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.player_contact_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_contact_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contact participants can view requests" ON public.player_contact_requests FOR SELECT TO authenticated
 USING (requester_id=auth.uid() OR player_id=auth.uid());
CREATE POLICY "accepted participants can view messages" ON public.player_contact_messages FOR SELECT TO authenticated
 USING (EXISTS(SELECT 1 FROM public.player_contact_requests r WHERE r.id=player_contact_messages.request_id AND r.status='accepted' AND (r.requester_id=auth.uid() OR r.player_id=auth.uid())));
CREATE POLICY "accepted participants can send messages" ON public.player_contact_messages FOR INSERT TO authenticated
 WITH CHECK (sender_id=auth.uid() AND EXISTS(SELECT 1 FROM public.player_contact_requests r WHERE r.id=player_contact_messages.request_id AND r.status='accepted' AND (r.requester_id=auth.uid() OR r.player_id=auth.uid())));
GRANT SELECT ON public.player_contact_requests TO authenticated;
GRANT SELECT,INSERT ON public.player_contact_messages TO authenticated;
INSERT INTO public.profiles VALUES
 ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222'),('33333333-3333-4333-8333-333333333333');
INSERT INTO public.player_contact_requests VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','accepted'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','accepted'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','pending');
INSERT INTO public.player_contact_messages(id,request_id,sender_id,body) VALUES
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','22222222-2222-4222-8222-222222222222','synthetic original'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','33333333-3333-4333-8333-333333333333','synthetic unrelated thread');
-- PL/pgSQL statements are planned at execution, after applying candidate.
CREATE FUNCTION public.exercise_hoopchat_reply_fixture() RETURNS text LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
 a constant uuid:='11111111-1111-4111-8111-111111111111';
 b constant uuid:='22222222-2222-4222-8222-222222222222';
 c constant uuid:='33333333-3333-4333-8333-333333333333';
 t1 constant uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
 t2 constant uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
 t3 constant uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
 m1 constant uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
 m2 constant uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
 m3 constant uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3';
 legacy constant uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4';
 denied boolean;
BEGIN
 IF has_table_privilege('anon','public.player_contact_messages','SELECT') OR has_table_privilege('authenticated','public.player_contact_messages','UPDATE') THEN
  RAISE EXCEPTION 'unexpected privilege expansion'; END IF;
 SET LOCAL ROLE authenticated;
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 INSERT INTO public.player_contact_messages(id,request_id,sender_id,body,reply_to_id) VALUES(m3,t1,a,'synthetic reply',m1);
 INSERT INTO public.player_contact_messages(id,request_id,sender_id,body) VALUES(legacy,t1,a,'old client');
 IF NOT EXISTS(SELECT 1 FROM public.player_contact_messages WHERE id=m3 AND reply_to_id=m1) OR
 NOT EXISTS(SELECT 1 FROM public.player_contact_messages WHERE id=legacy AND reply_to_id IS NULL)
 THEN RAISE EXCEPTION 'reply or legacy message missing'; END IF;
 denied:=false;
 BEGIN
  INSERT INTO public.player_contact_messages(request_id,sender_id,body,reply_to_id) VALUES(t1,a,'cross thread',m2);
 EXCEPTION WHEN raise_exception OR foreign_key_violation THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'cross-thread link accepted'; END IF;
 denied:=false;
 BEGIN
  INSERT INTO public.player_contact_messages(request_id,sender_id,body,reply_to_id) VALUES(t1,b,'forged sender',m1);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'forged sender accepted'; END IF;
 PERFORM set_config('request.jwt.claim.sub',c::text,true);
 IF EXISTS(SELECT 1 FROM public.player_contact_messages WHERE request_id=t1) THEN RAISE EXCEPTION 'unrelated account read private reply'; END IF;
 denied:=false;
 BEGIN
  INSERT INTO public.player_contact_messages(request_id,sender_id,body,reply_to_id) VALUES(t1,c,'unrelated',m1);
 EXCEPTION WHEN raise_exception OR insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'nonparticipant linked reply'; END IF;
 denied:=false;
 BEGIN
  INSERT INTO public.player_contact_messages(request_id,sender_id,body) VALUES(t3,c,'pending thread');
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'pending thread write accepted'; END IF;
 PERFORM set_config('request.jwt.claim.sub',b::text,true);
 IF NOT EXISTS(SELECT 1 FROM public.player_contact_messages WHERE id=m3 AND reply_to_id=m1) THEN RAISE EXCEPTION 'accepted peer cannot see reply'; END IF;
 RESET ROLE;
 DELETE FROM public.player_contact_messages WHERE id=m1;
 IF NOT EXISTS(SELECT 1 FROM public.player_contact_messages WHERE id=m3 AND request_id=t1 AND reply_to_id IS NULL) THEN
  RAISE EXCEPTION 'delete should clear only reply link'; END IF;
 RETURN 'PASS synthetic PG17 same-thread reply, legacy insert, cross-thread denial, participant RLS, sender denial, pending denial, and source deletion';
END $$;
REVOKE ALL ON FUNCTION public.exercise_hoopchat_reply_fixture() FROM PUBLIC;
