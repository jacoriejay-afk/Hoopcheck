-- Add official 2026-27 East Asia Super League men’s clubs and 2026 FIBA Women’s Basketball League Asia clubs.
insert into public.leagues(name,country,level,season,basketball_type,active,source,last_synced_at)
select 'East Asia Super League','East Asia','Regional club competition','2026-27','mens',true,'official EASL 2026-27 field',now()
where not exists(select 1 from public.leagues where lower(name)=lower('East Asia Super League'));

with seed(team,country,city) as (values
('Alvark Tokyo','Japan','Tokyo'),('Goyang Sono Skygunners','South Korea','Goyang'),('TSG GhostHawks','Chinese Taipei','Taipei'),('South Gobi Broncos','Mongolia','Ulaanbaatar'),('Busan KCC Egis','South Korea','Busan'),('Macau Hou Chon','Macau','Macau'),('Taipei Fubon Braves','Chinese Taipei','Taipei'),('Nagasaki Velca','Japan','Nagasaki'),('Abra Weavers','Philippines','Abra'),('Hong Kong Eastern','Hong Kong','Hong Kong'),('Ryukyu Golden Kings','Japan','Okinawa'),('Taoyuan Pauian Pilots','Chinese Taipei','Taoyuan')
), linked as (
 select s.*,l.id league_id from seed s cross join public.leagues l where l.name='East Asia Super League'
)
insert into public.teams(name,country,city,league_id,league_name,active,basketball_type,source,last_synced_at)
select s.team,s.country,s.city,s.league_id,'East Asia Super League',true,'mens','official EASL 2026-27 field',now()
from linked s where not exists(select 1 from public.teams t where lower(t.name)=lower(s.team) and lower(t.country)=lower(s.country));

insert into public.team_league_memberships(team_id,league_id,season,active)
select t.id,l.id,'2026-27',true
from public.teams t join public.leagues l on l.name='East Asia Super League'
where position('East Asia Super League' in coalesce(t.league_name,''))>0
and not exists(select 1 from public.team_league_memberships m where m.team_id=t.id and m.league_id=l.id and m.season='2026-27');

insert into public.womens_leagues(name,country,level,active)
select 'FIBA Women’s Basketball League Asia 2026','Asia','Continental women’s club competition',true
where not exists(select 1 from public.womens_leagues where lower(name)=lower('FIBA Women’s Basketball League Asia 2026'));

with seed(team,country,city) as (values
('Sichuan Yuanda Meile','China','Chengdu'),('Cathay Life Tigers','Chinese Taipei','Taipei'),('Akari Sparks','Philippines','Manila'),('Denso Iris','Japan','Kariya'),('Cheongju KB Stars','South Korea','Cheongju'),('Indian Railways','India','New Delhi')
)
insert into public.womens_teams(name,country,city,league_name,active)
select s.team,s.country,s.city,'FIBA Women’s Basketball League Asia 2026',true
from seed s where not exists(select 1 from public.womens_teams t where lower(t.name)=lower(s.team) and lower(t.country)=lower(s.country));

update public.womens_teams t
set league_name=case when coalesce(t.league_name,'')='' then 'FIBA Women’s Basketball League Asia 2026'
when position('FIBA Women’s Basketball League Asia 2026' in t.league_name)>0 then t.league_name
else t.league_name || ' · FIBA Women’s Basketball League Asia 2026' end
where exists(select 1 from (values
('Sichuan Yuanda Meile','China'),('Cathay Life Tigers','Chinese Taipei'),('Akari Sparks','Philippines'),('Denso Iris','Japan'),('Cheongju KB Stars','South Korea'),('Indian Railways','India')
) x(name,country) where lower(x.name)=lower(t.name) and lower(x.country)=lower(t.country));

-- Existing EASL clubs may already have a domestic league label; preserve it while linking the regional competition.
with seed(team,country) as (values
('Alvark Tokyo','Japan'),('Goyang Sono Skygunners','South Korea'),('TSG GhostHawks','Chinese Taipei'),('South Gobi Broncos','Mongolia'),('Busan KCC Egis','South Korea'),('Macau Hou Chon','Macau'),('Taipei Fubon Braves','Chinese Taipei'),('Nagasaki Velca','Japan'),('Abra Weavers','Philippines'),('Hong Kong Eastern','Hong Kong'),('Ryukyu Golden Kings','Japan'),('Taoyuan Pauian Pilots','Chinese Taipei')
), linked as (
 select distinct t.id team_id,l.id league_id,t.league_name
 from seed s join public.teams t on lower(t.name)=lower(s.team) and lower(t.country)=lower(s.country)
 cross join public.leagues l where l.name='East Asia Super League'
)
update public.teams t set league_name=case when coalesce(x.league_name,'')='' then 'East Asia Super League' when position('East Asia Super League' in x.league_name)>0 then x.league_name else x.league_name || ' · East Asia Super League' end
from linked x where t.id=x.team_id;

insert into public.team_league_memberships(team_id,league_id,season,active)
select distinct t.id,l.id,'2026-27',true
from public.teams t join public.leagues l on l.name='East Asia Super League'
where position('East Asia Super League' in coalesce(t.league_name,''))>0
and exists(select 1 from (values
('Alvark Tokyo','Japan'),('Goyang Sono Skygunners','South Korea'),('TSG GhostHawks','Chinese Taipei'),('South Gobi Broncos','Mongolia'),('Busan KCC Egis','South Korea'),('Macau Hou Chon','Macau'),('Taipei Fubon Braves','Chinese Taipei'),('Nagasaki Velca','Japan'),('Abra Weavers','Philippines'),('Hong Kong Eastern','Hong Kong'),('Ryukyu Golden Kings','Japan'),('Taoyuan Pauian Pilots','Chinese Taipei')
) s(team,country) where lower(s.team)=lower(t.name) and lower(s.country)=lower(t.country))
and not exists(select 1 from public.team_league_memberships m where m.team_id=t.id and m.league_id=l.id and m.season='2026-27');
