-- Review-only; not a hosted migration.
CREATE SCHEMA hoopcheck_feed_publication;
REVOKE ALL ON SCHEMA hoopcheck_feed_publication FROM PUBLIC,anon,authenticated;
CREATE TABLE hoopcheck_feed_publication.receipts(
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 publication_key uuid NOT NULL,
 post_id uuid REFERENCES public.feed_posts(id) ON DELETE SET NULL,
 digest text CHECK(digest IS NULL OR digest ~ '^[0-9a-f]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(owner_id,publication_key),CHECK(digest IS NOT NULL OR post_id IS NULL)
);
ALTER TABLE hoopcheck_feed_publication.receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON hoopcheck_feed_publication.receipts FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.hoopfeed_publication_receipt(p_owner uuid,p_key uuid,p_cancel_missing boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE receipt hoopcheck_feed_publication.receipts%ROWTYPE;
BEGIN
 IF current_setting('request.jwt.claims',true)::jsonb->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
 IF p_owner IS NULL OR p_key IS NULL OR p_cancel_missing IS NULL THEN RAISE EXCEPTION 'Invalid publication'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_owner::text||':'||p_key::text,0));
 SELECT * INTO receipt FROM hoopcheck_feed_publication.receipts WHERE owner_id=p_owner AND publication_key=p_key;
 IF NOT FOUND THEN
  IF NOT p_cancel_missing THEN RETURN jsonb_build_object('state','missing'); END IF;
  INSERT INTO hoopcheck_feed_publication.receipts(owner_id,publication_key) VALUES(p_owner,p_key);
  RETURN jsonb_build_object('state','cancelled');
 END IF;
 RETURN jsonb_build_object('state',CASE WHEN receipt.digest IS NULL THEN 'cancelled' WHEN receipt.post_id IS NULL THEN 'removed' ELSE 'published' END,'post_id',receipt.post_id);
END $f$;
CREATE FUNCTION public.hoopfeed_publish_once(p_owner uuid,p_key uuid,p_digest text,p_post jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f$
DECLARE receipt hoopcheck_feed_publication.receipts%ROWTYPE; payload public.feed_posts%ROWTYPE; new_id uuid;
BEGIN
 IF current_setting('request.jwt.claims',true)::jsonb->>'role' IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
 IF p_owner IS NULL OR p_key IS NULL OR p_digest IS NULL OR p_digest !~ '^[0-9a-f]{64}$' OR jsonb_typeof(p_post) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid publication'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_post) AS k(key) WHERE key NOT IN ('author_id','body','image_url','image_urls','video_url','post_kind','poll_options','topic_tag','game_day_team','game_day_opponent','game_day_score_for','game_day_score_against','location_country','community_visible','post_location','club_id','womens_club_id','league_id','womens_league_id','status','expires_at')) THEN RAISE EXCEPTION 'Unexpected publication field'; END IF;
 payload:=jsonb_populate_record(NULL::public.feed_posts,p_post);
 IF payload.author_id IS DISTINCT FROM p_owner OR payload.status IS DISTINCT FROM 'approved' OR payload.post_kind IS NULL OR payload.post_kind NOT IN ('discussion','poll','news') OR payload.expires_at IS NOT NULL THEN RAISE EXCEPTION 'Invalid publication scope'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_owner::text||':'||p_key::text,0));
 SELECT * INTO receipt FROM hoopcheck_feed_publication.receipts WHERE owner_id=p_owner AND publication_key=p_key;
 IF FOUND THEN
  RETURN jsonb_build_object('state',CASE WHEN receipt.digest IS NULL THEN 'cancelled' WHEN receipt.digest<>p_digest THEN 'conflict' WHEN receipt.post_id IS NULL THEN 'removed' ELSE 'replayed' END,'post_id',receipt.post_id);
 END IF;
 INSERT INTO public.feed_posts(author_id,body,image_url,image_urls,video_url,post_kind,poll_options,topic_tag,game_day_team,game_day_opponent,game_day_score_for,game_day_score_against,location_country,community_visible,post_location,club_id,womens_club_id,league_id,womens_league_id,status,expires_at)
 VALUES(p_owner,payload.body,payload.image_url,coalesce(payload.image_urls,'[]'::jsonb),payload.video_url,payload.post_kind,payload.poll_options,payload.topic_tag,payload.game_day_team,payload.game_day_opponent,payload.game_day_score_for,payload.game_day_score_against,payload.location_country,coalesce(payload.community_visible,false),payload.post_location,payload.club_id,payload.womens_club_id,payload.league_id,payload.womens_league_id,'approved',NULL)
 RETURNING id INTO new_id;
 INSERT INTO hoopcheck_feed_publication.receipts(owner_id,publication_key,post_id,digest) VALUES(p_owner,p_key,new_id,p_digest);
 RETURN jsonb_build_object('state','created','post_id',new_id);
END $f$;
REVOKE ALL ON FUNCTION public.hoopfeed_publication_receipt(uuid,uuid,boolean),public.hoopfeed_publish_once(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hoopfeed_publication_receipt(uuid,uuid,boolean),public.hoopfeed_publish_once(uuid,uuid,text,jsonb) TO service_role;
