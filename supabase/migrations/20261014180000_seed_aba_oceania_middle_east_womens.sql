-- 2026-27 regional competition directory expansion.
-- Men's and women's clubs are intentionally stored in separate tables.
insert into public.leagues(name,country,level,season,basketball_type,active,source,last_synced_at)
select x.name,x.country,x.level,x.season,'mens',true,'official league/team listings',now()
from (values
 ('AdmiralBet ABA League','Europe','Regional first division','2026-27'),
 ('ABA League 2','Europe','Regional second division','2026-27'),
 ('FIBA West Asia Super League (WASL)','Middle East / Asia','Regional club competition','2026'),
 ('Australian NBL','Australia','National first division','2026-27'),
 ('New Zealand NBL','New Zealand','National first division','2026'),
 ('EuroLeague Women','Europe','European first division','2026-27')
) as x(name,country,level,season)
where not exists(select 1 from public.leagues l where lower(l.name)=lower(x.name));

update public.leagues set season='2026-27',basketball_type='mens',active=true
where lower(name) in ('admiralbet aba league','aba league 2','australian nbl','new zealand nbl');

with seed(team,country,city,league_name) as (values
-- AdmiralBet ABA League 2026-27: 20 clubs
('Borac Mozzart','Serbia','Čačak','AdmiralBet ABA League'),
('Budućnost VOLI','Montenegro','Podgorica','AdmiralBet ABA League'),
('Cedevita Olimpija','Slovenia','Ljubljana','AdmiralBet ABA League'),
('Cibona','Croatia','Zagreb','AdmiralBet ABA League'),
('Crvena zvezda Meridianbet','Serbia','Belgrade','AdmiralBet ABA League'),
('FMP','Serbia','Belgrade','AdmiralBet ABA League'),
('Igokea m:tel','Bosnia and Herzegovina','Laktaši','AdmiralBet ABA League'),
('Krka','Slovenia','Novo Mesto','AdmiralBet ABA League'),
('Široki TT Kabeli','Bosnia and Herzegovina','Široki Brijeg','AdmiralBet ABA League'),
('Slovan Bratislava','Slovakia','Bratislava','AdmiralBet ABA League'),
('Bosna BH Telecom','Bosnia and Herzegovina','Sarajevo','AdmiralBet ABA League'),
('Dubai Basketball','United Arab Emirates','Dubai','AdmiralBet ABA League'),
('Mega Superbet','Serbia','Belgrade','AdmiralBet ABA League'),
('Partizan Mozzart Bet','Serbia','Belgrade','AdmiralBet ABA League'),
('Perspektiva Ilirija','Slovenia','Ljubljana','AdmiralBet ABA League'),
('SC Derby','Montenegro','Podgorica','AdmiralBet ABA League'),
('Spartak Office Shoes','Serbia','Subotica','AdmiralBet ABA League'),
('U-BT Cluj-Napoca','Romania','Cluj-Napoca','AdmiralBet ABA League'),
('BC Vienna','Austria','Vienna','AdmiralBet ABA League'),
('Zadar','Croatia','Zadar','AdmiralBet ABA League'),
-- ABA League 2 2026-27: 16 clubs
('Borac WWIN','Bosnia and Herzegovina','Banja Luka','ABA League 2'),
('GGD Šenčur','Slovenia','Šenčur','ABA League 2'),
('Mornar-Barsko zlato','Montenegro','Bar','ABA League 2'),
('Vojvodina mts','Serbia','Novi Sad','ABA League 2'),
('Hercegovac Aling-Conel','Serbia','Gajdobra','ABA League 2'),
('Podgorica Bemax','Montenegro','Podgorica','ABA League 2'),
('Sloboda Energoinvest','Bosnia and Herzegovina','Tuzla','ABA League 2'),
('TFT Skopje','North Macedonia','Skopje','ABA League 2'),
('ECE Triglav Kranj','Slovenia','Kranj','ABA League 2'),
('MZT Skopje Aerodrom','North Macedonia','Skopje','ABA League 2'),
('Sloboda Užice','Serbia','Užice','ABA League 2'),
('Sutjeska Elektroprivreda Nikšić','Montenegro','Nikšić','ABA League 2'),
('Zlatibor Mozzart','Serbia','Čajetina','ABA League 2'),
('Basket Živinice','Bosnia and Herzegovina','Živinice','ABA League 2'),
('Primorje 1945','Montenegro','Herceg Novi','ABA League 2'),
('Virtus Zagreb','Croatia','Zagreb','ABA League 2'),
-- WASL Final 8 / regional field, current official 2026 listing
('Al Riyadi','Lebanon','Beirut','FIBA West Asia Super League (WASL)'),
('Sagesse SC','Lebanon','Beirut','FIBA West Asia Super League (WASL)'),
('BC Astana','Kazakhstan','Astana','FIBA West Asia Super League (WASL)'),
('Shahrdari Gorgan','Iran','Gorgan','FIBA West Asia Super League (WASL)'),
('Kuwait SC','Kuwait','Kuwait City','FIBA West Asia Super League (WASL)'),
('Al Ula Club','Saudi Arabia','Al Ula','FIBA West Asia Super League (WASL)'),
('Ittihad Club','Saudi Arabia','Jeddah','FIBA West Asia Super League (WASL)'),
('Al Arabi SC','Qatar','Doha','FIBA West Asia Super League (WASL)'),
('Indian Railways','India','New Delhi','FIBA West Asia Super League (WASL)'),
-- Australian NBL 2026-27
('Adelaide 36ers','Australia','Adelaide','Australian NBL'),
('BNZ Breakers','New Zealand','Auckland','Australian NBL'),
('Brisbane Bullets','Australia','Brisbane','Australian NBL'),
('Cairns Taipans','Australia','Cairns','Australian NBL'),
('Illawarra Hawks','Australia','Wollongong','Australian NBL'),
('Melbourne United','Australia','Melbourne','Australian NBL'),
('Perth Wildcats','Australia','Perth','Australian NBL'),
('South East Melbourne Phoenix','Australia','Melbourne','Australian NBL'),
('Sydney Kings','Australia','Sydney','Australian NBL'),
('Tasmania JackJumpers','Australia','Hobart','Australian NBL'),
-- New Zealand NBL 2026
('Auckland Tuatara','New Zealand','Auckland','New Zealand NBL'),
('Canterbury Rams','New Zealand','Christchurch','New Zealand NBL'),
('Franklin Bulls','New Zealand','Pukekohe','New Zealand NBL'),
('Hawke’s Bay Hawks','New Zealand','Napier','New Zealand NBL'),
('Manawatu Jets','New Zealand','Palmerston North','New Zealand NBL'),
('Nelson Giants','New Zealand','Nelson','New Zealand NBL'),
('Otago Nuggets','New Zealand','Dunedin','New Zealand NBL'),
('Southland Sharks','New Zealand','Invercargill','New Zealand NBL'),
('Taranaki Airs','New Zealand','New Plymouth','New Zealand NBL'),
('Wellington Saints','New Zealand','Wellington','New Zealand NBL')
), linked as (
 select s.*,l.id league_id from seed s join public.leagues l on lower(l.name)=lower(s.league_name)
), inserted as (
 insert into public.teams(name,country,city,league_id,league_name,active,basketball_type,source,last_synced_at)
 select s.team,s.country,s.city,s.league_id,s.league_name,true,'mens','official 2026 regional league rosters',now()
 from linked s
 where not exists(select 1 from public.teams t where lower(t.name)=lower(s.team) and lower(coalesce(t.country,''))=lower(s.country))
 returning id
)
select count(*) from inserted;

with seed(team,country,city,league_name) as (values
-- EuroLeague Women: confirmed 16-team First Round field for 2026-27
('Casademont Zaragoza','Spain','Zaragoza','EuroLeague Women 2026-27'),
('Basket Landes','France','Mont-de-Marsan','EuroLeague Women 2026-27'),
('Athinaikos Qualco','Greece','Vironas','EuroLeague Women 2026-27'),
('Kibirkstis-TOKS','Lithuania','Vilnius','EuroLeague Women 2026-27'),
('Galatasaray Cagdas Faktoring','Türkiye','Istanbul','EuroLeague Women 2026-27'),
('Beretta Famila Schio','Italy','Schio','EuroLeague Women 2026-27'),
('Kangoeroes Basket Mechelen','Belgium','Mechelen','EuroLeague Women 2026-27'),
('KKZ Crvena Zvezda','Serbia','Belgrade','EuroLeague Women 2026-27'),
('Fenerbahce Tarfin','Türkiye','Istanbul','EuroLeague Women 2026-27'),
('Valencia Basket Club','Spain','Valencia','EuroLeague Women 2026-27'),
('CS Rapid Bucuresti','Romania','Bucharest','EuroLeague Women 2026-27'),
('Flammes Carolo Basket','France','Charleville-Mézières','EuroLeague Women 2026-27'),
('ZVVZ USK Praha','Czechia','Prague','EuroLeague Women 2026-27'),
('Tango Bourges Basket','France','Bourges','EuroLeague Women 2026-27'),
('AZS UMCS Lublin','Poland','Lublin','EuroLeague Women 2026-27'),
('Emlak Konut','Türkiye','Istanbul','EuroLeague Women 2026-27'),
-- WABA League women 2026-27: 11 official clubs
('Montana 2003','Bulgaria','Montana','WABA League 2026-27'),
('Cinkarna Celje','Slovenia','Celje','WABA League 2026-27'),
('Budućnost Bemax','Montenegro','Podgorica','WABA League 2026-27'),
('Partizan 1953','Serbia','Belgrade','WABA League 2026-27'),
('Rilski Sportist','Bulgaria','Samokov','WABA League 2026-27'),
('Studio Zagreb','Croatia','Zagreb','WABA League 2026-27'),
('Beroe','Bulgaria','Stara Zagora','WABA League 2026-27'),
('Trešnjevka 2009','Croatia','Zagreb','WABA League 2026-27'),
('Šibenik','Croatia','Šibenik','WABA League 2026-27'),
('Brod na Savi','Croatia','Slavonski Brod','WABA League 2026-27'),
('Partizani','Albania','Tirana','WABA League 2026-27'),
-- Australian WNBL clubs
('Adelaide Lightning','Australia','Adelaide','WNBL Australia'),
('Bendigo Spirit','Australia','Bendigo','WNBL Australia'),
('Geelong United','Australia','Geelong','WNBL Australia'),
('Perth Lynx','Australia','Perth','WNBL Australia'),
('Southside Flyers','Australia','Melbourne','WNBL Australia'),
('Sydney Flames','Australia','Sydney','WNBL Australia'),
('Townsville Fire','Australia','Townsville','WNBL Australia'),
('UC Capitals','Australia','Canberra','WNBL Australia'),
-- Tauihi Basketball Aotearoa women's league
('Mainland Pouākai','New Zealand','Christchurch','Tauihi Basketball Aotearoa'),
('Northern Kāhu','New Zealand','Auckland','Tauihi Basketball Aotearoa'),
('Southern Hoiho','New Zealand','Dunedin','Tauihi Basketball Aotearoa'),
('Tokomanawa Queens','New Zealand','Wellington','Tauihi Basketball Aotearoa'),
('Whai','New Zealand','Tauranga','Tauihi Basketball Aotearoa')
)
insert into public.womens_teams(name,country,city,league_name,active)
select s.team,s.country,s.city,s.league_name,true from seed s
where not exists(select 1 from public.womens_teams t where lower(t.name)=lower(s.team) and lower(coalesce(t.country,''))=lower(s.country));

-- Preserve existing women's team records; tag known teams with current regional competition labels.
update public.womens_teams t
set league_name = case
 when coalesce(t.league_name,'')='' then 'EuroLeague Women 2026-27'
 when position('EuroLeague Women 2026-27' in t.league_name)>0 then t.league_name
 else t.league_name || ' · EuroLeague Women 2026-27'
end
where exists(select 1 from (values
('Casademont Zaragoza','Spain'),('Basket Landes','France'),('Athinaikos Qualco','Greece'),('Kibirkstis-TOKS','Lithuania'),
('Galatasaray Cagdas Faktoring','Türkiye'),('Beretta Famila Schio','Italy'),('Kangoeroes Basket Mechelen','Belgium'),
('KKZ Crvena Zvezda','Serbia'),('Fenerbahce Tarfin','Türkiye'),('Valencia Basket Club','Spain'),('CS Rapid Bucuresti','Romania'),
('Flammes Carolo Basket','France'),('ZVVZ USK Praha','Czechia'),('Tango Bourges Basket','France'),('AZS UMCS Lublin','Poland'),('Emlak Konut','Türkiye')
) x(name,country) where lower(x.name)=lower(t.name) and lower(x.country)=lower(t.country));

insert into public.womens_leagues(name,country,level,active)
select x.name,x.country,x.level,true from (values
('EuroLeague Women 2026-27','Europe','European first division'),
('WABA League 2026-27','Europe','Regional women’s first division'),
('WNBL Australia','Australia','National women’s first division'),
('Tauihi Basketball Aotearoa','New Zealand','National women’s first division')
) x(name,country,level)
where not exists(select 1 from public.womens_leagues l where lower(l.name)=lower(x.name));
