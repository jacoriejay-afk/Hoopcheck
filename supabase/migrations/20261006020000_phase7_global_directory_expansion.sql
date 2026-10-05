-- Phase 7: expanded Middle East, Asia and Latin America directory
insert into public.leagues(name,country,level,season,source,active)
select * from (values
('Saudi Basketball League','Saudi Arabia','1st division','2026-27','fiba-current-2026',true),
('UAE National Basketball League','United Arab Emirates','1st division','2026-27','fiba-current-2026',true),
('Qatar Basketball League','Qatar','1st division','2026-27','qatar-basketball-federation-2026',true),
('Kuwait Basketball League','Kuwait','1st division','2026-27','fiba-current-2026',true),
('Lebanese Basketball League','Lebanon','1st division','2026-27','fiba-current-2026',true),
('Iran Basketball Super League','Iran','1st division','2026-27','fiba-current-2026',true),
('Japan B.LEAGUE','Japan','1st division','2026-27','japan-b-league-2026',true),
('Korean Basketball League','South Korea','1st division','2026-27','easl-2026',true),
('P.LEAGUE+','Chinese Taipei','1st division','2026-27','easl-2026',true),
('Philippine Basketball Association','Philippines','1st division','2026','easl-2026',true),
('Mongolian The League','Mongolia','1st division','2026-27','easl-2026',true),
('NBB','Brazil','1st division','2026-27','lnb-2026-27',true),
('Liga Nacional de Básquet','Argentina','1st division','2026-27','fiba-current-2026',true),
('LNBP','Mexico','1st division','2026','fiba-current-2026',true),
('Liga Nacional de Básquet Chile','Chile','1st division','2026','fiba-current-2026',true),
('Liga Uruguaya de Basketball','Uruguay','1st division','2026','fiba-current-2026',true),
('Baloncesto Superior Nacional','Puerto Rico','1st division','2026','fiba-current-2026',true)
) s(name,country,level,season,source,active)
where not exists(select 1 from public.leagues l where lower(l.name)=lower(s.name) and l.country=s.country);

with seed(name,country,city,league_name,source) as (values
('Al Riyadi Beirut','Lebanon','Beirut','Lebanese Basketball League','fiba-current-2026'),
('Sagesse Beirut','Lebanon','Beirut','Lebanese Basketball League','fiba-current-2026'),
('Kuwait SC','Kuwait','Kuwait City','Kuwait Basketball League','fiba-current-2026'),
('Al Arabi SC','Qatar','Doha','Qatar Basketball League','qatar-basketball-federation-2026'),
('Al Rayyan','Qatar','Doha','Qatar Basketball League','qatar-basketball-federation-2026'),
('Al Sadd','Qatar','Doha','Qatar Basketball League','qatar-basketball-federation-2026'),
('Qatar SC','Qatar','Doha','Qatar Basketball League','qatar-basketball-federation-2026'),
('Al Ula','Saudi Arabia','Al Ula','Saudi Basketball League','fiba-current-2026'),
('Ittihad Club','Saudi Arabia','Jeddah','Saudi Basketball League','fiba-current-2026'),
('Shahrdari Gorgan','Iran','Gorgan','Iran Basketball Super League','fiba-current-2026'),
('Alvark Tokyo','Japan','Tokyo','Japan B.LEAGUE','japan-b-league-2026'),
('Chiba Jets','Japan','Funabashi','Japan B.LEAGUE','japan-b-league-2026'),
('Ryukyu Golden Kings','Japan','Okinawa','Japan B.LEAGUE','japan-b-league-2026'),
('Nagasaki Velca','Japan','Nagasaki','Japan B.LEAGUE','japan-b-league-2026'),
('Busan KCC Egis','South Korea','Busan','Korean Basketball League','easl-2026'),
('Goyang Sono Skygunners','South Korea','Goyang','Korean Basketball League','easl-2026'),
('Taipei Fubon Braves','Chinese Taipei','Taipei','P.LEAGUE+','easl-2026'),
('Taoyuan Pauian Pilots','Chinese Taipei','Taoyuan','P.LEAGUE+','easl-2026'),
('Hong Kong Eastern','Hong Kong','Hong Kong','P.LEAGUE+','easl-2026'),
('Abra Weavers','Philippines','Baguio','Philippine Basketball Association','easl-2026'),
('Zac Bronco','Mongolia','Ulaanbaatar','Mongolian The League','easl-2026'),
('Flamengo','Brazil','Rio de Janeiro','NBB','lnb-2026-27'),
('Sesi Franca','Brazil','Franca','NBB','lnb-2026-27'),
('Minas Storm','Brazil','Belo Horizonte','NBB','lnb-2026-27'),
('Corinthians','Brazil','São Paulo','NBB','lnb-2026-27'),
('Brasília Basquete','Brazil','Brasília','NBB','lnb-2026-27'),
('Bauru Basket','Brazil','Bauru','NBB','lnb-2026-27'),
('Mogi Basquete','Brazil','Mogi das Cruzes','NBB','lnb-2026-27'),
('San Lorenzo','Argentina','Buenos Aires','Liga Nacional de Básquet','fiba-current-2026'),
('Boca Juniors','Argentina','Buenos Aires','Liga Nacional de Básquet','fiba-current-2026'),
('Instituto','Argentina','Córdoba','Liga Nacional de Básquet','fiba-current-2026'),
('Quimsa','Argentina','Santiago del Estero','Liga Nacional de Básquet','fiba-current-2026'),
('Olimpia Kings','Paraguay','Asunción','Liga Nacional de Básquet','fiba-current-2026'),
('Importadora Alvarado','Ecuador','Ambato','Liga Nacional de Básquet','fiba-current-2026'),
('Independiente de Oliva','Argentina','Oliva','Liga Nacional de Básquet','fiba-current-2026'),
('Fluminense','Brazil','Rio de Janeiro','NBB','lnb-2026-27'),
('Basquete Assis','Brazil','Assis','NBB','cbb-2026-27'),
('Brusque Basquete','Brazil','Brusque','NBB','cbb-2026-27'))
insert into public.teams(name,country,city,league_name,source,active)
select s.name,s.country,s.city,s.league_name,s.source,true from seed s
where not exists(select 1 from public.teams t where lower(t.name)=lower(s.name) and t.country=s.country);

update public.teams t set league_id=l.id from public.leagues l
where t.league_name=l.name and t.country=l.country
and t.source in ('fiba-current-2026','qatar-basketball-federation-2026','japan-b-league-2026','easl-2026','lnb-2026-27','cbb-2026-27');

insert into public.team_league_memberships(team_id,league_id,season,active)
select t.id,l.id,coalesce(l.season,'2026-27'),true from public.teams t join public.leagues l on l.id=t.league_id
where t.source in ('fiba-current-2026','qatar-basketball-federation-2026','japan-b-league-2026','easl-2026','lnb-2026-27','cbb-2026-27')
on conflict(team_id,league_id,season) do nothing;
