-- Additive Build 8 compatibility only. No raw profile-column grants or RLS
-- changes. Keep absent owner/MFA RPC out of this independent public-read release.
-- Apply ONLY through an atomic, authorized migration runner after CI/rehearsal.
SET LOCAL lock_timeout = '4s';
SET LOCAL statement_timeout = '25s';
DO $guard$
BEGIN
  IF to_regclass('public.profiles') IS NULL OR
     NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.profiles'::regclass) OR
     EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace
          AND proname IN ('search_public_players_by_username','is_player_country_public')) OR
     NOT (SELECT count(*)=3 AND bool_and(md5(prosrc)=v.md5)
          FROM (VALUES
           ('public.get_public_player_profile(uuid)','d9cd27d5b6e426397674d48184530b24'),
           ('public.search_public_players(text,text,text,boolean,integer)','c2eee54d975b81dfeea139cacc2b8bee'),
           ('public.search_public_players_page(text,text,text,boolean,integer,integer)','9645a81f5e34e52e95946744ba05c9d1')
          ) AS v(sig,md5)
          JOIN pg_proc p ON p.oid=to_regprocedure(v.sig)) THEN
    RAISE EXCEPTION 'Build 8 compatibility preflight failed: API drift or RLS mismatch';
  END IF;
END $guard$;

-- BEGIN PUBLIC READONLY RPCS
CREATE FUNCTION public.search_public_players_by_username(
  p_username text, p_country text DEFAULT NULL, p_limit integer DEFAULT 30, p_offset integer DEFAULT 0
)
RETURNS TABLE(id uuid, display_name text, username text, country text,
 current_country text, current_team text, "position" text, years_pro integer,
 free_agent boolean, avatar_url text, player_verified boolean, basketball_type text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $rpc$
 SELECT p.id,p.display_name,p.username,p.country,
   CASE WHEN p.current_country_public IS TRUE THEN p.current_country ELSE NULL END,
   p.current_team,p.position,p.years_pro,p.free_agent,
   CASE WHEN coalesce(p.avatar_moderation_status,'approved')='approved' THEN p.avatar_url ELSE NULL END,
   p.player_verified,p.basketball_type
 FROM public.profiles p
 WHERE p.account_type='player'
   AND p.profile_visibility='public'
   AND coalesce(p.moderation_status,'normal') <> 'suspended'
   AND char_length(ltrim(btrim(p_username),'@')) BETWEEN 2 AND 100
   AND strpos(lower(p.username),lower(ltrim(btrim(p_username),'@'))) > 0
   AND NOT EXISTS (SELECT 1 FROM public.profiles viewer
                   WHERE viewer.id=auth.uid() AND viewer.account_type='fan')
   AND (p_country IS NULL OR char_length(btrim(p_country)) <= 120)
   AND (nullif(btrim(p_country),'') IS NULL
        OR (p.current_country_public IS TRUE AND
            strpos(lower(p.current_country),lower(btrim(p_country))) > 0))
 ORDER BY lower(p.username),p.id
 LIMIT greatest(1,least(coalesce(p_limit,30),101))
 OFFSET greatest(0,least(coalesce(p_offset,0),100000));
$rpc$;
REVOKE ALL ON FUNCTION public.search_public_players_by_username(text,text,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_public_players_by_username(text,text,integer,integer) TO anon,authenticated;

CREATE FUNCTION public.is_player_country_public(p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public
AS $rpc$
 SELECT coalesce(
  (SELECT p.current_country_public IS TRUE
   FROM public.profiles p WHERE p.id=p_user_id
   AND p.account_type='player'
   AND p.profile_visibility='public'
   AND coalesce(p.moderation_status,'normal') <> 'suspended'),
  false
 );
$rpc$;
REVOKE ALL ON FUNCTION public.is_player_country_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_player_country_public(uuid) TO anon,authenticated;

-- END PUBLIC READONLY RPCS
DO $post$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.search_public_players_by_username(text,text,integer,integer)')
    AND NOT prosecdef AND provolatile='s' AND pg_get_userbyid(proowner)='postgres')
 OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.is_player_country_public(uuid)')
    AND NOT prosecdef AND provolatile='s' AND pg_get_userbyid(proowner)='postgres')
 OR EXISTS (SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a
            WHERE p.oid=to_regprocedure('public.is_player_country_public(uuid)')
              AND a.grantee=0 AND a.privilege_type='EXECUTE') THEN
    RAISE EXCEPTION 'Build 8 public compatibility contract postcheck failed';
 END IF;
END $post$;
NOTIFY pgrst,'reload schema';
