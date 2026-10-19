-- Normalize and complete current 2026-27 women’s first-division directory coverage.
-- Idempotent: link existing records and add only missing current clubs.

insert into public.womens_leagues(name,country,level,active)
select v.name,v.country,v.level,true
from (values
  ('EuroLeague Women 2026-27','Europe','European first division'),
  ('WNBL','Australia','Professional')
) as v(name,country,level)
where not exists (select 1 from public.womens_leagues l where lower(l.name)=lower(v.name));

with seed(team,country,city) as (values
  ('Athinaikos Qualco','Greece','Vironas'),
  ('AZS UMCS Lublin','Poland','Lublin'),
  ('Basket Landes','France','Mont-de-Marsan'),
  ('Beretta Famila Schio','Italy','Schio'),
  ('Casademont Zaragoza','Spain','Zaragoza'),
  ('CS Rapid Bucuresti','Romania','Bucharest'),
  ('Emlak Konut','Türkiye','Istanbul'),
  ('Fenerbahce Tarfin','Türkiye','Istanbul'),
  ('Flammes Carolo Basket','France','Charleville-Mézières'),
  ('Galatasaray Cagdas Faktoring','Türkiye','Istanbul'),
  ('Kangoeroes Basket Mechelen','Belgium','Mechelen'),
  ('Kibirkstis-TOKS','Lithuania','Vilnius'),
  ('KKZ Crvena Zvezda','Serbia','Belgrade'),
  ('Tango Bourges Basket','France','Bourges'),
  ('Valencia Basket Club','Spain','Valencia'),
  ('ZVVZ USK Praha','Czechia','Prague')
)
update public.womens_teams t
set league_id=l.id, league_name=l.name, active=true
from seed s join public.womens_leagues l on lower(l.name)='euroleague women 2026-27'
where lower(t.name)=lower(s.team) and lower(coalesce(t.country,''))=lower(s.country);

with seed(team,country,city) as (values
  ('Athinaikos Qualco','Greece','Vironas'),
  ('AZS UMCS Lublin','Poland','Lublin'),
  ('Basket Landes','France','Mont-de-Marsan'),
  ('Beretta Famila Schio','Italy','Schio'),
  ('Casademont Zaragoza','Spain','Zaragoza'),
  ('CS Rapid Bucuresti','Romania','Bucharest'),
  ('Emlak Konut','Türkiye','Istanbul'),
  ('Fenerbahce Tarfin','Türkiye','Istanbul'),
  ('Flammes Carolo Basket','France','Charleville-Mézières'),
  ('Galatasaray Cagdas Faktoring','Türkiye','Istanbul'),
  ('Kangoeroes Basket Mechelen','Belgium','Mechelen'),
  ('Kibirkstis-TOKS','Lithuania','Vilnius'),
  ('KKZ Crvena Zvezda','Serbia','Belgrade'),
  ('Tango Bourges Basket','France','Bourges'),
  ('Valencia Basket Club','Spain','Valencia'),
  ('ZVVZ USK Praha','Czechia','Prague')
)
insert into public.womens_teams(name,country,city,league_id,active,league_name)
select s.team,s.country,s.city,l.id,true,l.name
from seed s join public.womens_leagues l on lower(l.name)='euroleague women 2026-27'
where not exists (select 1 from public.womens_teams t where lower(t.name)=lower(s.team) and lower(coalesce(t.country,''))=lower(s.country));

with seed(team,country,city) as (values
  ('Adelaide Lightning','Australia','Adelaide'),
  ('Bendigo Spirit','Australia','Bendigo'),
  ('Geelong Venom','Australia','Geelong'),
  ('Perth Lynx','Australia','Perth'),
  ('Southside Melbourne Flyers','Australia','Melbourne'),
  ('Sydney Flames','Australia','Sydney'),
  ('Tasmania Jewels','Australia','Hobart'),
  ('Townsville Fire','Australia','Townsville'),
  ('UC Capitals','Australia','Canberra')
)
update public.womens_teams t
set league_id=l.id, league_name=l.name, active=true
from seed s join public.womens_leagues l on lower(l.name)='wnbl'
where lower(t.name)=lower(s.team) and lower(coalesce(t.country,''))=lower(s.country);

with seed(team,country,city) as (values
  ('Adelaide Lightning','Australia','Adelaide'),
  ('Bendigo Spirit','Australia','Bendigo'),
  ('Geelong Venom','Australia','Geelong'),
  ('Perth Lynx','Australia','Perth'),
  ('Southside Melbourne Flyers','Australia','Melbourne'),
  ('Sydney Flames','Australia','Sydney'),
  ('Tasmania Jewels','Australia','Hobart'),
  ('Townsville Fire','Australia','Townsville'),
  ('UC Capitals','Australia','Canberra')
)
insert into public.womens_teams(name,country,city,league_id,active,league_name)
select s.team,s.country,s.city,l.id,true,l.name
from seed s join public.womens_leagues l on lower(l.name)='wnbl'
where not exists (select 1 from public.womens_teams t where lower(t.name)=lower(s.team) and lower(coalesce(t.country,''))=lower(s.country));

-- Fix existing records that carried a league label but lacked the relation used by filters.
update public.womens_teams t
set league_id=l.id
from public.womens_leagues l
where t.league_id is null and t.active=true and t.league_name is not null
  and lower(trim(t.league_name))=lower(trim(l.name));

-- Retire the old Canberra Capitals label; the current franchise is listed as UC Capitals.
update public.womens_teams set active=false
where lower(name)='canberra capitals' and lower(coalesce(country,''))='australia' and active=true;
