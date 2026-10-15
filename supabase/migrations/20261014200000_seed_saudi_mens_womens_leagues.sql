-- Add Saudi Arabia's domestic men's and women's senior leagues as Middle East coverage.
insert into public.leagues(name,country,level,season,basketball_type,active,source,last_synced_at)
select 'Saudi Basketball League','Saudi Arabia','National first division','2026-27','mens',true,'Saudi Basketball Federation club list',now()
where not exists(select 1 from public.leagues where lower(name)=lower('Saudi Basketball League'));

with seed(team,city) as (values
('Al-Ahli','Jeddah'),('Al-Fateh','Al-Hofuf'),('Al-Ittihad','Jeddah'),('Al-Khaleej','Saihat'),('Al-Khowildiah','Qatif'),('Al-Nassr','Riyadh'),('Al-Safa','Qatif'),('Al-Salam','Qatif'),('Al-Ula','Al-Ula'),('Ohud Medina','Medina')
), linked as (
 select s.*,l.id league_id from seed s cross join public.leagues l where l.name='Saudi Basketball League'
)
insert into public.teams(name,country,city,league_id,league_name,active,basketball_type,source,last_synced_at)
select s.team,'Saudi Arabia',s.city,s.league_id,'Saudi Basketball League',true,'mens','Saudi Basketball Federation club list',now()
from linked s where not exists(select 1 from public.teams t where lower(t.name)=lower(s.team) and lower(t.country)='saudi arabia');

update public.teams t set league_name=case when coalesce(t.league_name,'')='' then 'Saudi Basketball League' when position('Saudi Basketball League' in t.league_name)>0 then t.league_name else t.league_name || ' · Saudi Basketball League' end
where lower(t.country)='saudi arabia' and lower(t.name) in ('al-ahli','al-fateh','al-ittihad','al-khaleej','al-khowildiah','al-nassr','al-safa','al-salam','al-ula','ohud medina');

insert into public.team_league_memberships(team_id,league_id,season,active)
select t.id,l.id,'2026-27',true from public.teams t join public.leagues l on l.name='Saudi Basketball League'
where lower(t.country)='saudi arabia' and lower(t.name) in ('al-ahli','al-fateh','al-ittihad','al-khaleej','al-khowildiah','al-nassr','al-safa','al-salam','al-ula','ohud medina')
and not exists(select 1 from public.team_league_memberships m where m.team_id=t.id and m.league_id=l.id and m.season='2026-27');

insert into public.womens_leagues(name,country,level,active)
select 'Saudi Women’s Basketball League','Saudi Arabia','National women’s first division',true
where not exists(select 1 from public.womens_leagues where lower(name)=lower('Saudi Women’s Basketball League'));

with seed(team,city) as (values
('Al-Ahli','Jeddah'),('Al-Ittihad','Jeddah'),('Al-Nassr','Riyadh'),('Al-Okhdood','Najran'),('Al-Qadsiah','Khobar'),('Al-Ula','Al-Ula')
)
insert into public.womens_teams(name,country,city,league_name,active)
select s.team,'Saudi Arabia',s.city,'Saudi Women’s Basketball League',true
from seed s where not exists(select 1 from public.womens_teams t where lower(t.name)=lower(s.team) and lower(t.country)='saudi arabia');

-- Deactivate legacy aliases in this competition membership only; preserve the team rows and any reviews.
update public.team_league_memberships m set active=false
from public.leagues l, public.teams t
where l.id=m.league_id and t.id=m.team_id and l.name='Saudi Basketball League'
and m.season='2026-27' and lower(t.country)='saudi arabia'
and lower(t.name) in ('al ula','ittihad club');
