-- Review-only directory import. DO NOT auto-apply during Build 9 privacy/backend reconciliation.
-- Verified 2026 Brazil LBF: https://lbf.com.br/noticias/pronta-para-comecar/
-- Verified 2026/27 Argentine women's league:
-- https://webadc.gesdeportiva.es/lfb/noticia/52812/el-torneo-apertura-2026-ya-tiene-su-fixture-confirmado
-- Verified Brazil NBB 2026/27:
-- https://lnb.com.br/noticias/lnb-define-participantes-e-formato-da-temporada-2026-27-do-nbb-caixa/
-- Chile LNB 2026: https://lnbchile.com/liga/uno/equipos
-- Season context matters: a directory entry does not assert a currently active roster.
-- Preflight team-identity/alias review and isolated PostgreSQL rehearsal required before hosted run.
begin;

insert into public.womens_leagues(name,country,level,active)
select v.name,v.country,'Professional',true from (values
  ('Brazilian LBF','Brazil'),
  ('Argentina Women’s Basketball League','Argentina')
) as v(name,country)
where not exists (
  select 1 from public.womens_leagues l
  where lower(l.name)=lower(v.name) and lower(l.country)=lower(v.country)
);

with additions(name,country,league_name,city) as (values
  -- LBF 2026 official participating teams
  ('ADRM Maringá Women','Brazil','Brazilian LBF','Maringá'),
  ('Cerrado BRB Women','Brazil','Brazilian LBF','Brasília'),
  ('Pontz São José Basketball Women','Brazil','Brazilian LBF','São José dos Campos'),
  ('Salvador Basketball Women','Brazil','Brazilian LBF','Salvador'),
  ('Sampaio Basquete Women','Brazil','Brazilian LBF','São Luís'),
  ('Santo André Women','Brazil','Brazilian LBF','Santo André'),
  ('SESI Araraquara Basquete Women','Brazil','Brazilian LBF','Araraquara'),
  ('Sodiê Mesquita Women','Brazil','Brazilian LBF','Mesquita'),
  ('Sport/Uninassau/Instituto Todos Women','Brazil','Brazilian LBF','Recife'),
  ('Unimed Campinas Basquete Women','Brazil','Brazilian LBF','Campinas'),
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
  -- Argentina 2026/27; preserve existing records on matching normalized names
  ('Lanús','Argentina','Lanús','Liga Nacional de Básquet'),
  ('Gimnasia de Comodoro Rivadavia','Argentina','Comodoro Rivadavia','Liga Nacional de Básquet'),
  ('Obras Basket','Argentina','Buenos Aires','Liga Nacional de Básquet'),
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
