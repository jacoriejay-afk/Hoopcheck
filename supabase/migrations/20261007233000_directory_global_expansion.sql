-- Expand HoopCheck men's South American directory and women's European/Russian coverage.
insert into public.leagues(name,country,level,active)
select v.name,v.country,v.level,true
from (values
('Liga Nacional de Básquet','Argentina','Professional'),
('Novo Basquete Brasil','Brazil','Professional'),
('Liga Nacional de Básquet Chile','Chile','Professional'),
('Liga WPlay de Baloncesto','Colombia','Professional'),
('Liga Uruguaya de Basketball','Uruguay','Professional'),
('Liga Profesional de Baloncesto','Venezuela','Professional'),
('Liga Nacional de Basket','Peru','Professional')
) v(name,country,level)
where not exists(select 1 from public.leagues l where lower(l.name)=lower(v.name));

insert into public.teams(name,country,city,league_id,league_name,active)
select v.team,v.country,v.city,l.id,l.name,true
from (values
('Boca Juniors Basketball','Argentina','Buenos Aires','Liga Nacional de Básquet'),
('Quimsa','Argentina','Santiago del Estero','Liga Nacional de Básquet'),
('Instituto Córdoba','Argentina','Córdoba','Liga Nacional de Básquet'),
('San Lorenzo de Almagro','Argentina','Buenos Aires','Liga Nacional de Básquet'),
('Peñarol de Mar del Plata','Argentina','Mar del Plata','Liga Nacional de Básquet'),
('Flamengo Basketball','Brazil','Rio de Janeiro','Novo Basquete Brasil'),
('Sesi Franca Basquete','Brazil','Franca','Novo Basquete Brasil'),
('Minas Tênis Clube','Brazil','Belo Horizonte','Novo Basquete Brasil'),
('Paulistano Basketball','Brazil','São Paulo','Novo Basquete Brasil'),
('Pinheiros Basketball','Brazil','São Paulo','Novo Basquete Brasil'),
('Universidad de Concepción','Chile','Concepción','Liga Nacional de Básquet Chile'),
('Leones de Quilpué','Chile','Quilpué','Liga Nacional de Básquet Chile'),
('CD Valdivia','Chile','Valdivia','Liga Nacional de Básquet Chile'),
('Titanes de Barranquilla','Colombia','Barranquilla','Liga WPlay de Baloncesto'),
('Búcaros de Bucaramanga','Colombia','Bucaramanga','Liga WPlay de Baloncesto'),
('Cocodrilos de Caracas','Venezuela','Caracas','Liga Profesional de Baloncesto'),
('Trotamundos de Carabobo','Venezuela','Valencia','Liga Profesional de Baloncesto'),
('Aguada','Uruguay','Montevideo','Liga Uruguaya de Basketball'),
('Malvín','Uruguay','Montevideo','Liga Uruguaya de Basketball'),
('Hebraica Macabi','Uruguay','Montevideo','Liga Uruguaya de Basketball'),
('Universitario de Deportes Basketball','Peru','Lima','Liga Nacional de Basket'),
('Regatas Lima Basketball','Peru','Lima','Liga Nacional de Basket')
) v(team,country,city,league_name)
join public.leagues l on lower(l.name)=lower(v.league_name)
where not exists(select 1 from public.teams t where lower(t.name)=lower(v.team) and lower(coalesce(t.country,''))=lower(v.country));

insert into public.womens_leagues(name,country,level,active)
select v.name,v.country,v.level,true
from (values
('Russian Women’s Basketball Premier League','Russia','Professional'),
('Russian Women’s Basketball Super League','Russia','Professional'),
('Liga Femenina Endesa','Spain','Professional'),
('Ligue Féminine de Basketball','France','Professional'),
('Lega Basket Femminile','Italy','Professional'),
('Czech Women’s Basketball League','Czechia','Professional'),
('Hungarian Women’s Basketball League','Hungary','Professional'),
('Polish Women’s Basketball League','Poland','Professional'),
('Serbian Women’s Basketball League','Serbia','Professional'),
('Lithuanian Women’s Basketball League','Lithuania','Professional'),
('Latvian Women’s Basketball League','Latvia','Professional'),
('German Women’s Basketball Bundesliga','Germany','Professional'),
('Turkish Women’s Basketball Super League','Türkiye','Professional'),
('Greek Women’s Basketball League','Greece','Professional')
) v(name,country,level)
where not exists(select 1 from public.womens_leagues l where lower(l.name)=lower(v.name));

insert into public.womens_teams(name,country,city,league_id,league_name,active)
select v.team,v.country,v.city,l.id,l.name,true
from (values
('UMMC Ekaterinburg Women','Russia','Yekaterinburg','Russian Women’s Basketball Premier League'),
('Dynamo Kursk Women','Russia','Kursk','Russian Women’s Basketball Premier League'),
('Nadezhda Orenburg Women','Russia','Orenburg','Russian Women’s Basketball Premier League'),
('MBA Moscow Women','Russia','Moscow','Russian Women’s Basketball Premier League'),
('Nika Syktyvkar Women','Russia','Syktyvkar','Russian Women’s Basketball Super League'),
('Spartak Noginsk Women','Russia','Noginsk','Russian Women’s Basketball Super League'),
('Enisey Women','Russia','Krasnoyarsk','Russian Women’s Basketball Super League'),
('Perfumerías Avenida Women','Spain','Salamanca','Liga Femenina Endesa'),
('Uni Girona Women','Spain','Girona','Liga Femenina Endesa'),
('Casademont Zaragoza Women','Spain','Zaragoza','Liga Femenina Endesa'),
('Movistar Estudiantes Women','Spain','Madrid','Liga Femenina Endesa'),
('LDLC ASVEL Feminin','France','Lyon','Ligue Féminine de Basketball'),
('Bourges Basket Women','France','Bourges','Ligue Féminine de Basketball'),
('Basket Landes Women','France','Mont-de-Marsan','Ligue Féminine de Basketball'),
('Villeneuve-d’Ascq Women','France','Villeneuve-d’Ascq','Ligue Féminine de Basketball'),
('Famila Schio Women','Italy','Schio','Lega Basket Femminile'),
('Virtus Bologna Women','Italy','Bologna','Lega Basket Femminile'),
('Reyer Venezia Women','Italy','Venice','Lega Basket Femminile'),
('ZVVZ USK Praha Women','Czechia','Prague','Czech Women’s Basketball League'),
('Basket Brno Women','Czechia','Brno','Czech Women’s Basketball League'),
('Sopron Basket Women','Hungary','Sopron','Hungarian Women’s Basketball League'),
('DVTK HUN-Therm Women','Hungary','Miskolc','Hungarian Women’s Basketball League'),
('AZS UMCS Lublin Women','Poland','Lublin','Polish Women’s Basketball League'),
('VBW Gdynia Women','Poland','Gdynia','Polish Women’s Basketball League'),
('Crvena zvezda Women','Serbia','Belgrade','Serbian Women’s Basketball League'),
('Partizan Women','Serbia','Belgrade','Serbian Women’s Basketball League'),
('Žalgiris Kaunas Women','Lithuania','Kaunas','Lithuanian Women’s Basketball League'),
('Kibirkštis Vilnius Women','Lithuania','Vilnius','Lithuanian Women’s Basketball League'),
('TTT Riga Women','Latvia','Riga','Latvian Women’s Basketball League'),
('Rīgas Stradiņš University Women','Latvia','Riga','Latvian Women’s Basketball League'),
('ALBA Berlin Women','Germany','Berlin','German Women’s Basketball Bundesliga'),
('Herner TC Women','Germany','Herne','German Women’s Basketball Bundesliga'),
('Fenerbahçe Women','Türkiye','Istanbul','Turkish Women’s Basketball Super League'),
('Galatasaray Women','Türkiye','Istanbul','Turkish Women’s Basketball Super League'),
('Olympiacos Women','Greece','Piraeus','Greek Women’s Basketball League'),
('Panathinaikos Women','Greece','Athens','Greek Women’s Basketball League')
) v(team,country,city,league_name)
join public.womens_leagues l on lower(l.name)=lower(v.league_name)
where not exists(select 1 from public.womens_teams t where lower(t.name)=lower(v.team) and lower(coalesce(t.country,''))=lower(v.country));
