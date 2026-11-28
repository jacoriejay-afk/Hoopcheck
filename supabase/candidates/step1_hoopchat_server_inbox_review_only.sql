-- Review-only extension. Install after the existing read-marker candidate.
-- Invoker RLS remains authoritative for requests, profiles and messages.
DO $guard$ BEGIN
 IF to_regclass('hoopcheck_chat_private.read_markers') IS NULL
 OR to_regprocedure('public.get_hoopchat_unread(uuid[])') IS NULL
 OR NOT EXISTS(SELECT FROM pg_policy WHERE polrelid='public.player_contact_requests'::regclass AND polname='post16_contact_pair_block_guard' AND NOT polpermissive)
 OR NOT EXISTS(SELECT FROM pg_policy WHERE polrelid='public.player_contact_messages'::regclass AND polname='post16_contact_message_block_guard' AND NOT polpermissive)
 THEN RAISE EXCEPTION 'Review existing chat access and read markers first'; END IF;
END $guard$;
CREATE INDEX IF NOT EXISTS hoopchat_inbox_requester_cursor_idx ON public.player_contact_requests(requester_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS hoopchat_inbox_player_cursor_idx ON public.player_contact_requests(player_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS hoopchat_inbox_message_cursor_idx ON public.player_contact_messages(request_id,created_at DESC,id DESC);
CREATE FUNCTION public.hoopchat_inbox_page(p_query text DEFAULT '',p_mode text DEFAULT 'all',p_before_at timestamptz DEFAULT NULL,p_before_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $f$
DECLARE viewer uuid:=auth.uid(); q text:=lower(btrim(coalesce(p_query,''))); page jsonb;
BEGIN
 IF viewer IS NULL OR public.confirm_active_account_session() IS NOT TRUE OR hoopcheck_security.mfa_satisfied() IS NOT TRUE THEN RAISE EXCEPTION 'Verify active account' USING ERRCODE='42501'; END IF;
 IF char_length(q)>80 OR p_mode IS NULL OR p_mode NOT IN ('all','conversations','requests') OR (p_before_at IS NULL)<>(p_before_id IS NULL) THEN RAISE EXCEPTION 'Invalid inbox cursor' USING ERRCODE='22023'; END IF;
 IF left(q,1)='@' THEN q:=substr(q,2); END IF;
 WITH eligible AS (
 SELECT r.id,r.requester_id,r.player_id,r.message,r.status,r.created_at
 FROM public.player_contact_requests r
 LEFT JOIN public.profiles p ON p.id=CASE WHEN r.requester_id=viewer THEN r.player_id ELSE r.requester_id END
 WHERE viewer IN(r.requester_id,r.player_id) AND r.status IN ('accepted','pending','rejected')
 AND (p_mode='all' OR (p_mode='conversations' AND r.status='accepted') OR (p_mode='requests' AND r.status='pending'))
 AND (p_before_at IS NULL OR (r.created_at,r.id)<(p_before_at,p_before_id))
 AND (q='' OR strpos(lower(coalesce(p.display_name,'')),q)>0 OR strpos(lower(coalesce(p.username,'')),q)>0 OR strpos(lower(coalesce(r.message,'')),q)>0
 OR (r.status='accepted' AND EXISTS(SELECT FROM public.player_contact_messages m WHERE m.request_id=r.id AND strpos(lower(m.body),q)>0)))
 ORDER BY r.created_at DESC,r.id DESC LIMIT 101
 ), numbered AS (SELECT *,row_number() OVER(ORDER BY created_at DESC,id DESC) AS pos FROM eligible)
 SELECT jsonb_build_object('rows',coalesce(jsonb_agg(to_jsonb(numbered)-'pos' ORDER BY pos) FILTER(WHERE pos<=100),'[]'::jsonb),'has_more',count(*)>100) INTO page FROM numbered;
 RETURN page;
END $f$;
CREATE FUNCTION public.hoopchat_unread_total() RETURNS bigint LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $f$
DECLARE viewer uuid:=auth.uid(); n bigint;
BEGIN
 IF viewer IS NULL OR public.confirm_active_account_session() IS NOT TRUE OR hoopcheck_security.mfa_satisfied() IS NOT TRUE THEN RAISE EXCEPTION 'Verify active account' USING ERRCODE='42501'; END IF;
 SELECT (SELECT count(*) FROM public.player_contact_requests r WHERE r.player_id=viewer AND r.status='pending')+
 (SELECT count(*) FROM public.player_contact_messages m JOIN public.player_contact_requests r ON r.id=m.request_id
 LEFT JOIN hoopcheck_chat_private.read_markers marker ON marker.reader_id=viewer AND marker.request_id=r.id
 WHERE viewer IN(r.requester_id,r.player_id) AND r.status='accepted' AND m.sender_id<>viewer
 AND (marker.last_read_at IS NULL OR (m.created_at,m.id)>(marker.last_read_at,marker.last_read_id))) INTO n;
 RETURN n;
END $f$;
REVOKE ALL ON FUNCTION public.hoopchat_inbox_page(text,text,timestamptz,uuid),public.hoopchat_unread_total() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hoopchat_inbox_page(text,text,timestamptz,uuid),public.hoopchat_unread_total() TO authenticated;
