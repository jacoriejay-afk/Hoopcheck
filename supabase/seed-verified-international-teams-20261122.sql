-- Source-verified 2026/27 directory additions (data-only, idempotent).
-- Does not overwrite claimed profiles, create unlicensed crests or change RLS.
-- Roster evidence: https://deportv.gob.ar/basquetbol/liga-nacional-basquet-202627-calendario-equipos-planteles-nid:17463
-- https://webadc.gesdeportiva.es/laligaargentina/formato
-- https://sipse.com/novedades/calor-cancun-femenil-listo-debutar-temporada-2026-lnbp-505444.html
-- https://deportedigital.mx/la-liga-de-mexico-de-basquetbol-profesional-anuncia-la-temporada-2026-con-seis-equipos-confirmados
-- Note: Mexico women 2026 competitions / Argentina 2026-27 competition season.
begin;
select pg_advisory_xact_lock(hashtext('hoopcheck:verified-club-coverage:20261122'));

-- Distinct men’s second tier; do not repurpose the top-flight Liga Nacional.
insert into public.leagues(name,country,level,basketball_type,active,source,season)
select 'La Liga Argentina','Argentina','Professional second division','mens',true,
  'https://webadc.gesdeportiva.es/laligaargentina/formato','2026-27'
where not exists (
  select 1 from public.leagues l where lower(btrim(l.name))=lower('La Liga Argentina')
  and l.country='Argentina' and l.basketball_type='mens'
);

insert into public.womens_leagues(name,country,level,active)
select v.name,'Mexico','Professional',true
from (values ('LNBP Femenil'),('Liga de México (LMBPF)')) v(name)
where not exists (
  select 1 from public.womens_leagues l where lower(btrim(l.name))=lower(btrim(v.name))
  and l.country='Mexico'
);

-- Never insert a men's club if that gender/country/name is already present.
-- The league_id is set to a current exact-country league if one exists.
with roster(name,city,league_name) as (
 values
  ('Atenas','Córdoba','Liga Nacional de Básquet'),
  ('La Unión de Formosa','Formosa','Liga Nacional de Básquet'),
  ('Olímpico La Banda','La Banda','Liga Nacional de Básquet'),
  ('Peñarol Mar del Plata','Mar del Plata','Liga Nacional de Básquet'),
  ('Racing de Chivilcoy','Chivilcoy','Liga Nacional de Básquet'),
  ('San Martín de Corrientes','Corrientes','Liga Nacional de Básquet'),
  ('Centenario de Venado Tuerto','Venado Tuerto','La Liga Argentina'),
  ('Central Entrerriano','Gualeguaychú','La Liga Argentina'),
  ('Ciclista Juninense','Junín','La Liga Argentina'),
  ('Deportivo Norte de Armstrong','Armstrong','La Liga Argentina'),
  ('Deportivo Viedma','Viedma','La Liga Argentina'),
  ('Gimnasia y Esgrima La Plata','La Plata','La Liga Argentina'),
  ('La Unión de Colón','Colón','La Liga Argentina'),
  ('Pergamino Básquet','Pergamino','La Liga Argentina'),
  ('Pico FC','General Pico','La Liga Argentina'),
  ('Provincial de Rosario','Rosario','La Liga Argentina'),
  ('Quilmes de Mar del Plata','Mar del Plata','La Liga Argentina'),
  ('Racing Club de Avellaneda','Avellaneda','La Liga Argentina'),
  ('Regatas de San Nicolás','San Nicolás','La Liga Argentina'),
  ('River Plate','Buenos Aires','La Liga Argentina'),
  ('Tomás de Rocamora','Concepción del Uruguay','La Liga Argentina'),
  ('Unión de Mar del Plata','Mar del Plata','La Liga Argentina'),
  ('Villa Mitre de Bahía Blanca','Bahía Blanca','La Liga Argentina')
)
insert into public.teams(name,city,country,league_name,league_id,active,basketball_type,source)
select r.name,r.city,'Argentina',r.league_name,
  (select l.id from public.leagues l where l.name=r.league_name and l.country='Argentina'
   and l.basketball_type='mens' order by l.id limit 1),
  true,'mens','HoopCheck verified 2026-27 roster'
from roster r
where not exists (
  select 1 from public.teams t where lower(btrim(t.name))=lower(btrim(r.name))
  and t.country='Argentina' and t.basketball_type='mens'
);

-- Small source-reviewed, copyright-public-domain raster crest pilot.
-- Both Commons pages identify the exact Argentina basketball clubs and mark the
-- simple text/geometric artwork PD-textlogo; trademarks remain separate.
-- This does not represent an endorsement, does not overwrite user-uploaded
-- logos, and is limited to brand-new records from this seed.
-- Atenas: https://commons.wikimedia.org/wiki/File:Atenas_cordoba_logo.png
-- Olimpíco: https://commons.wikimedia.org/wiki/File:Escudo_del_Club_Ciclista_Ol%C3%ADmpico.png
-- Source-file details & trademark cautions: docs/team-logo-source-review-20261122.md
with raster_crest(name, image_url) as (
  values
    ('Atenas', 'https://upload.wikimedia.org/wikipedia/commons/4/49/Atenas_cordoba_logo.png'),
    ('Olímpico La Banda', 'https://upload.wikimedia.org/wikipedia/commons/4/41/Escudo_del_Club_Ciclista_Ol%C3%ADmpico.png')
)
update public.teams t
set logo_url = c.image_url, logo_bg = 'transparent'
from raster_crest c
where t.name = c.name and t.country = 'Argentina'
  and t.basketball_type = 'mens'
  and t.source = 'HoopCheck verified 2026-27 roster'
  and nullif(btrim(coalesce(t.logo_url, '')), '') is null;

-- womens_teams is the authoritative source for these clubs.
-- Existing trigger creates the corresponding same-UUID teams mirror and fan group.
-- Never insert into teams separately for a women’s team.
with roster(name,city,league_name) as (
 values
  ('El Calor de Cancún Femenil','Cancún','LNBP Femenil'),
  ('Adelitas de Chihuahua','Chihuahua','LNBP Femenil'),
  ('Freseras de Irapuato','Irapuato','LNBP Femenil'),
  ('Panteras de Aguascalientes Femenil','Aguascalientes','LNBP Femenil'),
  ('Correcaminos UAT Femenil','Ciudad Victoria','LNBP Femenil'),
  ('Fuerza Regia Femenil','Monterrey','LNBP Femenil'),
  ('Abejas de León Femenil','León','LNBP Femenil'),
  ('Santas del Potosí','San Luis Potosí','LNBP Femenil'),
  ('Toritas de Celaya','Celaya','Liga de México (LMBPF)'),
  ('Mieleras de Guanajuato','Guanajuato','Liga de México (LMBPF)'),
  ('Libélulas de CDMX','Ciudad de México','Liga de México (LMBPF)'),
  ('Mineras de Zacatecas','Zacatecas','Liga de México (LMBPF)'),
  ('Dragonas del Estado de México','Toluca','Liga de México (LMBPF)'),
  ('Estrellas de Puebla','Puebla','Liga de México (LMBPF)')
)
insert into public.womens_teams(name,city,country,league_name,league_id,active)
select r.name,r.city,'Mexico',r.league_name,
 (select wl.id from public.womens_leagues wl where wl.name=r.league_name and wl.country='Mexico'
  order by wl.id limit 1),true
from roster r
where not exists (
  select 1 from public.womens_teams wt where lower(btrim(wt.name))=lower(btrim(r.name))
  and wt.country='Mexico'
)
and not exists (
  select 1 from public.teams t where t.basketball_type='womens' and t.country='Mexico'
  and lower(btrim(t.name))=lower(btrim(r.name))
  and coalesce(t.source,'') <> 'womens_teams_mirror'
);

commit;
