-- LEAGUE-DATA-1: review-only Armenia roster identity audit (read-only).
-- Announced 2026-27 participant list: https://www.newsarmenia.am/news/sport/novyy-sezon-basketbolnoy-ligi-probasket-a-league-startuet-v-armenii-1-noyabrya/
-- Federation opening report: https://www.aravot.am/2026/11/02/1590782/
-- Names are explicit review aliases, not fuzzy matching or insert authorization.
with expected(country, club, aliases) as (
  values
    ('Armenia','BC YANGS',array['bc yangs']),
    ('Armenia','Urartu BC',array['urartu bc','bc urartu']),
    ('Armenia','BKMA',array['bkma','bkma yerevan','bc bkma']),
    ('Armenia','BC HATIS',array['bc hatis','hatis']),
    ('Armenia','BC HAT',array['bc hat']),
    ('United States','BC CROSSNATION',array['bc crossnation']),
    ('United States','BC PHOENIX PERCEPTION',array['bc phoenix perception']),
    ('Georgia','BC TBILISI BTB',array['bc tbilisi btb']),
    ('Kazakhstan','Barsy Atyrau',array['barsy atyrau','bc barsy atyrau']),
    ('Kyrgyzstan','BC NOMAD',array['bc nomad'])
), target as (
  select id from public.leagues where active is true
  and country='Armenia' and name='Armenian Basketball League A'
  and basketball_type='mens' and season in ('2026-27','2026-2027')
), roster as (
  select t.* from public.teams t where t.active is true and t.basketball_type='mens'
  and (t.league_id in (select id from target)
    or exists (select 1 from public.team_league_memberships m
      where m.team_id=t.id and m.league_id in (select id from target)
      and m.active is true and m.season in ('2026-27','2026-2027')))
), findings as (
  select e.country,e.club,
    (select count(*) from roster t where t.country=e.country and lower(trim(t.name))=any(e.aliases)) as roster_matches,
    (select count(*) from public.teams t where t.country=e.country and t.basketball_type='mens'
      and lower(trim(t.name))=any(e.aliases)) as all_identity_candidates
  from expected e
)
select country,club,roster_matches,all_identity_candidates,
  case when (select count(*) from target)<>1 then 'blocked_league_identity'
       when roster_matches=0 then 'missing'
       when roster_matches>1 or all_identity_candidates>1 then 'review_duplicate'
       else 'matched' end as finding
from findings
union all
select t.country,t.name,1,1,'unexpected_roster_entry'
from roster t
where not exists (select 1 from expected e where t.country=e.country and lower(trim(t.name))=any(e.aliases))
order by country,club;
