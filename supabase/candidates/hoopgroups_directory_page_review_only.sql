-- Review-only, after private community access policies. Caller RLS is the
-- sole visibility authority; no service-role discovery or anonymous search.
BEGIN;
SET LOCAL lock_timeout='4s';
SET LOCAL statement_timeout='15s';
DO $guard$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_policy WHERE polrelid='public.hoop_group_spaces'::regclass AND polname='group_access_space_read' AND NOT polpermissive)
 OR NOT EXISTS(SELECT FROM pg_policy WHERE polrelid='public.hoop_group_channels'::regclass AND polname='group_access_channel_read' AND NOT polpermissive)
 OR NOT EXISTS(SELECT FROM pg_class WHERE oid='public.hoop_group_members'::regclass AND relrowsecurity)
 THEN RAISE EXCEPTION 'Review private community visibility first'; END IF;
END $guard$;
CREATE FUNCTION public.hoop_group_directory_page(p_query text DEFAULT '',p_mode text DEFAULT 'all',p_after uuid DEFAULT NULL,p_slug text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $f$
DECLARE uid uuid:=auth.uid(); q text:=lower(btrim(coalesce(p_query,''))); role_category text; result jsonb;
BEGIN
 IF uid IS NULL OR public.confirm_active_account_session() IS NOT TRUE OR hoopcheck_security.mfa_satisfied() IS NOT TRUE THEN RAISE EXCEPTION 'Verify account' USING ERRCODE='42501'; END IF;
 IF char_length(q)>80 OR p_mode IS NULL OR p_mode NOT IN ('all','joined','mine','recommended') OR (p_slug IS NOT NULL AND (p_slug !~ '^[a-z0-9-]{3,60}$' OR p_after IS NOT NULL OR p_mode<>'all' OR q<>'')) THEN RAISE EXCEPTION 'Invalid directory request' USING ERRCODE='22023'; END IF;
 SELECT CASE lower(p.account_type) WHEN 'player' THEN 'players' WHEN 'fan' THEN 'fans' WHEN 'coach' THEN 'coaches' WHEN 'agent' THEN 'agents' WHEN 'scout' THEN 'agents' ELSE NULL END INTO role_category FROM public.profiles p WHERE p.id=uid;
 WITH eligible AS (
  SELECT s.id,s.slug,s.name,s.category,s.description,s.owner_id,s.accent_color,s.icon_key,
   EXISTS(SELECT FROM public.hoop_group_members m WHERE m.space_id=s.id AND m.user_id=uid) AS joined
  FROM public.hoop_group_spaces s
  WHERE (p_after IS NULL OR s.id>p_after) AND (p_slug IS NULL OR s.slug=p_slug)
  AND (q='' OR strpos(lower(s.name),q)>0 OR strpos(lower(s.description),q)>0 OR strpos(lower(s.category),q)>0 OR EXISTS(SELECT FROM public.hoop_group_channels c WHERE c.space_id=s.id AND strpos(lower(c.name),q)>0))
 ), page AS (
  SELECT *,row_number() OVER(ORDER BY id) AS pos FROM (
   SELECT * FROM eligible e WHERE p_mode='all' OR (p_mode='joined' AND joined) OR (p_mode='mine' AND owner_id=uid) OR (p_mode='recommended' AND e.category=role_category AND owner_id IS DISTINCT FROM uid AND NOT joined)
   ORDER BY id LIMIT 51
  ) x
 )
 SELECT jsonb_build_object('rows',coalesce(jsonb_agg(to_jsonb(page)-'pos' ORDER BY pos) FILTER(WHERE pos<=50),'[]'::jsonb),'has_more',count(*)>50,
 'channels',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'space_id',c.space_id,'slug',c.slug,'name',c.name,'sort_index',c.sort_index) ORDER BY c.space_id,c.sort_index,c.id) FROM public.hoop_group_channels c JOIN page p ON p.id=c.space_id WHERE p.pos<=50),'[]'::jsonb))
 INTO result FROM page;
 IF jsonb_array_length(result->'channels')>600 THEN RAISE EXCEPTION 'Directory channel limit requires review'; END IF;
 RETURN result;
END $f$;
REVOKE ALL ON FUNCTION public.hoop_group_directory_page(text,text,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hoop_group_directory_page(text,text,uuid,text) TO authenticated;
COMMIT;
