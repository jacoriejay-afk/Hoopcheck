-- REVIEW ONLY: no device token registration, sender, credentials, cron or real deliveries.
BEGIN;
ALTER TABLE public.hoopdata_game_push_preferences
 ADD COLUMN timezone text,
 ADD COLUMN quiet_start_minute integer,
 ADD COLUMN quiet_end_minute integer,
 ADD CONSTRAINT hoopdata_quiet_pair CHECK((quiet_start_minute IS NULL AND quiet_end_minute IS NULL) OR
 (quiet_start_minute IS NOT NULL AND quiet_end_minute IS NOT NULL AND quiet_start_minute BETWEEN 0 AND 1439 AND quiet_end_minute BETWEEN 0 AND 1439));
GRANT INSERT(timezone,quiet_start_minute,quiet_end_minute),UPDATE(timezone,quiet_start_minute,quiet_end_minute) ON public.hoopdata_game_push_preferences TO authenticated;
ALTER TABLE public.hoopdata_game_push_outbox
 ADD COLUMN rights_expires_at timestamptz,
 ADD COLUMN lease_token uuid,
 ADD COLUMN next_attempt_at timestamptz,
 ADD CONSTRAINT hoopdata_push_lease_token CHECK((status='sending')=(lease_token IS NOT NULL));
CREATE FUNCTION public.hoopdata_push_time_allowed(p_zone text,p_start integer,p_end integer,p_at timestamptz)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $quiet$
 SELECT CASE WHEN p_at IS NULL THEN false WHEN p_start IS NULL AND p_end IS NULL THEN true
 WHEN p_start IS NULL OR p_end IS NULL OR p_start NOT BETWEEN 0 AND 1439 OR p_end NOT BETWEEN 0 AND 1439 OR p_start=p_end THEN false
 WHEN p_start<p_end THEN NOT (m>=p_start AND m<p_end)
 ELSE NOT (m>=p_start OR m<p_end) END
 FROM pg_catalog.pg_timezone_names z
 CROSS JOIN LATERAL (SELECT extract(hour FROM p_at AT TIME ZONE z.name)::integer*60+extract(minute FROM p_at AT TIME ZONE z.name)::integer AS m) x
 WHERE z.name=p_zone;
$quiet$;
-- Conservative preview policy: 09:00 recipient-local game day, or 30 minutes before tipoff.
-- Only exact canonical watch targets are eligible, not fuzzy or legacy directory aliases.
CREATE FUNCTION public.hoopdata_game_push_event_time(p_user uuid,p_game uuid,p_kind text,p_tipoff timestamptz)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $event$
 SELECT ev.at
 FROM public.fan_live_games g
 JOIN public.hoopdata_game_push_preferences p ON p.user_id=p_user AND p.enabled
 JOIN public.user_preferences up ON up.user_id=p_user AND up.notifications_enabled
 JOIN pg_catalog.pg_timezone_names z ON z.name=p.timezone
 JOIN public.hoopdata_competition_mappings m ON m.league_id=g.league_id AND m.reviewed
 JOIN public.leagues l ON l.id=g.league_id AND l.active AND l.basketball_type=m.side
 CROSS JOIN LATERAL (SELECT CASE p_kind WHEN 'game-day' THEN (date_trunc('day',g.scheduled_at AT TIME ZONE z.name)+interval '9 hours') AT TIME ZONE z.name
 WHEN 'tip-off' THEN g.scheduled_at-interval '30 minutes' ELSE NULL END AS at) ev
 WHERE g.id=p_game AND g.status='scheduled' AND g.provider_source='api-sports-basketball' AND g.scheduled_at=p_tipoff
 AND g.team_id IS NOT NULL AND g.opponent_team_id IS NOT NULL AND ev.at<=g.scheduled_at-interval '30 minutes'
 AND public.hoopdata_push_time_allowed(p.timezone,p.quiet_start_minute,p.quiet_end_minute,ev.at) IS TRUE
 AND EXISTS(SELECT 1 FROM public.user_watchlists w WHERE w.user_id=p_user AND w.notify AND
 ((w.target_type='team' AND w.target_id IN (g.team_id,g.opponent_team_id)) OR (w.target_type='league' AND w.target_id=g.league_id)));
$event$;
-- Trusted worker must independently verify an actual notification-use grant before supplying its expiry.
CREATE FUNCTION public.hoopdata_queue_game_push(p_user uuid,p_game uuid,p_kind text,p_tipoff timestamptz,p_rights_expiry timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $queue$
DECLARE due_at timestamptz; t timestamptz:=clock_timestamp();
BEGIN
 IF p_tipoff IS NULL OR p_tipoff<=t OR p_tipoff>t+interval '7 days' OR p_rights_expiry IS NULL THEN RETURN false; END IF;
 PERFORM 1 FROM public.fan_live_games WHERE id=p_game AND scheduled_at=p_tipoff FOR SHARE;
 IF NOT FOUND THEN RETURN false; END IF;
 due_at:=public.hoopdata_game_push_event_time(p_user,p_game,p_kind,p_tipoff);
 IF due_at IS NULL OR due_at<t-interval '10 minutes' OR p_rights_expiry<=greatest(t,due_at) THEN RETURN false; END IF;
 INSERT INTO public.hoopdata_game_push_outbox(user_id,game_id,event_kind,scheduled_tipoff,available_at,rights_expires_at)
 VALUES(p_user,p_game,p_kind,p_tipoff,due_at,p_rights_expiry)
 ON CONFLICT(user_id,game_id,event_kind) DO UPDATE SET scheduled_tipoff=excluded.scheduled_tipoff,available_at=excluded.available_at,
 rights_expires_at=excluded.rights_expires_at,status='pending',
 next_attempt_at=CASE WHEN public.hoopdata_game_push_outbox.scheduled_tipoff=excluded.scheduled_tipoff THEN public.hoopdata_game_push_outbox.next_attempt_at ELSE NULL END
 WHERE public.hoopdata_game_push_outbox.status='pending' OR (public.hoopdata_game_push_outbox.status='cancelled' AND public.hoopdata_game_push_outbox.attempts=0);
 RETURN FOUND;
END;
$queue$;
CREATE FUNCTION public.hoopdata_cancel_invalid_game_push(p_game uuid)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $cancel$
DECLARE n integer;
BEGIN
 UPDATE public.hoopdata_game_push_outbox o SET status='cancelled',next_attempt_at=NULL
 WHERE o.game_id=p_game AND o.status='pending' AND (o.rights_expires_at IS NULL OR o.rights_expires_at<=clock_timestamp() OR
 o.available_at<clock_timestamp()-interval '10 minutes' OR o.scheduled_tipoff<=clock_timestamp() OR
 public.hoopdata_game_push_event_time(o.user_id,o.game_id,o.event_kind,o.scheduled_tipoff) IS DISTINCT FROM o.available_at);
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END;
$cancel$;
-- An expired sending lease is an uncertain delivery, never automatically retried.
CREATE FUNCTION public.hoopdata_claim_game_push()
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $claim$
DECLARE o public.hoopdata_game_push_outbox%ROWTYPE; t timestamptz:=clock_timestamp();
BEGIN
 UPDATE public.hoopdata_game_push_outbox x SET status='failed',lease_until=NULL,lease_token=NULL,next_attempt_at=NULL
 WHERE x.id IN (SELECT id FROM public.hoopdata_game_push_outbox WHERE status='sending' AND lease_until<=t ORDER BY lease_until LIMIT 100 FOR UPDATE SKIP LOCKED);
 SELECT x.* INTO o FROM public.hoopdata_game_push_outbox x JOIN public.hoopdata_game_push_preferences p ON p.user_id=x.user_id
 WHERE x.status='pending' AND x.attempts<5 AND x.available_at BETWEEN t-interval '10 minutes' AND t
 AND coalesce(x.next_attempt_at,x.available_at)<=t AND x.scheduled_tipoff>t AND x.rights_expires_at>t
 AND public.hoopdata_game_push_event_time(x.user_id,x.game_id,x.event_kind,x.scheduled_tipoff)=x.available_at
 AND public.hoopdata_push_time_allowed(p.timezone,p.quiet_start_minute,p.quiet_end_minute,t) IS TRUE
 ORDER BY x.available_at,x.id LIMIT 1 FOR UPDATE OF x SKIP LOCKED;
 IF NOT FOUND THEN RETURN NULL; END IF;
 UPDATE public.hoopdata_game_push_outbox SET status='sending',attempts=attempts+1,lease_until=t+interval '2 minutes',lease_token=gen_random_uuid() WHERE id=o.id RETURNING * INTO o;
 RETURN jsonb_build_object('id',o.id,'leaseToken',o.lease_token,'userId',o.user_id,'gameId',o.game_id,'eventKind',o.event_kind,'scheduledTipoff',o.scheduled_tipoff);
END;
$claim$;
CREATE FUNCTION public.hoopdata_validate_game_push_lease(p_id uuid,p_token uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $validate$
 SELECT EXISTS(SELECT 1 FROM public.hoopdata_game_push_outbox o JOIN public.hoopdata_game_push_preferences p ON p.user_id=o.user_id
 WHERE o.id=p_id AND o.status='sending' AND o.lease_token=p_token AND o.lease_until>statement_timestamp() AND o.scheduled_tipoff>statement_timestamp()
 AND o.rights_expires_at>statement_timestamp() AND o.available_at>=statement_timestamp()-interval '10 minutes'
 AND public.hoopdata_game_push_event_time(o.user_id,o.game_id,o.event_kind,o.scheduled_tipoff)=o.available_at
 AND public.hoopdata_push_time_allowed(p.timezone,p.quiet_start_minute,p.quiet_end_minute,statement_timestamp()) IS TRUE);
$validate$;
-- "accepted" means the delivery transport accepted the notification, not proof of device receipt.
-- Retry only after a definitive no-send response. Unknown outcomes stop to prevent duplicates.
CREATE FUNCTION public.hoopdata_finish_game_push(p_id uuid,p_token uuid,p_outcome text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $finish$
DECLARE o public.hoopdata_game_push_outbox%ROWTYPE; t timestamptz:=clock_timestamp(); next_state text;
BEGIN
 IF p_outcome IS NULL OR p_outcome NOT IN ('accepted','confirmed-not-sent','uncertain','cancelled') THEN RETURN false; END IF;
 SELECT * INTO o FROM public.hoopdata_game_push_outbox WHERE id=p_id AND status='sending' AND lease_token=p_token AND lease_until>t FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 next_state:=CASE WHEN p_outcome='accepted' THEN 'sent' WHEN p_outcome='cancelled' THEN 'cancelled'
 WHEN p_outcome='confirmed-not-sent' AND o.attempts<5 AND t+interval '1 minute'<least(o.available_at+interval '10 minutes',o.scheduled_tipoff,o.rights_expires_at)
 AND public.hoopdata_validate_game_push_lease(p_id,p_token) THEN 'pending' ELSE 'failed' END;
 UPDATE public.hoopdata_game_push_outbox SET status=next_state,lease_until=NULL,lease_token=NULL,
 sent_at=CASE WHEN next_state='sent' THEN t ELSE NULL END,next_attempt_at=CASE WHEN next_state='pending' THEN t+interval '1 minute' ELSE NULL END WHERE id=p_id;
 RETURN FOUND;
END;
$finish$;
REVOKE ALL ON FUNCTION public.hoopdata_push_time_allowed(text,integer,integer,timestamptz),public.hoopdata_game_push_event_time(uuid,uuid,text,timestamptz),public.hoopdata_queue_game_push(uuid,uuid,text,timestamptz,timestamptz),public.hoopdata_cancel_invalid_game_push(uuid),public.hoopdata_claim_game_push(),public.hoopdata_validate_game_push_lease(uuid,uuid),public.hoopdata_finish_game_push(uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hoopdata_push_time_allowed(text,integer,integer,timestamptz),public.hoopdata_game_push_event_time(uuid,uuid,text,timestamptz),public.hoopdata_queue_game_push(uuid,uuid,text,timestamptz,timestamptz),public.hoopdata_cancel_invalid_game_push(uuid),public.hoopdata_claim_game_push(),public.hoopdata_validate_game_push_lease(uuid,uuid),public.hoopdata_finish_game_push(uuid,uuid,text) TO service_role;
COMMIT;
