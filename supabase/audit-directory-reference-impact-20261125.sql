-- #1040: aggregate reference impact only; never execute a merge.
-- Run in an authorized read-only session. Counts, not private review content.
begin transaction isolation level repeatable read read only;

-- Compare catalog to reviewed baseline before interpreting counts.
-- Any row means the inventory drifted: do not use this report for a merge.
with expected(table_name,column_name,target_name) as (values
  ('coach_team_assignments','team_id','teams'),
  ('coach_team_requests','team_id','teams'),
  ('coaches','current_team_id','teams'),
  ('fan_feed_posts','team_id','teams'),
  ('fan_feed_posts','womens_team_id','womens_teams'),
  ('fan_live_games','opponent_team_id','teams'),
  ('fan_live_games','team_id','teams'),
  ('fan_live_team_provider_map','team_id','teams'),
  ('feed_posts','club_id','teams'),
  ('feed_posts','womens_club_id','womens_teams'),
  ('player_career_stops','team_id','teams'),
  ('player_team_affiliations','team_id','teams'),
  ('player_verification_requests','team_id','teams'),
  ('player_verification_requests','womens_team_id','womens_teams'),
  ('profiles','selected_team_id','teams'),
  ('profiles','selected_womens_team_id','womens_teams'),
  ('reviews','team_id','teams'),
  ('team_fan_groups','team_id','teams'),
  ('team_fanfeed_posts','team_id','teams'),
  ('team_league_memberships','team_id','teams'),
  ('team_pay_checkins','team_id','teams'),
  ('womens_team_reviews','womens_team_id','womens_teams')
), actual as (
  select rel.relname::text table_name, att.attname::text column_name, target.relname::text target_name
  from pg_constraint c
  join pg_class rel on rel.oid=c.conrelid
  join pg_namespace ns on ns.oid=rel.relnamespace
  join pg_class target on target.oid=c.confrelid
  cross join lateral unnest(c.conkey) k(attnum)
  join pg_attribute att on att.attrelid=rel.oid and att.attnum=k.attnum
  where c.contype='f' and ns.nspname='public'
    and c.confrelid in ('public.teams'::regclass,'public.womens_teams'::regclass)
)
select 'unexpected' discrepancy,a.* from (select * from actual except select * from expected) a
union all
select 'missing',e.* from (select * from expected except select * from actual) e
order by 1,2,3;

-- Include both active and inactive canonical rows so archival aliases are not lost.
with names as (
 select id,basketball_type,country,
 lower(regexp_replace(btrim(name),'[[:space:][:punct:]]+','','g')) name_key
 from public.teams where basketball_type in ('mens','womens')
 and nullif(btrim(country),'') is not null
), groups as (
 select basketball_type,country,name_key from names
 where nullif(name_key,'') is not null group by 1,2,3 having count(*)>1
), candidates as (
 select n.id from names n join groups g using(basketball_type,country,name_key)
), counts as (
 select 'coach_team_assignments.team_id' as reference, 'teams' as target, r.team_id as team_id, count(*) as n
 from public.coach_team_assignments r join candidates d on d.id=r.team_id group by r.team_id
 union all
 select 'coach_team_requests.team_id' as reference, 'teams' as target, r.team_id as team_id, count(*) as n
 from public.coach_team_requests r join candidates d on d.id=r.team_id group by r.team_id
 union all
 select 'coaches.current_team_id' as reference, 'teams' as target, r.current_team_id as team_id, count(*) as n
 from public.coaches r join candidates d on d.id=r.current_team_id group by r.current_team_id
 union all
 select 'fan_feed_posts.team_id' as reference, 'teams' as target, r.team_id as team_id, count(*) as n
 from public.fan_feed_posts r join candidates d on d.id=r.team_id group by r.team_id
 union all
 select 'fan_feed_posts.womens_team_id' as reference, 'womens_teams' as target, r.womens_team_id as team_id, count(*) as n
 from public.fan_feed_posts r join candidates d on d.id=r.womens_team_id group by r.womens_team_id
 union all
 select 'fan_live_games.opponent_team_id' as reference, 'teams' as target, r.opponent_team_id as team_id, count(*) as n
 from public.fan_live_games r join candidates d on d.id=r.opponent_team_id group by r.opponent_team_id
 union all
 select 'fan_live_games.team_id' as reference, 'teams' as target, r.team_id as team_id, count(*) as n
 from public.fan_live_games r join candidates d on d.id=r.team_id group by r.team_id
 union all
 select 'fan_live_team_provider_map.team_id' as reference, 'teams' as target, r.team_id as team_id, count(*) as n
 from public.fan_live_team_provider_map r join candidates d on d.id=r.team_id group by r.team_id
 union all
 select 'feed_posts.club_id' as reference, 'teams' as target, r.club_id as team_id, count(*) as n
 from public.feed_posts r join candidates d on d.id=r.club_id group by r.club_id
 union all
 select 'feed_posts.womens_club_id' as reference, 'womens_teams' as target, r.womens_club_id as team_id, count(*) as n
 from public.feed_posts r join candidates d on d.id=r.womens_club_id group by r.womens_club_id
 union all
 select 'player_career_stops.team_id' as reference, 'teams' as target, r.team_id as team_id, count(*) as n
 from public.player_career_stops r join candidates d on d.id=r.team_id group by r.team_id
 union all
 select 'player_team_affiliations.team_id' as reference, 'teams' as target, r.team_id as team_id, count(*) as n
 from public.player_team_affiliations r join candidates d on d.id=r.team_id group by r.team_id
 union all
 select 'player_verification_requests.team_id' as reference, 'teams' as target, r.team_id as team_id, count(*) as n
 from public.player_verification_requests r join candidates d on d.id=r.team_id group by r.team_id
 union all
 select 'player_verification_requests.womens_team_id' as reference, 'womens_teams' as target, r.womens_team_id as team_id, count(*) as n
 from public.player_verification_requests r join candidates d on d.id=r.womens_team_id group by r.womens_team_id
 union all
 select 'profiles.selected_team_id' as reference, 'teams' as target, r.selected_team_id as team_id, count(*) as n
 from public.profiles r join candidates d on d.id=r.selected_team_id group by r.selected_team_id
 union all
 select 'profiles.selected_womens_team_id' as reference, 'womens_teams' as target, r.selected_womens_team_id as team_id, count(*) as n
 from public.profiles r join candidates d on d.id=r.selected_womens_team_id group by r.selected_womens_team_id
 union all
 select 'reviews.team_id' as reference, 'teams' as target, r.team_id as team_id, count(*) as n
 from public.reviews r join candidates d on d.id=r.team_id group by r.team_id
 union all
 select 'team_fan_groups.team_id' as reference, 'teams' as target, r.team_id as team_id, count(*) as n
 from public.team_fan_groups r join candidates d on d.id=r.team_id group by r.team_id
 union all
 select 'team_fanfeed_posts.team_id' as reference, 'teams' as target, r.team_id as team_id, count(*) as n
 from public.team_fanfeed_posts r join candidates d on d.id=r.team_id group by r.team_id
 union all
 select 'team_league_memberships.team_id' as reference, 'teams' as target, r.team_id as team_id, count(*) as n
 from public.team_league_memberships r join candidates d on d.id=r.team_id group by r.team_id
 union all
 select 'team_pay_checkins.team_id' as reference, 'teams' as target, r.team_id as team_id, count(*) as n
 from public.team_pay_checkins r join candidates d on d.id=r.team_id group by r.team_id
 union all
 select 'womens_team_reviews.womens_team_id' as reference, 'womens_teams' as target, r.womens_team_id as team_id, count(*) as n
 from public.womens_team_reviews r join candidates d on d.id=r.womens_team_id group by r.womens_team_id
)
select * from counts order by team_id,target,reference;

-- Possible non-FK references, including generic JSON columns. This list
-- requires manual review of application code and stored values; names alone
-- cannot prove absence of references. Never treat empty counts as clearance.
select table_schema,table_name,column_name,data_type
from information_schema.columns
where table_schema='public'
and (column_name ~* '(team|club|league|roster|career|affiliation|entity|target|subject)'
     or data_type in ('json','jsonb','ARRAY'))
order by 1,2,3;
rollback;
