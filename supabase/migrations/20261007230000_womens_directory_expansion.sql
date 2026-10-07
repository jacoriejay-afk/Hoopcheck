-- Expand verified women’s professional directory coverage.
insert into public.womens_leagues(name,country,level,active)
select v.name,v.country,v.level,true from (values
('WNBL Women','Australia','Professional'),
('Women’s British Basketball League','United Kingdom','Professional'),
('Israeli Women’s Basketball Premier League','Israel','Professional'),
('Belgian Women’s Basketball League','Belgium','Professional'),
('Swiss Women’s Basketball League','Switzerland','Professional'),
('Mexican LMBPF','Mexico','Professional'),
('Canadian Women’s Basketball League','Canada','Professional')
) v(name,country,level)
where not exists(select 1 from public.womens_leagues l where lower(l.name)=lower(v.name));

insert into public.womens_teams(name,country,city,league_id,active,league_name)
select v.team,v.country,v.city,l.id,true,l.name from (values
('Perth Lynx','Australia','Perth','WNBL Women'),('Southside Flyers','Australia','Melbourne','WNBL Women'),('Townsville Fire','Australia','Townsville','WNBL Women'),
('London Lions Women','United Kingdom','London','Women’s British Basketball League'),('Manchester Basketball Women','United Kingdom','Manchester','Women’s British Basketball League'),
('Maccabi Ashdod Women','Israel','Ashdod','Israeli Women’s Basketball Premier League'),('Elitzur Ramla Women','Israel','Ramla','Israeli Women’s Basketball Premier League'),
('Castors Braine Women','Belgium','Braine-l’Alleud','Belgian Women’s Basketball League'),('Belfius Namur Capitale Women','Belgium','Namur','Belgian Women’s Basketball League'),
('Elfic Fribourg Women','Switzerland','Fribourg','Swiss Women’s Basketball League'),('Hélios VS Basket Women','Switzerland','Vétroz','Swiss Women’s Basketball League'),
('Adelitas de Chihuahua Women','Mexico','Chihuahua','Mexican LMBPF'),('Libertadoras de Querétaro Women','Mexico','Querétaro','Mexican LMBPF'),
('University of Calgary Dinos Women','Canada','Calgary','Canadian Women’s Basketball League'),('University of Saskatchewan Huskies Women','Canada','Saskatoon','Canadian Women’s Basketball League')
) v(team,country,city,league_name)
join public.womens_leagues l on lower(l.name)=lower(v.league_name)
where not exists(select 1 from public.womens_teams t where lower(t.name)=lower(v.team) and lower(coalesce(t.country,''))=lower(v.country));