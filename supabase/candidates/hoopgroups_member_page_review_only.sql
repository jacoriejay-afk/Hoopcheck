-- Review-only extension, after hoopgroups_private_access_review_only.sql.
BEGIN;
SET LOCAL lock_timeout='4s';
SET LOCAL statement_timeout='15s';
CREATE FUNCTION hoopcheck_group_access.member_page(p_space uuid,p_after uuid,p_query text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $f$
DECLARE uid uuid:=auth.uid(); q text:=lower(btrim(coalesce(p_query,''))); result jsonb;
BEGIN
 IF NOT hoopcheck_group_access.active() OR NOT hoopcheck_group_access.enabled() OR NOT EXISTS(SELECT FROM public.hoop_group_spaces s WHERE s.id=p_space AND s.owner_id=uid)
 THEN RAISE EXCEPTION 'Group roster unavailable' USING ERRCODE='42501'; END IF;
 IF char_length(q)>80 THEN RAISE EXCEPTION 'Invalid roster search' USING ERRCODE='22023'; END IF;
 WITH roster AS (
 SELECT m.user_id,CASE WHEN p.profile_visibility='public' THEN coalesce(nullif(p.display_name,''),'HoopCheck member') ELSE 'HoopCheck member' END AS name,
 CASE WHEN m.user_id=uid THEN 'owner' WHEN mo.user_id IS NOT NULL THEN 'moderator' ELSE 'member' END AS role,
 coalesce((SELECT jsonb_agg(g.channel_id ORDER BY g.channel_id) FROM hoopcheck_group_access.channel_grants g WHERE g.space_id=p_space AND g.user_id=m.user_id),'[]'::jsonb) AS channels
 FROM public.hoop_group_members m LEFT JOIN public.profiles p ON p.id=m.user_id LEFT JOIN hoopcheck_group_access.moderators mo ON mo.space_id=m.space_id AND mo.user_id=m.user_id
 WHERE m.space_id=p_space AND (p_after IS NULL OR m.user_id>p_after)
 AND (q='' OR strpos(lower(CASE WHEN p.profile_visibility='public' THEN coalesce(nullif(p.display_name,''),'HoopCheck member') ELSE 'HoopCheck member' END),q)>0)
 ORDER BY m.user_id LIMIT 51
 ), numbered AS (SELECT *,row_number() OVER(ORDER BY user_id) AS pos FROM roster)
 SELECT jsonb_build_object('space_id',p_space,'rows',coalesce(jsonb_agg(to_jsonb(numbered)-'pos' ORDER BY pos) FILTER(WHERE pos<=50),'[]'::jsonb),'has_more',count(*)>50) INTO result FROM numbered;
 RETURN result;
END $f$;
REVOKE ALL ON FUNCTION hoopcheck_group_access.member_page(uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hoopcheck_group_access.member_page(uuid,uuid,text) TO authenticated;
CREATE FUNCTION public.hoop_group_member_page(p_space uuid,p_after uuid DEFAULT NULL,p_query text DEFAULT '')
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $f$
 SELECT hoopcheck_group_access.member_page(p_space,p_after,p_query)
$f$;
REVOKE ALL ON FUNCTION public.hoop_group_member_page(uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hoop_group_member_page(uuid,uuid,text) TO authenticated;
COMMIT;
