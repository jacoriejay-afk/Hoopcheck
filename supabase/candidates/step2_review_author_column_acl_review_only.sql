-- REVIEW ONLY. Do not apply on any hosted database.
-- Known incompatibility: account-snapshot-export uses author_id SELECT/filter.
-- Review all other raw callers, views, functions, update/write and PostgREST
-- paths before approval. This is a direct-column ACL candidate, not full anonymity.
-- Exact PG17 baseline columns; abort on any unexpected schema/privilege drift.
BEGIN;
SET LOCAL lock_timeout='4s';
SET LOCAL statement_timeout='25s';
DO $pre$
DECLARE target record; actual text[];
BEGIN
 FOR target IN SELECT * FROM (VALUES
 ('reviews',ARRAY['id','coach_id','team_id','league_id','overall_rating','communication_rating','professionalism_rating','development_rating','payment_rating','title','body','status','created_at','updated_at','is_anonymous','player_season','legal_review_required','pay_on_time_rating','housing_rating','medical_support_rating','coaching_quality_rating','facilities_rating','playing_time_honesty_rating']),
 ('womens_team_reviews',ARRAY['id','womens_team_id','overall_rating','communication_rating','professionalism_rating','development_rating','payment_rating','title','body','status','is_anonymous','created_at'])
 ) AS v(name,safe_columns)
 LOOP
  SELECT array_agg(attname::text ORDER BY attname::text COLLATE "C") INTO actual
  FROM pg_attribute WHERE attrelid=format('public.%I',target.name)::regclass AND attnum>0 AND NOT attisdropped;
  IF actual IS DISTINCT FROM ARRAY(SELECT x FROM unnest(target.safe_columns||ARRAY['author_id']) x ORDER BY x COLLATE "C")
   OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=format('public.%I',target.name)::regclass AND relrowsecurity)
   OR NOT has_table_privilege('anon',format('public.%I',target.name),'SELECT')
   OR NOT has_table_privilege('authenticated',format('public.%I',target.name),'SELECT')
   OR NOT has_column_privilege('service_role',format('public.%I',target.name),'author_id','SELECT')
  THEN RAISE EXCEPTION 'Review ACL baseline drift: %',target.name; END IF;
 END LOOP;
END $pre$;
REVOKE SELECT ON TABLE public.reviews FROM PUBLIC,anon,authenticated;
REVOKE SELECT (author_id) ON TABLE public.reviews FROM PUBLIC,anon,authenticated;
GRANT SELECT (id,coach_id,team_id,league_id,overall_rating,communication_rating,professionalism_rating,development_rating,payment_rating,title,body,status,created_at,updated_at,is_anonymous,player_season,legal_review_required,pay_on_time_rating,housing_rating,medical_support_rating,coaching_quality_rating,facilities_rating,playing_time_honesty_rating) ON TABLE public.reviews TO anon,authenticated;
REVOKE SELECT ON TABLE public.womens_team_reviews FROM PUBLIC,anon,authenticated;
REVOKE SELECT (author_id) ON TABLE public.womens_team_reviews FROM PUBLIC,anon,authenticated;
GRANT SELECT (id,womens_team_id,overall_rating,communication_rating,professionalism_rating,development_rating,payment_rating,title,body,status,is_anonymous,created_at) ON TABLE public.womens_team_reviews TO anon,authenticated;
DO $post$
DECLARE t text; r text;
BEGIN
 FOREACH t IN ARRAY ARRAY['reviews','womens_team_reviews'] LOOP
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF has_table_privilege(r,format('public.%I',t),'SELECT')
    OR has_column_privilege(r,format('public.%I',t),'author_id','SELECT')
    OR NOT has_column_privilege(r,format('public.%I',t),'id','SELECT')
   THEN RAISE EXCEPTION 'Review ACL postcondition failed: % %',t,r; END IF;
  END LOOP;
  IF NOT has_column_privilege('service_role',format('public.%I',t),'author_id','SELECT')
  THEN RAISE EXCEPTION 'Service attribution regressed: %',t; END IF;
 END LOOP;
END $post$;
COMMIT;
