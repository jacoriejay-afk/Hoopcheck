-- Expand the women-only directory with officially announced 2026-27 European club competition teams.
-- This migration intentionally writes only to womens_leagues and womens_teams.
-- It does not re-enable WNBA entries or add women's teams to the main player-search directory.

insert into public.womens_leagues(name,country,level,active)
select v.name,v.country,v.level,true
from (values
  ('EuroLeague Women 2026-27','Europe','European competition'),
  ('EuroCup Women 2026-27','Europe','European competition')
) v(name,country,level)
where not exists (
  select 1 from public.womens_leagues l where lower(l.name)=lower(v.name)
);

with seed(team,country,city,league_name) as (
  values
  -- EuroLeague Women 2026-27: regular-season and qualifier clubs announced by FIBA
  ('Athinaikos Qualco','Greece','Athens','EuroLeague Women 2026-27'),
  ('AZS UMCS Lublin','Poland','Lublin','EuroLeague Women 2026-27'),
  ('Basket Landes','France','Mont-de-Marsan','EuroLeague Women 2026-27'),
  ('Beretta Famila Schio','Italy','Schio','EuroLeague Women 2026-27'),
  ('Casademont Zaragoza','Spain','Zaragoza','EuroLeague Women 2026-27'),
  ('CS Rapid Bucuresti','Romania','Bucharest','EuroLeague Women 2026-27'),
  ('Fenerbahce Opet','Türkiye','Istanbul','EuroLeague Women 2026-27'),
  ('Galatasaray Cagdas Faktoring','Türkiye','Istanbul','EuroLeague Women 2026-27'),
  ('Kangoeroes Mechelen','Belgium','Mechelen','EuroLeague Women 2026-27'),
  ('Tango Bourges Basket','France','Bourges','EuroLeague Women 2026-27'),
  ('Valencia Basket Club','Spain','Valencia','EuroLeague Women 2026-27'),
  ('ZVVZ USK Praha','Czechia','Prague','EuroLeague Women 2026-27'),
  ('DVTK Miskolc','Hungary','Miskolc','EuroLeague Women 2026-27'),
  ('Emlak Konut','Türkiye','Istanbul','EuroLeague Women 2026-27'),
  ('ENEA AZS Poznan','Poland','Poznan','EuroLeague Women 2026-27'),
  ('Flammes Carolo Basket','France','Charleville-Mézières','EuroLeague Women 2026-27'),
  ('Kibirkstis Vilnius','Lithuania','Vilnius','EuroLeague Women 2026-27'),
  ('KKZ Crvena Zvezda','Serbia','Belgrade','EuroLeague Women 2026-27'),
  ('KP Brno','Czechia','Brno','EuroLeague Women 2026-27'),
  ('Panathinaikos AC','Greece','Athens','EuroLeague Women 2026-27'),
  ('Sopron Basket','Hungary','Sopron','EuroLeague Women 2026-27'),
  ('Spar Girona','Spain','Girona','EuroLeague Women 2026-27'),
  ('Umana Reyer Venezia','Italy','Venice','EuroLeague Women 2026-27'),
  ('Zabiny Brno','Czechia','Brno','EuroLeague Women 2026-27'),

  -- EuroCup Women 2026-27: named registered clubs (excluding unnamed qualifier placeholders)
  ('AEL Limassol','Cyprus','Limassol','EuroCup Women 2026-27'),
  ('ALBA Berlin','Germany','Berlin','EuroCup Women 2026-27'),
  ('Basket Namur Capitale','Belgium','Namur','EuroCup Women 2026-27'),
  ('BCC Derthona Basket','Italy','Tortona','EuroCup Women 2026-27'),
  ('BCF Elfic Fribourg','Switzerland','Fribourg','EuroCup Women 2026-27'),
  ('BC Montana 2003','Bulgaria','Montana','EuroCup Women 2026-27'),
  ('Besiktas BOA','Türkiye','Istanbul','EuroCup Women 2026-27'),
  ('BLMA','France','Lattes','EuroCup Women 2026-27'),
  ('Castors Braine','Belgium','Braine-l’Alleud','EuroCup Women 2026-27'),
  ('CIMSA CBK Mersin','Türkiye','Mersin','EuroCup Women 2026-27'),
  ('Cinkarna Celje','Slovenia','Celje','EuroCup Women 2026-27'),
  ('Charnay Basket','France','Charnay-lès-Mâcon','EuroCup Women 2026-27'),
  ('DSK Basketball Brandys','Czechia','Brandýs nad Labem','EuroCup Women 2026-27'),
  ('Duran Maquinaria Ensino','Spain','Lugo','EuroCup Women 2026-27'),
  ('Helsinki Basketball Academy','Finland','Helsinki','EuroCup Women 2026-27'),
  ('Hozono Global Jairis','Spain','Alcantarilla','EuroCup Women 2026-27'),
  ('KS AZS AJP Gorzow','Poland','Gorzów Wielkopolski','EuroCup Women 2026-27'),
  ('Landerneau Bretagne','France','Landerneau','EuroCup Women 2026-27'),
  ('Maccabi Bnot Ashdod','Israel','Ashdod','EuroCup Women 2026-27'),
  ('Magnolia Basket Campobasso','Italy','Campobasso','EuroCup Women 2026-27'),
  ('MBK Ruzomberok','Slovakia','Ružomberok','EuroCup Women 2026-27'),
  ('Meins Avenida','Spain','Salamanca','EuroCup Women 2026-27'),
  ('Nyon Basket Feminin','Switzerland','Nyon','EuroCup Women 2026-27'),
  ('Olympiacos SFP','Greece','Piraeus','EuroCup Women 2026-27'),
  ('Panathlitikos Sykeon','Greece','Thessaloniki','EuroCup Women 2026-27'),
  ('Panserraikos','Greece','Serres','EuroCup Women 2026-27'),
  ('Rutronik Stars Keltern','Germany','Keltern','EuroCup Women 2026-27'),
  ('SBS Ostrava','Czechia','Ostrava','EuroCup Women 2026-27'),
  ('SL Benfica','Portugal','Lisbon','EuroCup Women 2026-27'),
  ('Sleza Wroclaw','Poland','Wroclaw','EuroCup Women 2026-27'),
  ('TTT Riga','Latvia','Riga','EuroCup Women 2026-27'),
  ('Universitatea Cluj','Romania','Cluj-Napoca','EuroCup Women 2026-27'),
  ('UZKK Student Nis','Serbia','Nis','EuroCup Women 2026-27'),
  ('Villeneuve d’Ascq LM','France','Villeneuve-d’Ascq','EuroCup Women 2026-27'),
  ('ZKK Brod Na Savi','Croatia','Slavonski Brod','EuroCup Women 2026-27'),
  ('BAXI Ferrol','Spain','Ferrol','EuroCup Women 2026-27'),
  ('BC Beroe Stara Zagora','Bulgaria','Stara Zagora','EuroCup Women 2026-27'),
  ('C’Chartres Basket','France','Chartres','EuroCup Women 2026-27'),
  ('Elitzur Ramla','Israel','Ramla','EuroCup Women 2026-27'),
  ('GEAS Basket','Italy','Sesto San Giovanni','EuroCup Women 2026-27'),
  ('Impulso 360 Estepona','Spain','Estepona','EuroCup Women 2026-27'),
  ('Levhartice Chomutov','Czechia','Chomutov','EuroCup Women 2026-27'),
  ('Proteas Voulas','Greece','Voula','EuroCup Women 2026-27'),
  ('Ravens de Geneve','Switzerland','Geneva','EuroCup Women 2026-27'),
  ('Saarlouis Royals','Germany','Saarlouis','EuroCup Women 2026-27')
)
insert into public.womens_teams(name,country,city,league_id,active,league_name)
select s.team,s.country,s.city,l.id,true,l.name
from seed s
join public.womens_leagues l on lower(l.name)=lower(s.league_name)
where not exists (
  select 1 from public.womens_teams t
  where lower(t.name)=lower(s.team)
    and lower(coalesce(t.country,''))=lower(coalesce(s.country,''))
);

-- Source registry/evidence is recorded in each row's league affiliation; the official
-- 2026-27 lists are published by FIBA EuroLeague Women and EuroCup Women.
