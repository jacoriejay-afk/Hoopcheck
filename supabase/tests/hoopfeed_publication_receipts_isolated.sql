\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.feed_posts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),author_id uuid NOT NULL,body text NOT NULL,image_url text,image_urls jsonb NOT NULL DEFAULT '[]',video_url text,post_kind text,poll_options jsonb,topic_tag text,game_day_team text,game_day_opponent text,game_day_score_for int,game_day_score_against int,location_country text,community_visible boolean NOT NULL DEFAULT false,post_location text,club_id uuid,womens_club_id uuid,league_id uuid,womens_league_id uuid,status text,expires_at timestamptz);
\ir ../candidates/hoopfeed_publication_receipts_review_only.sql
INSERT INTO auth.users VALUES ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
DO $test$
DECLARE a uuid:='00000000-0000-4000-8000-000000000001'; b uuid:='00000000-0000-4000-8000-000000000002'; k uuid:='10000000-0000-4000-8000-000000000001'; k2 uuid:='10000000-0000-4000-8000-000000000002'; payload jsonb; first jsonb; second jsonb;
BEGIN
 payload:=jsonb_build_object('author_id',a,'body','test','status','approved','post_kind','discussion','image_urls','[]'::jsonb);
 first:=public.hoopfeed_publish_once(a,k,repeat('a',64),payload);
 second:=public.hoopfeed_publish_once(a,k,repeat('a',64),payload);
 ASSERT first->>'state'='created' AND second->>'state'='replayed' AND first->>'post_id'=second->>'post_id';
 ASSERT (SELECT count(*) FROM public.feed_posts)=1;
 ASSERT public.hoopfeed_publish_once(a,k,repeat('b',64),payload)->>'state'='conflict';
 ASSERT public.hoopfeed_publication_receipt(b,k,false)->>'state'='missing';
 ASSERT public.hoopfeed_publication_receipt(a,k,true)->>'state'='published';
 ASSERT public.hoopfeed_publication_receipt(a,k2,true)->>'state'='cancelled';
 ASSERT public.hoopfeed_publish_once(a,k2,repeat('a',64),payload)->>'state'='cancelled';
 DELETE FROM public.feed_posts WHERE id=(first->>'post_id')::uuid;
 ASSERT public.hoopfeed_publish_once(a,k,repeat('a',64),payload)->>'state'='removed';
 ASSERT (SELECT count(*) FROM public.feed_posts)=0;
 ASSERT NOT has_function_privilege('authenticated','public.hoopfeed_publish_once(uuid,uuid,text,jsonb)','EXECUTE');
 ASSERT NOT has_table_privilege('authenticated','hoopcheck_feed_publication.receipts','SELECT');
END $test$;
ROLLBACK;
