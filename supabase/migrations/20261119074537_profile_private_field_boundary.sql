-- UNAPPLIED candidate. Stage RPC/client changes before restricting old-client reads.
-- Keep the profiles table, its OID, FKs, write grants and RLS policies intact.
-- Privileged helpers below are deliberate data projections, not RLS workarounds:
-- JWT owner/MFA and explicit public visibility are enforced inside each boundary.
CREATE SCHEMA IF NOT EXISTS hoopcheck_security;
REVOKE ALL ON SCHEMA hoopcheck_security FROM PUBLIC;
GRANT USAGE ON SCHEMA hoopcheck_security TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION hoopcheck_security.own_profile()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF auth.uid() IS NULL OR auth.jwt()->>'role' IS DISTINCT FROM 'authenticated'
   OR coalesce(auth.jwt()->>'is_anonymous','false') <> 'false'
   OR NOT coalesce(hoopcheck_security.mfa_satisfied(), false) THEN
   RAISE EXCEPTION 'Verified account required' USING ERRCODE='42501';
 END IF;
 RETURN (SELECT jsonb_object_agg(field.key,field.value)
   FROM public.profiles p CROSS JOIN LATERAL jsonb_each(to_jsonb(p)) field
   WHERE p.id=(SELECT auth.uid()) AND field.key=ANY(ARRAY['id','display_name','avatar_url','country','bio','created_at','updated_at','is_adult','agreed_to_terms','terms_accepted_at','terms_version','position','years_pro','current_country','current_team','profile_visibility','player_verified','player_verified_at','profile_claimed','claimed_at','first_name','last_name','professional_experience','account_type','username','moderation_status','moderation_note','moderation_updated_at','moderation_updated_by','interests','favorite_leagues','favorite_teams','experience_summary','avatar_moderation_status','avatar_moderation_note','basketball_type','free_agent','hometown','nationality','display_name_changed_at','selected_team_id','selected_team_verified','selected_womens_team_id','identity_verification_status','coach_profile_id','coach_verified','coach_verified_at','gender','last_seen_at','experience_goal','research_preferences','theme_preference','preferred_language','notification_preferences','current_country_public','preferred_basketball_side','height']::text[]));
END $$;
REVOKE ALL ON FUNCTION hoopcheck_security.own_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION hoopcheck_security.own_profile() TO authenticated;
CREATE OR REPLACE FUNCTION public.get_own_profile()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 SELECT hoopcheck_security.own_profile();
$$;
REVOKE ALL ON FUNCTION public.get_own_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_own_profile() TO authenticated;
COMMENT ON FUNCTION public.get_own_profile() IS 'JWT-owned, MFA-protected explicit profile projection. No target-ID argument; excludes birthdate and Stripe identity session.';

-- A safe source for every discovery API, including legacy overloads. No raw
-- private country can influence search results or filters through this source.
CREATE OR REPLACE FUNCTION hoopcheck_security.public_players()
RETURNS TABLE(id uuid,display_name text,username text,avatar_url text,country text,
 bio text,"position" text,years_pro integer,current_country text,current_team text,
 player_verified boolean,player_verified_at timestamptz,free_agent boolean,
 basketball_type text,profile_visibility text,moderation_status text,
 avatar_moderation_status text,current_country_public boolean,account_type text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT p.id,p.display_name,p.username,
  CASE WHEN coalesce(p.avatar_moderation_status,'approved')='approved' THEN p.avatar_url END,
  p.country,p.bio,p.position,p.years_pro,
  CASE WHEN p.current_country_public IS TRUE THEN p.current_country END,
  p.current_team,p.player_verified,p.player_verified_at,p.free_agent,p.basketball_type,
  p.profile_visibility,p.moderation_status,'approved'::text,p.current_country_public,p.account_type
 FROM public.profiles p WHERE p.account_type='player' AND p.profile_visibility='public'
 AND coalesce(p.moderation_status,'normal') <> 'suspended'
 AND coalesce(hoopcheck_security.mfa_satisfied(),false);
$$;
REVOKE ALL ON FUNCTION hoopcheck_security.public_players() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION hoopcheck_security.public_players() TO anon,authenticated;

create or replace function hoopcheck_security.player_profile(p_user_id uuid)
returns table(
  id uuid,
  display_name text,
  avatar_url text,
  country text,
  bio text,
  player_position text,
  years_pro integer,
  current_country text,
  current_team text,
  player_verified boolean,
  player_verified_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.display_name,
    case
      when coalesce(p.avatar_moderation_status, 'approved') = 'approved' then p.avatar_url
      else null
    end,
    p.country,
    p.bio,
    p.position,
    p.years_pro,
    case when p.id = auth.uid() or p.current_country_public is true then p.current_country else null end,
    p.current_team,
    p.player_verified,
    p.player_verified_at
  from public.profiles p
  where p.id = p_user_id
    and p.account_type = 'player'
    and (
      p.profile_visibility = 'public'
      or (
        p.profile_visibility = 'players_only'
        and coalesce(auth.jwt()->>'is_anonymous','false')='false'
        and exists (
          select 1 from public.profiles viewer
          where viewer.id = auth.uid() and viewer.account_type = 'player'
        )
      )
    )
    and coalesce(hoopcheck_security.mfa_satisfied(), false)
    and (p.moderation_status is null or p.moderation_status <> 'suspended');
$$;


REVOKE ALL ON FUNCTION hoopcheck_security.player_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION hoopcheck_security.player_profile(uuid) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.get_public_player_profile(p_user_id uuid)
returns table(
  id uuid,
  display_name text,
  avatar_url text,
  country text,
  bio text,
  player_position text,
  years_pro integer,
  current_country text,
  current_team text,
  player_verified boolean,
  player_verified_at timestamptz
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM hoopcheck_security.player_profile(p_user_id); $$;
REVOKE ALL ON FUNCTION public.get_public_player_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_player_profile(uuid) TO anon,authenticated;

-- Boolean consent proof for native clients. Reuse the canonical profile boundary
-- so a guessed UUID cannot reveal flags for hidden/suspended or MFA-denied rows.
-- Country values never leave this helper. A public invoker exposes only a boolean.
CREATE OR REPLACE FUNCTION hoopcheck_security.is_player_country_public(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (
   SELECT 1 FROM public.profiles p
   WHERE p.id = p_user_id AND p.current_country_public IS TRUE
     AND EXISTS (SELECT 1 FROM hoopcheck_security.player_profile(p_user_id))
 );
$$;
REVOKE ALL ON FUNCTION hoopcheck_security.is_player_country_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION hoopcheck_security.is_player_country_public(uuid) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.is_player_country_public(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 SELECT hoopcheck_security.is_player_country_public(p_user_id);
$$;
REVOKE ALL ON FUNCTION public.is_player_country_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_player_country_public(uuid) TO anon,authenticated;

create or replace function public.search_public_players_by_username(
  p_username text, p_country text default null, p_limit integer default 30, p_offset integer default 0
)
returns table(id uuid, display_name text, username text, country text,
  current_country text, current_team text, "position" text, years_pro integer,
  free_agent boolean, avatar_url text, player_verified boolean, basketball_type text)
language sql stable security invoker set search_path = public
as $$
  select p.id, p.display_name, p.username, p.country,
    case when p.current_country_public is true then p.current_country else null end,
    p.current_team, p.position, p.years_pro, p.free_agent,
    case when coalesce(p.avatar_moderation_status, 'approved') = 'approved' then p.avatar_url else null end,
    p.player_verified, p.basketball_type
  from hoopcheck_security.public_players() p
  where p.account_type = 'player' and p.profile_visibility = 'public'
    and coalesce(p.moderation_status, 'normal') <> 'suspended'
    and char_length(ltrim(btrim(p_username), '@')) between 2 and 100
    and strpos(lower(p.username), lower(ltrim(btrim(p_username), '@'))) > 0
    and not exists (select 1 from public.profiles viewer where viewer.id = auth.uid() and viewer.account_type = 'fan')
    and (p_country is null or char_length(btrim(p_country)) <= 120)
    and (nullif(btrim(p_country), '') is null or
      (p.current_country_public is true and strpos(lower(p.current_country), lower(btrim(p_country))) > 0))
  order by lower(p.username), p.id
  limit greatest(1, least(coalesce(p_limit, 30), 101))
  offset greatest(0, least(coalesce(p_offset, 0), 100000));
$$;
revoke all on function public.search_public_players_by_username(text, text, integer, integer) from public;
grant execute on function public.search_public_players_by_username(text, text, integer, integer) to anon, authenticated;

create or replace function public.search_public_players(
  p_query text default '',
  p_country text default '',
  p_position text default '',
  p_verified_only boolean default false,
  p_limit integer default 24
)
returns table (
  id uuid,
  display_name text,
  avatar_url text,
  country text,
  bio text,
  player_position text,
  years_pro integer,
  current_country text,
  current_team text,
  player_verified boolean,
  player_verified_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id, p.display_name, p.avatar_url, p.country, p.bio,
    p.position as player_position, p.years_pro, p.current_country,
    p.current_team, p.player_verified, p.player_verified_at
  from hoopcheck_security.public_players() p
  where p.profile_visibility = 'public'
    and p.account_type = 'player'
    and coalesce(p.moderation_status, 'active') <> 'suspended'
    and coalesce(p.basketball_type, 'mens') = 'mens'
    and (
      nullif(trim(p_query), '') is null
      or p.display_name ilike '%' || trim(p_query) || '%'
      or p.username ilike '%' || trim(p_query) || '%'
      or p.country ilike '%' || trim(p_query) || '%'
      or p.current_country ilike '%' || trim(p_query) || '%'
      or p.current_team ilike '%' || trim(p_query) || '%'
      or p.position ilike '%' || trim(p_query) || '%'
    )
    and (nullif(trim(p_country), '') is null or p.country = trim(p_country) or p.current_country = trim(p_country))
    and (nullif(trim(p_position), '') is null or p.position = trim(p_position))
    and (coalesce(p_verified_only, false) = false or p.player_verified = true)
  order by p.player_verified desc, p.display_name asc
  limit least(greatest(coalesce(p_limit, 24), 1), 50);
$$;

CREATE OR REPLACE FUNCTION public.search_public_players_page(p_query text DEFAULT ''::text, p_country text DEFAULT ''::text, p_position text DEFAULT ''::text, p_verified_only boolean DEFAULT false, p_limit integer DEFAULT 24, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, display_name text, avatar_url text, country text, bio text, player_position text, years_pro integer, current_country text, current_team text, player_verified boolean, player_verified_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select
    p.id, p.display_name, p.avatar_url, p.country, p.bio,
    p.position as player_position, p.years_pro, p.current_country,
    p.current_team, p.player_verified, p.player_verified_at
  from hoopcheck_security.public_players() p
  where p.profile_visibility = 'public'
    and p.account_type = 'player'
    and coalesce(p.moderation_status, 'active') <> 'suspended'
    and (coalesce(p.basketball_type, 'mens') = 'mens')
    and (
      nullif(trim(p_query), '') is null
      or p.display_name ilike '%' || trim(p_query) || '%'
      or p.username ilike '%' || trim(p_query) || '%'
      or p.country ilike '%' || trim(p_query) || '%'
      or p.current_country ilike '%' || trim(p_query) || '%'
      or p.current_team ilike '%' || trim(p_query) || '%'
      or p.position ilike '%' || trim(p_query) || '%'
    )
    and (nullif(trim(p_country), '') is null or p.country = trim(p_country) or p.current_country = trim(p_country))
    and (nullif(trim(p_position), '') is null or p.position = trim(p_position))
    and (coalesce(p_verified_only, false) = false or p.player_verified = true)
  order by p.player_verified desc, p.display_name asc, p.id
  limit least(greatest(coalesce(p_limit, 24), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$function$;

CREATE OR REPLACE FUNCTION hoopcheck_security.social_suggestions()
 RETURNS TABLE(entity_type text, entity_id uuid, display_name text, avatar_url text, detail text, player_verified boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with followed_players as (
    select target_id from public.follow_relationships
    where follower_id = auth.uid() and target_type = 'player'
  ),
  player_suggestions as (
    select 'player'::text as entity_type, candidate.id as entity_id,
      candidate.display_name, CASE WHEN coalesce(candidate.avatar_moderation_status,'approved')='approved' THEN candidate.avatar_url END AS avatar_url,
      coalesce(candidate.current_team, CASE WHEN candidate.current_country_public IS TRUE THEN candidate.current_country END, candidate.country, 'Player') as detail,
      coalesce(candidate.player_verified,false) as player_verified,
      count(*) as connection_weight
    from public.follow_relationships graph
    join followed_players fp on fp.target_id = graph.follower_id
    join public.profiles candidate on candidate.id = graph.target_id
    where graph.target_type = 'player'
      and candidate.profile_visibility = 'public'
      and candidate.account_type = 'player'
      and coalesce(candidate.moderation_status,'normal') <> 'suspended'
      and coalesce(hoopcheck_security.mfa_satisfied(),false)
      and candidate.id <> auth.uid()
      and not exists (select 1 from public.follow_relationships mine where mine.follower_id = auth.uid() and mine.target_type = 'player' and mine.target_id = candidate.id)
    group by candidate.id
  ),
  team_suggestions as (
    select 'team'::text as entity_type, coalesce(team.id, womens_team.id) as entity_id,
      coalesce(team.name, womens_team.name) as display_name,
      coalesce(team.logo_url, womens_team.logo_url) as avatar_url,
      coalesce(team.country, womens_team.country, team.league_name, womens_team.league_name, 'Team') as detail,
      false as player_verified,
      count(*) as connection_weight
    from public.follow_relationships graph
    join followed_players fp on fp.target_id = graph.follower_id
    left join public.teams team on team.id = graph.target_id
    left join public.womens_teams womens_team on womens_team.id = graph.target_id
    where graph.target_type = 'team' and coalesce(hoopcheck_security.mfa_satisfied(),false)
      and coalesce(team.id, womens_team.id) is not null
      and not exists (select 1 from public.follow_relationships mine where mine.follower_id = auth.uid() and mine.target_type = 'team' and mine.target_id = coalesce(team.id, womens_team.id))
    group by team.id, womens_team.id
  )
  select entity_type, entity_id, display_name, avatar_url, detail, player_verified
  from (
    select * from player_suggestions
    union all
    select * from team_suggestions
  ) suggestions
  order by connection_weight desc, display_name
  limit 8;
$function$;
REVOKE ALL ON FUNCTION hoopcheck_security.social_suggestions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION hoopcheck_security.social_suggestions() TO authenticated;
CREATE OR REPLACE FUNCTION public.get_social_suggestions() RETURNS TABLE(entity_type text,entity_id uuid,display_name text,avatar_url text,detail text,player_verified boolean) LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM hoopcheck_security.social_suggestions(); $$;
REVOKE ALL ON FUNCTION public.get_social_suggestions() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_social_suggestions() TO authenticated;


CREATE OR REPLACE FUNCTION hoopcheck_security.can_view_player_feed_post(p_author_id uuid)
 RETURNS boolean
 LANGUAGE sql SECURITY DEFINER
 STABLE
 SET search_path TO ''
AS $function$
  select coalesce(hoopcheck_security.mfa_satisfied(),false) AND (
    p_author_id = (select auth.uid())
    or public.is_current_user_admin_or_moderator()
    or exists (
      select 1
      from public.profiles viewer
      join public.membership_authorizations sub on sub.user_id = viewer.id
      join public.profiles author on author.id = p_author_id
      join public.follow_relationships fr on fr.follower_id = viewer.id
        and fr.target_id = p_author_id
        and fr.target_type = author.account_type
      where viewer.id = (select auth.uid())
        and viewer.account_type in ('player','fan','coach','agent','scout','club_admin','manager')
        and (author.profile_visibility='public' or author.id=auth.uid() or public.is_current_user_admin_or_moderator())
        and author.account_type in ('player','fan','coach','agent','scout','club_admin','manager')
        and sub.plan in ('pro','premium')
        and sub.status in ('active','trialing')
        and coalesce(sub.access_status,'active') in ('active','trialing','pro','premium')
        and (sub.current_period_end is null or sub.current_period_end > now())
        and (
          viewer.account_type <> 'player' or author.account_type <> 'player'
          or (
            viewer.current_country is not null
            and author.current_country is not null
            and lower(viewer.current_country) = lower(author.current_country)
          )
        )
    ));
$function$;

REVOKE ALL ON FUNCTION hoopcheck_security.can_view_player_feed_post(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION hoopcheck_security.can_view_player_feed_post(uuid) TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.can_view_player_feed_post(p_author_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT hoopcheck_security.can_view_player_feed_post(p_author_id); $$;

-- Column privileges are restricted separately after client rollout.
NOTIFY pgrst,'reload schema';
