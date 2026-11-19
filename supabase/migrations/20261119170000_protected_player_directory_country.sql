-- DRAFT ONLY. Apply only after review of all profile RLS visibility contracts.
-- The prior masked directory functions run as invoker and fail once SELECT
-- on profiles.current_country is revoked. Use controlled definer execution
-- while retaining the existing explicit visibility, moderation and masking
-- predicates in their SQL bodies.
-- This migration intentionally does NOT revoke any column permissions.
ALTER FUNCTION public.get_public_player_profile(uuid)
  SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.search_public_players(text,text,integer,integer)
  SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.search_public_players(text,text,text,boolean,integer)
  SECURITY DEFINER SET search_path = '';
ALTER FUNCTION public.search_public_players_page(text,text,text,boolean,integer,integer)
  SECURITY DEFINER SET search_path = '';

-- The public profile and directory are available to anonymous browsing;
-- never grant broad table access to compensate for the restricted column.
REVOKE ALL ON FUNCTION public.get_public_player_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_player_profile(uuid) TO anon,authenticated;
REVOKE ALL ON FUNCTION public.search_public_players(text,text,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_public_players(text,text,integer,integer) TO anon,authenticated;
REVOKE ALL ON FUNCTION public.search_public_players(text,text,text,boolean,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_public_players(text,text,text,boolean,integer) TO anon,authenticated;
REVOKE ALL ON FUNCTION public.search_public_players_page(text,text,text,boolean,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_public_players_page(text,text,text,boolean,integer,integer) TO anon,authenticated;

-- Before deploying, test every overload under real anon/authenticated roles,
-- including players_only visibility, suspension, fan search gating,
-- current_country_public=false, and owner-only private profile read.
