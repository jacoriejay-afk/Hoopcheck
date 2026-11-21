-- Review-only directory import. DO NOT auto-apply during Build 9 privacy/backend reconciliation.
-- Brazil's 2026 LBF club list was checked against production: the existing women's teams already cover it; do NOT duplicate.
-- https://lbf.com.br/noticias/pronta-para-comecar/
-- Verified 2026 Chile first division eight clubs: https://chilelnf.cl/lnf
-- Verified Defensor Sporting in 2026 WBL Americas: https://www.fiba.basketball/es/events/womens-basketball-league-americas-2026/news/wbl-americas-2026-teams-announced
-- Verified 2026/27 Argentine women's league:
-- https://webadc.gesdeportiva.es/lfb/noticia/52812/el-torneo-apertura-2026-ya-tiene-su-fixture-confirmado
-- Verified Brazil NBB 2026/27:
-- https://lnb.com.br/noticias/lnb-define-participantes-e-formato-da-temporada-2026-27-do-nbb-caixa/
-- Chile LNB 2026: https://lnbchile.com/liga/uno/equipos
-- This review-only file reflects production directory audit 2026-11-22 (11 existing Brazil women's teams and no Argentina/Chile/Uruguay women's teams).
-- Season context matters: a directory entry does not assert a currently active roster.
-- Preflight team-identity/alias review and isolated PostgreSQL rehearsal required before hosted run.
begin;

insert into public.womens_leagues(name,country,level,active)
select v.name,v.country,'Professional',true from (values
  ('Argentina Women’s Basketball League','Argentina'),
  ('Liga Nacional Femenina (Chile)','Chile'),
  ('Liga Femenina de Basketball (Uruguay)','Uruguay')
) as v(name,country)
where not exists (
  select 1 from public.womens_leagues l
  where lower(l.name)=lower(v.name) and lower(l.country)=lower(v.country)
);

with additions(name,country,league_name,city) as (values
  -- Chile Liga Nacional Femenina 2026 official first-division roster
  ('Colegio Los Leones Women','Chile','Liga Nacional Femenina (Chile)','Quilpué'),
  ('Sportiva Italiana Women','Chile','Liga Nacional Femenina (Chile)','Valparaíso'),
  ('Boston College Women','Chile','Liga Nacional Femenina (Chile)','Maipú'),
  ('Sergio Ceppi Women','Chile','Liga Nacional Femenina (Chile)','La Cisterna'),
  ('UdeC Women','Chile','Liga Nacional Femenina (Chile)','Concepción'),
  ('Azul y Rojo Women','Chile','Liga Nacional Femenina (Chile)','Santiago'),
  ('Gimnástico Women','Chile','Liga Nacional Femenina (Chile)','Valparaíso'),
  ('Luis Matte Larraín Women','Chile','Liga Nacional Femenina (Chile)','Puente Alto'),
  -- Uruguay FIBA-confirmed international participant 2026; domestic season association requires review
  ('Defensor Sporting Women','Uruguay','Liga Femenina de Basketball (Uruguay)','Montevideo'),
  -- Liga Femenina Argentina 2026/27, official three-zone fixture
  ('Instituto Women','Argentina','Argentina Women’s Basketball League','Córdoba'),
  ('Rocamora Women','Argentina','Argentina Women’s Basketball League','Concepción del Uruguay'),
  ('Sociedad Española Women','Argentina','Argentina Women’s Basketball League','San Luis'),
  ('San José Mendoza Women','Argentina','Argentina Women’s Basketball League','Mendoza'),
  ('Hindú Club Córdoba Women','Argentina','Argentina Women’s Basketball League','Córdoba'),
  ('Chañares Women','Argentina','Argentina Women’s Basketball League','James Craik'),
  ('Obras Basket Women','Argentina','Argentina Women’s Basketball League','Buenos Aires'),
  ('Unión Florida Women','Argentina','Argentina Women’s Basketball League','Florida'),
  ('Deportivo Berazategui Women','Argentina','Argentina Women’s Basketball League','Berazategui'),
  ('El Talar Women','Argentina','Argentina Women’s Basketball League','Buenos Aires'),
  ('Náutico Sportivo Avellaneda Women','Argentina','Argentina Women’s Basketball League','Rosario'),
  ('Ferro Carril Oeste Women','Argentina','Argentina Women’s Basketball League','Buenos Aires'),
  ('Regatas San Nicolás Women','Argentina','Argentina Women’s Basketball League','San Nicolás'),
  ('Quilmes Women','Argentina','Argentina Women’s Basketball League','Mar del Plata'),
  ('Peñarol Mar del Plata Women','Argentina','Argentina Women’s Basketball League','Mar del Plata'),
  ('Independiente Neuquén Women','Argentina','Argentina Women’s Basketball League','Neuquén'),
  ('El Biguá Women','Argentina','Argentina Women’s Basketball League','Neuquén'),
  ('Boca Juniors Women','Argentina','Argentina Women’s Basketball League','Buenos Aires'),
  ('Vélez Sarsfield Women','Argentina','Argentina Women’s Basketball League','Buenos Aires'),
  ('Unión Bahía Women','Argentina','Argentina Women’s Basketball League','Bahía Blanca')
)
insert into public.womens_teams(name,country,city,league_id,league_name,active)
select a.name,a.country,a.city,l.id,l.name,true
from additions a join public.womens_leagues l
  on l.name=a.league_name and l.country=a.country
where not exists (
  select 1 from public.womens_teams t
  where lower(coalesce(t.country,''))=lower(a.country)
  and regexp_replace(lower(t.name),' (women|basketball|basquete)$','','g') =
      regexp_replace(lower(a.name),' (women|basketball|basquete)$','','g')
);

insert into public.leagues(name,country,level,active)
select v.name,v.country,'Professional',true from (values
  ('Novo Basquete Brasil','Brazil'),
  ('Liga Nacional de Básquet','Argentina'),
  ('Liga Nacional de Básquet Chile','Chile')
) as v(name,country)
where not exists (select 1 from public.leagues l where lower(l.name)=lower(v.name) and lower(l.country)=lower(v.country));

with additions(name,country,city,league_name) as (values
  -- Missing candidates from NBB 2026/27; existing aliases must be reviewed first
  ('Basquete Cearense','Brazil','Fortaleza','Novo Basquete Brasil'),
  ('Botafogo Basquete','Brazil','Rio de Janeiro','Novo Basquete Brasil'),
  ('Caxias do Sul Basquete','Brazil','Caxias do Sul','Novo Basquete Brasil'),
  ('Cruzeiro Basquete','Brazil','Belo Horizonte','Novo Basquete Brasil'),
  ('Basket Osasco','Brazil','Osasco','Novo Basquete Brasil'),
  ('Pato Basquete','Brazil','Pato Branco','Novo Basquete Brasil'),
  ('São José Basketball','Brazil','São José dos Campos','Novo Basquete Brasil'),
  ('União Corinthians','Brazil','Santa Cruz do Sul','Novo Basquete Brasil'),
  ('Unifacisa','Brazil','Campina Grande','Novo Basquete Brasil'),
  -- Argentina 2026/27; Obras Basket already exists in production and is not re-added
  ('Lanús','Argentina','Lanús','Liga Nacional de Básquet'),
  ('Gimnasia de Comodoro Rivadavia','Argentina','Comodoro Rivadavia','Liga Nacional de Básquet'),
  ('Ferro Carril Oeste','Argentina','Buenos Aires','Liga Nacional de Básquet'),
  ('Regatas Corrientes','Argentina','Corrientes','Liga Nacional de Básquet'),
  ('Platense','Argentina','Vicente López','Liga Nacional de Básquet'),
  ('Oberá Tenis Club','Argentina','Oberá','Liga Nacional de Básquet'),
  ('Argentino de Junín','Argentina','Junín','Liga Nacional de Básquet'),
  -- Chile LNB Liga Chery 2026
  ('Municipal Español de Talca','Chile','Talca','Liga Nacional de Básquet Chile'),
  ('CSD Colo Colo','Chile','Santiago','Liga Nacional de Básquet Chile'),
  ('Universidad Católica Basketball','Chile','Santiago','Liga Nacional de Básquet Chile'),
  ('Municipal Puente Alto','Chile','Puente Alto','Liga Nacional de Básquet Chile'),
  ('ABA Ancud','Chile','Ancud','Liga Nacional de Básquet Chile'),
  ('CD Las Ánimas','Chile','Valdivia','Liga Nacional de Básquet Chile'),
  ('CD Castro','Chile','Castro','Liga Nacional de Básquet Chile'),
  ('Puerto Montt Basket','Chile','Puerto Montt','Liga Nacional de Básquet Chile'),
  ('Español de Osorno','Chile','Osorno','Liga Nacional de Básquet Chile'),
  ('Puerto Varas Basket','Chile','Puerto Varas','Liga Nacional de Básquet Chile')
)
insert into public.teams(name,country,city,league_id,league_name,active)
select a.name,a.country,a.city,l.id,l.name,true
from additions a join public.leagues l
  on l.name=a.league_name and l.country=a.country
where not exists (
  select 1 from public.teams t
  where lower(coalesce(t.country,''))=lower(a.country)
  and coalesce(t.basketball_type,'mens') <> 'womens'
  and regexp_replace(lower(t.name),' (basketball|basquete|basket)$','','g') =
      regexp_replace(lower(a.name),' (basketball|basquete|basket)$','','g')
);

-- Women's team mirror trigger should create exactly one official group per new club.
-- Verify counts, source aliases, league memberships, FK integrity, and rollback on staging.
commit;
