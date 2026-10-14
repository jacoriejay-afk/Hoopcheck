-- 2026-27 Europe Cup directories. Men and women are kept in separate tables.
insert into public.womens_leagues(name,country,level,active)
select 'EuroCup Women 2026-27','Europe','European competition',true
where not exists (select 1 from public.womens_leagues where lower(name)=lower('EuroCup Women 2026-27'));

update public.leagues set season='2026-27', basketball_type='mens', active=true
where lower(name) in ('bkt eurocup','fiba europe cup');

with seed(team,country,city,league_name) as (values
('Le Mans Sarthe Basket','France','Le Mans','BKT EuroCup'),
('Hapoel Midtown Jerusalem','Israel','Jerusalem','BKT EuroCup'),
('Recoletas Salud San Pablo Burgos','Spain','Burgos','BKT EuroCup'),
('Cedevita Olimpija Ljubljana','Slovenia','Ljubljana','BKT EuroCup'),
('Baglietto Derthona Tortona','Italy','Tortona','BKT EuroCup'),
('Aris Thessaloniki Betsson','Greece','Thessaloniki','BKT EuroCup'),
('Rostock Seawolves','Germany','Rostock','BKT EuroCup'),
('Riga Zelli','Latvia','Riga','BKT EuroCup'),
('Turk Telekom Ankara','Türkiye','Ankara','BKT EuroCup'),
('U-BT Cluj-Napoca','Romania','Cluj-Napoca','BKT EuroCup'),
('La Laguna Tenerife','Spain','San Cristóbal de La Laguna','BKT EuroCup'),
('Umana Reyer Venice','Italy','Venice','BKT EuroCup'),
('Maxima Roma','Italy','Rome','BKT EuroCup'),
('Siauliai Basketball','Lithuania','Šiauliai','BKT EuroCup'),
('London Lions','United Kingdom','London','BKT EuroCup'),
('Skyliners Frankfurt','Germany','Frankfurt','BKT EuroCup'),
('Cosea JL Bourg-en-Bresse','France','Bourg-en-Bresse','BKT EuroCup'),
('Tofas Bursa','Türkiye','Bursa','BKT EuroCup'),
('Buducnost VOLI Podgorica','Montenegro','Podgorica','BKT EuroCup'),
('Dolomiti Energia Trento','Italy','Trento','BKT EuroCup'),
('Napoli Basketball','Italy','Naples','BKT EuroCup'),
('Neptunas Klaipeda','Lithuania','Klaipėda','BKT EuroCup'),
('NINERS Chemnitz','Germany','Chemnitz','BKT EuroCup'),
('Slask Wroclaw','Poland','Wrocław','BKT EuroCup'),
('BOSNA BH Telecom Sarajevo','Bosnia & Herzegovina','Sarajevo','BKT EuroCup'),
('Bahcesehir College Istanbul','Türkiye','Istanbul','BKT EuroCup'),
('Kids&Us Manresa','Spain','Manresa','BKT EuroCup'),
('ratiopharm ulm','Germany','Ulm','BKT EuroCup'),
('Roma Basketball','Italy','Rome','BKT EuroCup'),
('Lietkabelis Panevezys','Lithuania','Panevėžys','BKT EuroCup'),
('PAOK Thessaloniki','Greece','Thessaloniki','BKT EuroCup'),
('Balkan Botevgrad','Bulgaria','Botevgrad','BKT EuroCup'),
('Trepca','Kosovo','Mitrovica','FIBA Europe Cup'),
('Promitheas Patras BC','Greece','Patras','FIBA Europe Cup'),
('BK Opava','Czechia','Opava','FIBA Europe Cup'),
('VET-CONCEPT Gladiators Trier','Germany','Trier','FIBA Europe Cup'),
('BC Split','Croatia','Split','FIBA Europe Cup'),
('BC Batumi 2010','Georgia','Batumi','FIBA Europe Cup'),
('Patrioti Levice','Slovakia','Levice','FIBA Europe Cup'),
('Coretec Oostende','Belgium','Ostend','FIBA Europe Cup'),
('NHSZ-Szolnoki Olajbanyasz','Hungary','Szolnok','FIBA Europe Cup'),
('FIATC Girona','Spain','Girona','FIBA Europe Cup'),
('Zastal Zielona Gora','Poland','Zielona Góra','FIBA Europe Cup'),
('Dinamo Bucharest','Romania','Bucharest','FIBA Europe Cup'),
('Sporting CP','Portugal','Lisbon','FIBA Europe Cup'),
('Rilski Sportist','Bulgaria','Samokov','FIBA Europe Cup'),
('Kolossos H Hotels','Greece','Rhodes','FIBA Europe Cup'),
('Esenler Erokspor','Türkiye','Istanbul','FIBA Europe Cup'),
('SCM Universitatea Craiova','Romania','Craiova','FIBA Europe Cup'),
('Gence BC','Azerbaijan','Ganja','FIBA Europe Cup'),
('Keravnos BC','Cyprus','Strovolos','FIBA Europe Cup'),
('BC Parnu','Estonia','Pärnu','FIBA Europe Cup'),
('King Szczecin','Poland','Szczecin','FIBA Europe Cup'),
('SLUC Nancy Basket','France','Nancy','FIBA Europe Cup'),
('Nitra Blue Wings','Slovakia','Nitra','FIBA Europe Cup'),
('BC Vienna','Austria','Vienna','FIBA Europe Cup'),
('Petrolina AEK Larnaca','Cyprus','Larnaca','FIBA Europe Cup'),
('Fitness First Wurzburg Baskets','Germany','Würzburg','FIBA Europe Cup'),
('Tartu Ulikool Maks & Moorits','Estonia','Tartu','FIBA Europe Cup'),
('Iraklis BC','Greece','Thessaloniki','FIBA Europe Cup'),
('Dziki Warszawa','Poland','Warsaw','FIBA Europe Cup'),
('MZT Skopje Aerodrom','North Macedonia','Skopje','FIBA Europe Cup'),
('Bigbank/Kalev','Estonia','Tallinn','FIBA Europe Cup'),
('Biotekno Korfez Basket','Türkiye','İzmir','FIBA Europe Cup'),
('BC Bashkimi','Kosovo','Prizren','FIBA Europe Cup'),
('Elan Chalon','France','Chalon-sur-Saône','FIBA Europe Cup'),
('Valmiera Glass VIA','Latvia','Valmiera','FIBA Europe Cup'),
('Manchester Basketball','United Kingdom','Manchester','FIBA Europe Cup'),
('Bakken Bears','Denmark','Aarhus','FIBA Europe Cup'),
('SL Benfica','Portugal','Lisbon','FIBA Europe Cup'),
('Landau Lions','Azerbaijan','Baku','FIBA Europe Cup'),
('Yukatel Denizli Basket','Türkiye','Denizli','FIBA Europe Cup'),
('Lions de Geneve','Switzerland','Geneva','FIBA Europe Cup'),
('BC Prievidza','Slovakia','Prievidza','FIBA Europe Cup'),
('CSM CSU Raiffeisen Oradea','Romania','Oradea','FIBA Europe Cup'),
('Fribourg Olympic Basket','Switzerland','Fribourg','FIBA Europe Cup'),
('VEF Riga','Latvia','Riga','FIBA Europe Cup'),
('Mykonos Betsson BC','Greece','Mykonos','FIBA Europe Cup'),
('Lokomotiv Plovdiv','Bulgaria','Plovdiv','FIBA Europe Cup'),
('Neftchi SC','Azerbaijan','Baku','FIBA Europe Cup')
), linked as (
 select s.*, l.id as league_id from seed s join public.leagues l on lower(l.name)=lower(s.league_name)
)
insert into public.teams(name,country,city,league_id,league_name,active,basketball_type,source,last_synced_at)
select s.team,s.country,s.city,s.league_id,s.league_name,true,'mens','official 2026-27 Europe Cup roster',now()
from linked s
where not exists (
 select 1 from public.teams t
 where lower(t.name)=lower(s.team) and lower(coalesce(t.country,''))=lower(coalesce(s.country,''))
);

with seed(team,country,city,league_name) as (values
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
), league as (
 select id from public.womens_leagues where lower(name)=lower('EuroCup Women 2026-27') limit 1
)
insert into public.womens_teams(name,country,city,league_id,active,league_name)
select s.team,s.country,s.city,league.id,true,s.league_name
from seed s cross join league
where not exists (
 select 1 from public.womens_teams t
 where lower(t.name)=lower(s.team) and lower(coalesce(t.country,''))=lower(coalesce(s.country,''))
);
