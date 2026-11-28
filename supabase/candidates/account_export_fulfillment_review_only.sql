-- REVIEW ONLY. Do not apply to hosted environments or register a live scheduler.
-- Candidate scope is explicitly incomplete until disclosure policy and schema acceptance.
BEGIN;
CREATE SCHEMA hoopcheck_export_private;
REVOKE ALL ON SCHEMA hoopcheck_export_private FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA hoopcheck_export_private TO authenticated,service_role;
CREATE TABLE hoopcheck_export_private.policy (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 enabled boolean NOT NULL DEFAULT false,
 scope_version text,
 download_ttl interval CHECK(download_ttl > interval '0'),
 max_attempts integer CHECK(max_attempts BETWEEN 1 AND 20),
 retry_delay interval CHECK(retry_delay > interval '0'),
 request_interval interval CHECK(request_interval > interval '0'),
 max_rows integer CHECK(max_rows BETWEEN 1 AND 1000000),
 CHECK(NOT enabled OR (scope_version='owned-records-v1' AND download_ttl IS NOT NULL AND max_attempts IS NOT NULL AND retry_delay IS NOT NULL AND request_interval IS NOT NULL AND max_rows IS NOT NULL))
);
INSERT INTO hoopcheck_export_private.policy(singleton) VALUES(true);
CREATE TABLE hoopcheck_export_private.jobs (
 id uuid PRIMARY KEY,
 owner_id uuid NOT NULL,
 scope_version text NOT NULL,
 state text NOT NULL CHECK(state IN ('queued','ready','failed','cancelled','expired')),
 attempts integer NOT NULL DEFAULT 0,
 next_attempt timestamptz NOT NULL DEFAULT clock_timestamp(),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 finished_at timestamptz,
 expires_at timestamptz,
 row_count bigint NOT NULL DEFAULT 0 CHECK(row_count>=0),
 CHECK(state<>'ready' OR expires_at IS NOT NULL)
);
CREATE INDEX export_owner_request_history ON hoopcheck_export_private.jobs(owner_id,created_at DESC);
CREATE UNIQUE INDEX export_one_active_per_owner ON hoopcheck_export_private.jobs(owner_id) WHERE state IN ('queued','ready');
CREATE TABLE hoopcheck_export_private.records (
 job_id uuid NOT NULL REFERENCES hoopcheck_export_private.jobs(id) ON DELETE CASCADE,
 ordinal bigint NOT NULL CHECK(ordinal>0),
 section text NOT NULL,
 payload jsonb NOT NULL,
 PRIMARY KEY(job_id,ordinal)
);
CREATE TABLE hoopcheck_export_private.events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 job_id uuid NOT NULL REFERENCES hoopcheck_export_private.jobs(id),
 event text NOT NULL CHECK(event IN ('queued','ready','retry','failed','cancelled','expired','download')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE hoopcheck_export_private.policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE hoopcheck_export_private.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hoopcheck_export_private.records ENABLE ROW LEVEL SECURITY;
ALTER TABLE hoopcheck_export_private.events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA hoopcheck_export_private FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA hoopcheck_export_private FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION hoopcheck_export_private.verified_owner() RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $f$
DECLARE uid uuid:=auth.uid();
BEGIN
 IF uid IS NULL OR auth.jwt()->>'role' IS DISTINCT FROM 'authenticated'
 OR coalesce(auth.jwt()->>'is_anonymous','false')<>'false' OR auth.jwt() ? 'client_id'
 OR NOT coalesce(public.confirm_active_account_session(),false)
 OR NOT coalesce(hoopcheck_security.mfa_satisfied(),false)
 OR NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=uid AND u.email_confirmed_at IS NOT NULL)
 OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=uid AND p.moderation_status IN ('normal','warned','flagged'))
 THEN RAISE EXCEPTION 'Verified active owner required' USING ERRCODE='42501'; END IF;
 RETURN uid;
END $f$;
REVOKE ALL ON FUNCTION hoopcheck_export_private.verified_owner() FROM PUBLIC,anon,authenticated,service_role;

-- Expiry scrubs content, retaining only controlled lifecycle evidence.
CREATE FUNCTION hoopcheck_export_private.expire_job(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
BEGIN
 UPDATE hoopcheck_export_private.jobs SET state='expired',row_count=0 WHERE id=p_id AND state='ready' AND expires_at<=clock_timestamp();
 IF FOUND THEN
  DELETE FROM hoopcheck_export_private.records WHERE job_id=p_id;
  INSERT INTO hoopcheck_export_private.events(job_id,event) VALUES(p_id,'expired');
 END IF;
END $f$;
REVOKE ALL ON FUNCTION hoopcheck_export_private.expire_job(uuid) FROM PUBLIC,anon,authenticated,service_role;

-- A caller-supplied job UUID is an idempotency key, never an owner identifier.
CREATE FUNCTION hoopcheck_export_private.owner_action(p_action text,p_job uuid,p_after bigint DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE uid uuid:=hoopcheck_export_private.verified_owner(); pol hoopcheck_export_private.policy%ROWTYPE;
 j hoopcheck_export_private.jobs%ROWTYPE; page jsonb; last_ordinal bigint;
BEGIN
 IF p_job IS NULL OR p_after IS NULL OR p_after<0 OR p_action IS NULL OR p_action NOT IN ('request','status','cancel','download') OR (p_action<>'download' AND p_after<>0)
 THEN RAISE EXCEPTION 'Invalid export action'; END IF;
 SELECT * INTO STRICT pol FROM hoopcheck_export_private.policy WHERE singleton FOR SHARE;
 IF NOT pol.enabled THEN RAISE EXCEPTION 'Export disabled' USING ERRCODE='42501'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text,771));
 FOR j IN SELECT * FROM hoopcheck_export_private.jobs WHERE owner_id=uid AND state='ready' AND expires_at<=clock_timestamp() LOOP
  PERFORM hoopcheck_export_private.expire_job(j.id);
 END LOOP;
 SELECT * INTO j FROM hoopcheck_export_private.jobs WHERE id=p_job AND owner_id=uid FOR UPDATE;
 IF NOT FOUND AND p_action='request' THEN
  SELECT * INTO j FROM hoopcheck_export_private.jobs WHERE owner_id=uid AND state IN ('queued','ready') FOR UPDATE;
  IF NOT FOUND THEN
   IF EXISTS(SELECT 1 FROM hoopcheck_export_private.jobs WHERE owner_id=uid AND created_at>clock_timestamp()-pol.request_interval)
   THEN RAISE EXCEPTION 'Export request unavailable' USING ERRCODE='42501'; END IF;
   INSERT INTO hoopcheck_export_private.jobs(id,owner_id,scope_version,state) VALUES(p_job,uid,pol.scope_version,'queued') ON CONFLICT(id) DO NOTHING RETURNING * INTO j;
   IF NOT FOUND THEN RAISE EXCEPTION 'Export unavailable' USING ERRCODE='42501'; END IF;
   INSERT INTO hoopcheck_export_private.events(job_id,event) VALUES(j.id,'queued');
  END IF;
 ELSIF NOT FOUND THEN RAISE EXCEPTION 'Export unavailable' USING ERRCODE='42501';
 END IF;
 IF p_action='cancel' AND j.state IN ('queued','ready') THEN
  UPDATE hoopcheck_export_private.jobs SET state='cancelled',finished_at=clock_timestamp(),row_count=0 WHERE id=j.id RETURNING * INTO j;
  DELETE FROM hoopcheck_export_private.records WHERE job_id=j.id;
  INSERT INTO hoopcheck_export_private.events(job_id,event) VALUES(j.id,'cancelled');
 END IF;
 IF p_action='download' THEN
  IF j.state<>'ready' OR j.scope_version IS DISTINCT FROM pol.scope_version OR j.expires_at<=clock_timestamp() OR p_after>j.row_count
  THEN RAISE EXCEPTION 'Export unavailable' USING ERRCODE='42501'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('ordinal',r.ordinal,'section',r.section,'data',r.payload) ORDER BY r.ordinal),'[]'::jsonb),max(r.ordinal)
  INTO page,last_ordinal FROM (SELECT ordinal,section,payload FROM hoopcheck_export_private.records WHERE job_id=j.id AND ordinal>p_after ORDER BY ordinal LIMIT 50) r;
  IF jsonb_array_length(page)<>least(50,j.row_count-p_after) OR (last_ordinal IS NOT NULL AND last_ordinal<>p_after+jsonb_array_length(page))
  THEN RAISE EXCEPTION 'Export integrity check failed'; END IF;
  IF j.expires_at<=clock_timestamp() OR hoopcheck_export_private.verified_owner() IS DISTINCT FROM uid
  THEN RAISE EXCEPTION 'Export unavailable' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM hoopcheck_export_private.events WHERE job_id=j.id AND event='download') THEN
   INSERT INTO hoopcheck_export_private.events(job_id,event) VALUES(j.id,'download');
  END IF;
  RETURN jsonb_build_object('id',j.id,'scope',j.scope_version,'complete',false,'rows',page,'next_after',CASE WHEN last_ordinal<j.row_count THEN last_ordinal ELSE NULL END,'row_count',j.row_count,'expires_at',j.expires_at);
 END IF;
 RETURN jsonb_build_object('id',j.id,'state',j.state,'scope',j.scope_version,'complete',false,'row_count',j.row_count,'expires_at',j.expires_at);
END $f$;
REVOKE ALL ON FUNCTION hoopcheck_export_private.owner_action(text,uuid,bigint) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hoopcheck_export_private.owner_action(text,uuid,bigint) TO authenticated;
CREATE FUNCTION public.account_export_job(p_action text,p_job uuid,p_after bigint DEFAULT 0) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $f$
 SELECT hoopcheck_export_private.owner_action(p_action,p_job,p_after)
$f$;
REVOKE ALL ON FUNCTION public.account_export_job(text,uuid,bigint) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.account_export_job(text,uuid,bigint) TO authenticated;

-- A worker transaction claims one job with SKIP LOCKED. Snapshot and checkpoint
-- commit atomically; interruption rolls back both. No data is sent to a provider.
CREATE FUNCTION hoopcheck_export_private.work_one() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE pol hoopcheck_export_private.policy%ROWTYPE; j hoopcheck_export_private.jobs%ROWTYPE; n bigint; expired_id uuid;
BEGIN
 IF auth.jwt()->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Worker required' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT pol FROM hoopcheck_export_private.policy WHERE singleton FOR SHARE;
 -- Expiration remains available after disabling new fulfillment.
 FOR expired_id IN SELECT id FROM hoopcheck_export_private.jobs WHERE state='ready' AND expires_at<=clock_timestamp() ORDER BY expires_at LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
  PERFORM hoopcheck_export_private.expire_job(expired_id);
 END LOOP;
 IF NOT pol.enabled THEN RETURN 'disabled'; END IF;
 SELECT * INTO j FROM hoopcheck_export_private.jobs WHERE state='queued' AND next_attempt<=clock_timestamp() ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN RETURN 'idle'; END IF;
 IF j.scope_version IS DISTINCT FROM pol.scope_version OR NOT EXISTS(SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id WHERE p.id=j.owner_id AND p.moderation_status IN ('normal','warned','flagged') AND u.email_confirmed_at IS NOT NULL)
 THEN
  UPDATE hoopcheck_export_private.jobs SET state='failed',finished_at=clock_timestamp() WHERE id=j.id;
  INSERT INTO hoopcheck_export_private.events(job_id,event) VALUES(j.id,'failed'); RETURN 'failed';
 END IF;
 UPDATE hoopcheck_export_private.jobs SET attempts=attempts+1 WHERE id=j.id RETURNING * INTO j;
 BEGIN
  INSERT INTO hoopcheck_export_private.records(job_id,ordinal,section,payload)
  SELECT j.id,row_number() OVER(ORDER BY q.section,q.payload::text),q.section,q.payload FROM (
 SELECT 'profile'::text AS section, to_jsonb(r) AS payload FROM (SELECT id,display_name,username,first_name,last_name,bio,account_type,country,current_country,current_team,years_pro,profile_visibility,free_agent,hometown,nationality,birthdate,gender,created_at,updated_at,agreed_to_terms,terms_accepted_at,terms_version,theme_preference,preferred_language,height FROM public.profiles WHERE id=j.owner_id) r
 UNION ALL
 SELECT 'reviews'::text AS section, to_jsonb(r) AS payload FROM (SELECT id,title,body,status,overall_rating,communication_rating,professionalism_rating,development_rating,payment_rating,player_season,team_id,coach_id,league_id,is_anonymous,created_at,updated_at,pay_on_time_rating,housing_rating,medical_support_rating,coaching_quality_rating,facilities_rating,playing_time_honesty_rating FROM public.reviews WHERE author_id=j.owner_id) r
 UNION ALL
 SELECT 'womens_reviews'::text AS section, to_jsonb(r) AS payload FROM (SELECT id,title,body,status,overall_rating,communication_rating,professionalism_rating,development_rating,payment_rating,womens_team_id,is_anonymous,created_at FROM public.womens_team_reviews WHERE author_id=j.owner_id) r
 UNION ALL
 SELECT 'player_posts'::text AS section, to_jsonb(r) AS payload FROM (SELECT id,body,status,created_at,expires_at,post_kind,post_location,location_country,poll_options FROM public.feed_posts WHERE author_id=j.owner_id) r
 UNION ALL
 SELECT 'fan_posts'::text AS section, to_jsonb(r) AS payload FROM (SELECT id,team_id,womens_team_id,body,status,created_at,expires_at FROM public.fan_feed_posts WHERE author_id=j.owner_id) r
 UNION ALL
 SELECT 'feed_comments'::text AS section, to_jsonb(r) AS payload FROM (SELECT id,post_id,body,created_at,parent_id FROM public.feed_post_comments WHERE author_id=j.owner_id) r
 UNION ALL
 SELECT 'fan_comments'::text AS section, to_jsonb(r) AS payload FROM (SELECT id,post_id,body,created_at FROM public.fan_feed_comments WHERE author_id=j.owner_id) r
 UNION ALL
 SELECT 'review_comments'::text AS section, to_jsonb(r) AS payload FROM (SELECT id,review_id,body,status,created_at FROM public.review_comments WHERE author_id=j.owner_id) r
 UNION ALL
 SELECT 'sent_messages'::text AS section, to_jsonb(r) AS payload FROM (SELECT id,request_id,body,created_at FROM public.player_contact_messages WHERE sender_id=j.owner_id) r
 UNION ALL
 SELECT 'outgoing_contact_requests'::text AS section, to_jsonb(r) AS payload FROM (SELECT id,message,status,created_at,responded_at FROM public.player_contact_requests WHERE requester_id=j.owner_id) r
 UNION ALL
 SELECT 'group_posts'::text AS section, to_jsonb(r) AS payload FROM (SELECT id,channel_id,body,created_at FROM public.hoop_group_posts WHERE author_id=j.owner_id) r
 UNION ALL
 SELECT 'group_memberships'::text AS section, to_jsonb(r) AS payload FROM (SELECT space_id,joined_at FROM public.hoop_group_members WHERE user_id=j.owner_id) r
 UNION ALL
 SELECT 'owned_groups'::text AS section, to_jsonb(r) AS payload FROM (SELECT id,slug,name,description,category,created_at,accent_color,icon_key FROM public.hoop_group_spaces WHERE owner_id=j.owner_id) r
 UNION ALL
 SELECT 'club_group_memberships'::text AS section, to_jsonb(r) AS payload FROM (SELECT team_id,joined_at FROM public.team_fan_group_members WHERE user_id=j.owner_id) r
 UNION ALL
 SELECT 'club_group_posts'::text AS section, to_jsonb(r) AS payload FROM (SELECT id,team_id,body,created_at,status FROM public.team_fan_group_posts WHERE author_id=j.owner_id) r
 UNION ALL
 SELECT 'club_group_comments'::text AS section, to_jsonb(r) AS payload FROM (SELECT id,post_id,body,created_at FROM public.team_fan_group_comments WHERE author_id=j.owner_id) r
 UNION ALL
 SELECT 'subscriptions'::text AS section, to_jsonb(r) AS payload FROM (SELECT id,plan,status,access_status,current_period_end,cancel_at_period_end,billing_interval,created_at,updated_at FROM public.subscriptions WHERE user_id=j.owner_id) r
 UNION ALL
 SELECT 'notification_metadata'::text AS section, to_jsonb(r) AS payload FROM (SELECT id,target_type,notification_type,read_at,created_at FROM public.notifications WHERE user_id=j.owner_id) r
 UNION ALL
 SELECT 'privacy_requests'::text AS section, to_jsonb(r) AS payload FROM (SELECT id,request_type,status,created_at,updated_at,completed_at FROM public.privacy_requests WHERE requester_id=j.owner_id) r
 UNION ALL
 SELECT 'support_requests'::text AS section, to_jsonb(r) AS payload FROM (SELECT id,subject,category,status,description,created_at,updated_at,resolved_at FROM public.support_tickets WHERE requester_id=j.owner_id) r
 UNION ALL
 SELECT 'support_messages'::text AS section, to_jsonb(r) AS payload FROM (SELECT id,ticket_id,body,created_at FROM public.support_ticket_messages WHERE author_id=j.owner_id) r
 UNION ALL
 SELECT 'career_history'::text AS section, to_jsonb(r) AS payload FROM (SELECT id,team_id,team_name,league_name,country,seasons,stop_order,is_public,created_at,updated_at FROM public.player_career_stops WHERE player_id=j.owner_id) r
 UNION ALL
 SELECT 'bookmarks'::text AS section, to_jsonb(r) AS payload FROM (SELECT post_id,created_at FROM public.feed_post_bookmarks WHERE user_id=j.owner_id) r
 UNION ALL
 SELECT 'checks'::text AS section, to_jsonb(r) AS payload FROM (SELECT id,post_id,created_at FROM public.feed_post_checks WHERE user_id=j.owner_id) r
 UNION ALL
 SELECT 'poll_votes'::text AS section, to_jsonb(r) AS payload FROM (SELECT post_id,option_index,created_at FROM public.feed_poll_votes WHERE user_id=j.owner_id) r
 UNION ALL
 SELECT 'posting_activity'::text AS section, to_jsonb(r) AS payload FROM (SELECT activity_date,created_at FROM public.feed_posting_activity WHERE user_id=j.owner_id) r
 UNION ALL
 SELECT 'live_chat_messages'::text AS section, to_jsonb(r) AS payload FROM (SELECT id,game_id,body,created_at FROM public.fan_live_chat_messages WHERE user_id=j.owner_id) r
  ) q LIMIT pol.max_rows+1;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n>pol.max_rows THEN RAISE EXCEPTION 'Export exceeds approved row limit'; END IF;
  UPDATE hoopcheck_export_private.jobs SET state='ready',row_count=n,finished_at=clock_timestamp(),expires_at=clock_timestamp()+pol.download_ttl WHERE id=j.id;
  INSERT INTO hoopcheck_export_private.events(job_id,event) VALUES(j.id,'ready');
  RETURN 'ready';
 EXCEPTION WHEN OTHERS THEN
  -- Inner transaction rolls back all records. Never log SQLERRM or payload.
  UPDATE hoopcheck_export_private.jobs SET state=CASE WHEN attempts>=pol.max_attempts THEN 'failed' ELSE 'queued' END,
    next_attempt=clock_timestamp()+pol.retry_delay,finished_at=CASE WHEN attempts>=pol.max_attempts THEN clock_timestamp() ELSE NULL END WHERE id=j.id;
  INSERT INTO hoopcheck_export_private.events(job_id,event) VALUES(j.id,CASE WHEN j.attempts>=pol.max_attempts THEN 'failed' ELSE 'retry' END);
  RETURN CASE WHEN j.attempts>=pol.max_attempts THEN 'failed' ELSE 'retry' END;
 END;
END $f$;
REVOKE ALL ON FUNCTION hoopcheck_export_private.work_one() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hoopcheck_export_private.work_one() TO service_role;
CREATE FUNCTION public.run_account_export_worker() RETURNS text LANGUAGE sql SECURITY INVOKER SET search_path='' AS $f$
 SELECT hoopcheck_export_private.work_one()
$f$;
REVOKE ALL ON FUNCTION public.run_account_export_worker() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.run_account_export_worker() TO service_role;
COMMIT;
