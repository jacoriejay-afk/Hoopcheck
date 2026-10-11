-- Add German men's basketball fourth-tier Regionalliga coverage for 2026-27.
-- Germany's fourth tier is the 1. Regionalliga; regional associations organize the competition.
-- Team seed is limited to clubs listed in the Regionalliga Südost 2026/27 participation-rights publication.
insert into public.leagues(name,country,level,season,source,active)
select v.name,'Germany','4th division','2026-27',v.source,true
from (values
  ('1. Regionalliga Nord','official-basketball-regionalliga-nord'),
  ('1. Regionalliga West','official-basketball-regionalliga-west'),
  ('1. Regionalliga Südwest','official-basketball-regionalliga-suedwest'),
  ('1. Regionalliga Südost','official-basketball-regionalliga-suedost')
) as v(name,source)
where not exists (
  select 1 from public.leagues l
  where lower(l.name)=lower(v.name)
    and lower(l.country)='germany'
    and l.season='2026-27'
);

with additions(name,city,league_name) as (
  values
    ('TSV Ansbach','Ansbach','1. Regionalliga Südost'),
    ('TSV 1861 Nördlingen','Nördlingen','1. Regionalliga Südost'),
    ('BIG Basketball in Gotha','Gotha','1. Regionalliga Südost'),
    ('TSV Breitengüßbach','Breitengüßbach','1. Regionalliga Südost'),
    ('TTL Basketball Bamberg','Bamberg','1. Regionalliga Südost'),
    ('TG 1877 Veitshöchheim','Veitshöchheim','1. Regionalliga Südost'),
    ('Würzburg Baskets Akademie','Würzburg','1. Regionalliga Südost'),
    ('BG Illertal','Illertal','1. Regionalliga Südost'),
    ('MTSV Schwabing','Munich','1. Regionalliga Südost'),
    ('München Basket','Munich','1. Regionalliga Südost'),
    ('TS Jahn München','Munich','1. Regionalliga Südost'),
    ('TSV Unterhaching','Unterhaching','1. Regionalliga Südost'),
    ('TG 48 Würzburg','Würzburg','1. Regionalliga Südost'),
    ('TSV Vilsbiburg','Vilsbiburg','1. Regionalliga Südost'),
    ('SV Fellbach Flashers II','Fellbach','1. Regionalliga Südost')
)
insert into public.teams(name,country,city,league_id,league_name,source,active)
select a.name,'Germany',a.city,l.id,l.name,'official-regionalliga-suedost-2026-27',true
from additions a
join public.leagues l
  on lower(l.name)=lower(a.league_name)
 and lower(l.country)='germany'
 and l.season='2026-27'
where not exists (
  select 1 from public.teams t
  where lower(t.name)=lower(a.name)
    and lower(t.country)='germany'
    and t.league_id=l.id
);

insert into public.team_league_memberships(team_id,league_id,season,active)
select t.id,l.id,'2026-27',true
from public.teams t
join public.leagues l
  on l.id=t.league_id
where lower(t.country)='germany'
  and l.name='1. Regionalliga Südost'
  and l.season='2026-27'
  and t.source='official-regionalliga-suedost-2026-27'
on conflict (team_id,league_id,season) do nothing;
