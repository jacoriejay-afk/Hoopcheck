-- Public directory-only regression fixture, captured 2026-11-28.
-- No account data, credentials, provider payloads or private records.
-- Execute with psql on disposable hoopcheck_league_data_test only.
\set ON_ERROR_STOP on
begin;
do $guard$ begin
 if current_database()<>'hoopcheck_league_data_test' then raise exception 'Only the disposable league-data test database is permitted';end if;
end $guard$;
set local standard_conforming_strings=on;
create temporary table ld1_leagues(id uuid primary key,name text not null,country text,season text,basketball_type text not null check(basketball_type in ('mens','womens')),active boolean not null) on commit drop;
create temporary table ld1_teams(id uuid primary key,name text not null,country text,league_id uuid references ld1_leagues(id),league_name text,basketball_type text not null check(basketball_type in ('mens','womens')),active boolean not null) on commit drop;
create temporary table ld1_memberships(id uuid primary key,team_id uuid references ld1_teams(id),league_id uuid references ld1_leagues(id),season text,start_date date,end_date date,active boolean,unique(team_id,league_id,season)) on commit drop;
create temporary table ld1_legacy_leagues(id uuid primary key,name text not null,country text,active boolean not null) on commit drop;
create temporary table ld1_legacy_teams(id uuid primary key,name text not null,country text,league_id uuid references ld1_legacy_leagues(id),league_name text,active boolean not null) on commit drop;
insert into pg_temp.ld1_leagues(id,name,country,season,basketball_type,active) values
('1e92579b-b1ab-473c-bc0f-89f2b03217e5','Kazakhstan National League','Kazakhstan','2026','mens',true),
('3180d90e-6d8a-4b3c-8c79-2d6a6e8c98d4','Armenian Basketball League A','Armenia','2026-27','mens',true),
('3750982c-c4ba-4fda-9e10-73aabab5cc7c','EuroCup Women','International','2026-27','womens',true),
('5114c521-cf4b-4ed4-a0f1-b9f0a8275597','Úrvalsdeild karla','Iceland',null,'mens',true),
('5845f8d5-2e2d-4dad-acbf-442d4b4b23a1','Besta deild karla','Iceland','2026-27','mens',true),
('760c8720-284d-45be-8354-3455e4aa1c69','Liga Betclic','Portugal','2026-27','mens',true),
('8d6bf95b-7d57-44d4-a8ae-eb6541130c0c','FIBA Europe Cup','Europe','2026-27','mens',true),
('bec85eb7-a0c3-4147-9ab8-3a7e870d0d01','Azerbaijan Basketball League','Azerbaijan','2026-27','mens',true),
('def7c31c-552a-4786-a2e9-66a2d1055b7f','EuroLeague','Europe','2026-27','mens',true),
('e4313973-698f-4bc5-b8ff-9a6bb0c8e407','Premier League','Kosovo',null,'mens',true),
('f67f0c64-72db-4356-9ad4-f753e01e7bc8','European North Basketball League (ENBL)','Europe','2026-27','mens',true),
('fc462d0b-c04b-4e16-be0b-6dd670a02481','Kosovo Superleague','Kosovo','2026-27','mens',true);
insert into pg_temp.ld1_teams(id,name,country,league_id,league_name,basketball_type,active) values
('028b6fa4-ffc6-4900-bf4b-831065edccf8','Vitória SC','Portugal',null,'Liga Betclic','mens',true),
('052a8ee3-4c02-4932-bfc8-174bfb8578ae','Nakhchivan BK','Azerbaijan','bec85eb7-a0c3-4147-9ab8-3a7e870d0d01','Azerbaijan Basketball League','mens',true),
('09033a6e-75f4-418a-98e4-03ac7bf49499','CAB Madeira','Portugal',null,'Proliga','mens',true),
('0b28f946-6e9a-4fe7-848b-4c3cfe6b9feb','Tindastóll','Iceland',null,'Úrvalsdeild karla','mens',true),
('0bd859f2-f3c3-4bb4-8d5e-1a322bd920e9','Crvena Zvezda Meridianbet Belgrade','Serbia','def7c31c-552a-4786-a2e9-66a2d1055b7f','EuroLeague','mens',true),
('12190897-ab82-4787-8756-0152ca24f042','Grindavík','Iceland',null,'Úrvalsdeild karla','mens',true),
('13b8900f-3c74-4b68-8bf3-0417873f6362','Illiabum Clube','Portugal',null,'Proliga','mens',true),
('13d42da3-e488-4c8a-9435-78fd743ec2c2','Sheki BK','Azerbaijan','bec85eb7-a0c3-4147-9ab8-3a7e870d0d01','Azerbaijan Basketball League','mens',true),
('1642b253-ce81-4133-a839-7c5419088074','KB Trepça','Kosovo',null,'Kosovo Basketball Superleague','mens',true),
('16ec24d3-bf74-4bc2-9a2d-b15c5e4e27e8','Sabah BK','Azerbaijan','bec85eb7-a0c3-4147-9ab8-3a7e870d0d01','Azerbaijan Basketball League','mens',true),
('18c95a04-0641-45c9-92f5-4736ba6612db','KB Sigal Prishtina','Kosovo','fc462d0b-c04b-4e16-be0b-6dd670a02481','Kosovo Superleague','mens',true),
('19efd30d-1f0c-459b-b737-aa3d43a50e1e','Trepça','Kosovo','e4313973-698f-4bc5-b8ff-9a6bb0c8e407','Premier League','mens',true),
('1b9f224e-4cd7-4823-a1ec-4304a5db7223','BC YANGS','Armenia','3180d90e-6d8a-4b3c-8c79-2d6a6e8c98d4','Armenian Basketball League A','mens',true),
('1c7cccd2-2c49-46fa-a7ac-79f2080ec6a7','Sindri','Iceland','5114c521-cf4b-4ed4-a0f1-b9f0a8275597',null,'mens',true),
('1d524a27-e297-4e48-a307-ebb5cf1ad434','Benfica Basketball','Portugal','760c8720-284d-45be-8354-3455e4aa1c69','Liga Betclic','mens',false),
('273de72c-95ba-4c0b-ac0c-2580f17b0efb','SL Benfica','Portugal','760c8720-284d-45be-8354-3455e4aa1c69','Liga Betclic','mens',true),
('289b8a07-7d75-4d9d-81ad-4d511a3407c7','SC Vasco da Gama','Portugal',null,'Liga Betclic','mens',true),
('28c97314-f2d9-45c0-b206-d69a16a0fd9b','Tindastoll','Iceland','f67f0c64-72db-4356-9ad4-f753e01e7bc8','European North Basketball League (ENBL)','mens',true),
('2b042c5d-370b-4183-91d1-cb8eb2fcf379','Tindastóll','Iceland','5114c521-cf4b-4ed4-a0f1-b9f0a8275597',null,'mens',true),
('2bfdb734-5189-4ec8-a36f-fc34d012f8a3','Ovarense GAVEX','Portugal','760c8720-284d-45be-8354-3455e4aa1c69','Liga Betclic','mens',true),
('30fae9b9-e685-411e-9ebb-4894b8cf9c1f','KB Peja','Kosovo','fc462d0b-c04b-4e16-be0b-6dd670a02481','Kosovo Superleague','mens',true),
('3160698a-4c2d-4192-9408-2be0d94ba869','Partizan Mozzart Bet Belgrade','Serbia','def7c31c-552a-4786-a2e9-66a2d1055b7f','EuroLeague','mens',true),
('32985fdd-2cde-4fd9-b228-fd5215b480ac','BC TBILISI BTB','Georgia','3180d90e-6d8a-4b3c-8c79-2d6a6e8c98d4','Armenian Basketball League A','mens',true),
('338efab4-c7d3-440c-964a-3d829a08a97a','UD Oliveirense','Portugal','760c8720-284d-45be-8354-3455e4aa1c69','Liga Betclic','mens',true),
('33af8928-cd7e-4748-81fe-6735cd32b2ec','KB Trepça','Kosovo','fc462d0b-c04b-4e16-be0b-6dd670a02481','Kosovo Superleague','mens',true),
('34601a8d-2411-4681-8440-063b804f920e','FC Porto','Portugal',null,'Liga Betclic','mens',true),
('34c07473-784a-436c-8376-ac327a523aa6','Stjarnan','Iceland','5114c521-cf4b-4ed4-a0f1-b9f0a8275597','Úrvalsdeild karla','mens',true),
('381b4209-979e-43ff-aa25-364b22ffbc50','Álftanes','Iceland','5114c521-cf4b-4ed4-a0f1-b9f0a8275597',null,'mens',true),
('3b2695bd-7f5f-4bae-a9a5-711cf0447015','Ármann','Iceland','5114c521-cf4b-4ed4-a0f1-b9f0a8275597',null,'mens',true),
('3cb30a4c-3b54-4db2-84d7-0fff3a20a9a1','Sumqayit BK','Azerbaijan','bec85eb7-a0c3-4147-9ab8-3a7e870d0d01','Azerbaijan Basketball League','mens',true),
('3da1a735-77e1-481f-9226-716185d10f5c','Sporting CP','Portugal','8d6bf95b-7d57-44d4-a8ae-eb6541130c0c','FIBA Europe Cup','mens',true),
('414406ff-5c44-4d31-83ac-a4aad40ad302','UD Oliveirense','Portugal',null,'Liga Betclic','mens',true),
('419f7445-3ac9-45b8-ba3f-25f971c001f0','Vëllaznimi','Kosovo',null,'Kosovo Basketball Superleague','mens',true),
('46dec1dd-1158-4d51-a38c-8e3c506481e2','Queluz | O Nosso Prego','Portugal','760c8720-284d-45be-8354-3455e4aa1c69','Liga Betclic','mens',true),
('5080a2d6-f622-4931-a445-34f692100b09','Njarðvík','Iceland','5114c521-cf4b-4ed4-a0f1-b9f0a8275597',null,'mens',true),
('537b0b7b-ba79-4403-9b9f-fb63ba506689','BC Trepça','Kosovo','8d6bf95b-7d57-44d4-a8ae-eb6541130c0c','FIBA Europe Cup','mens',true),
('54dfd379-2c83-465c-b7ea-fa43ada2dd84','Haukar','Iceland','5845f8d5-2e2d-4dad-acbf-442d4b4b23a1','Besta deild karla','mens',true),
('57602bbf-9e34-4bca-8b57-011f0b0e395e','SL Benfica','Portugal','8d6bf95b-7d57-44d4-a8ae-eb6541130c0c','FIBA Europe Cup','mens',true),
('5840ee52-9f18-4eb9-9aa9-5100f1efa780','Beşiktaş Istanbul','Türkiye','def7c31c-552a-4786-a2e9-66a2d1055b7f','EuroLeague','mens',true),
('585f8592-c654-4cda-9c21-6744206f3a3a','Portimonense SC','Portugal','760c8720-284d-45be-8354-3455e4aa1c69','Liga Betclic','mens',true),
('5da14bb6-6c62-495c-a244-025ca72e4334','FC Barcelona','Spain',null,'EuroLeague','mens',true),
('5da1b19f-74e2-4883-adcc-d14118d76285','Keflavík','Iceland','5114c521-cf4b-4ed4-a0f1-b9f0a8275597','Úrvalsdeild karla','mens',true),
('60b1d9f4-542f-4f67-816c-a08e04abbc79','Dubai Basketball','United Arab Emirates','def7c31c-552a-4786-a2e9-66a2d1055b7f','EuroLeague · AdmiralBet ABA League','mens',true),
('615088e0-10db-4cd8-9ec2-d9ca9b871eba','Fenerbahçe Tarfin Istanbul','Türkiye',null,'EuroLeague','mens',true),
('61ee3c85-4edd-42b1-bc49-b6665d3aa0e6','Real Madrid','Spain',null,'EuroLeague','mens',true),
('61fb17ac-cee4-4b15-bd18-388b344d9c63','BC PHOENIX PERCEPTION','United States','3180d90e-6d8a-4b3c-8c79-2d6a6e8c98d4','Armenian Basketball League A','mens',true),
('66dbc973-a84a-4e61-b355-6944ba579383','Þór Þorlákshöfn','Iceland',null,'Úrvalsdeild karla','mens',true),
('6730c0d1-0416-4756-b731-93cf8c778fb2','KB Ylli','Kosovo','fc462d0b-c04b-4e16-be0b-6dd670a02481','Kosovo Superleague','mens',true),
('6773b937-41b3-406e-b2e1-ab48cb1d8bc7','NTD BK','Azerbaijan','bec85eb7-a0c3-4147-9ab8-3a7e870d0d01','Azerbaijan Basketball League','mens',true),
('67a4775d-62f7-4e75-8879-7ced1e522453','Esgueira Aveiro OLI','Portugal',null,'Liga Betclic','mens',true),
('6978f3db-8091-48f8-89fb-e6a025a51c4d','BC HAT','Armenia','3180d90e-6d8a-4b3c-8c79-2d6a6e8c98d4','Armenian Basketball League A','mens',true),
('6bb5c760-93c9-4d41-9272-fbe5d62fa2e2','Esgueira Aveiro OLI','Portugal','760c8720-284d-45be-8354-3455e4aa1c69','Liga Betclic','mens',true),
('6cfe3f49-55d6-4875-a727-a4544a76e395','Peja','Kosovo',null,'Kosovo Basketball Superleague','mens',true),
('6da31ec9-a6d1-427f-b5de-dce092b65dcf','KB Rahoveci','Kosovo','fc462d0b-c04b-4e16-be0b-6dd670a02481','Kosovo Superleague','mens',true),
('6dc1cf7d-3998-4b8c-a0f3-528987d37f46','SL Benfica','Portugal','3750982c-c4ba-4fda-9e10-73aabab5cc7c','EuroCup Women','womens',true),
('70df0c30-3e37-4ec3-832b-4a6adc48ee7b','Hapoel IBI Tel Aviv','Israel','def7c31c-552a-4786-a2e9-66a2d1055b7f','EuroLeague','mens',true),
('71fa7dc8-9044-482c-979a-8935ddf8039a','Ordu IK','Azerbaijan','bec85eb7-a0c3-4147-9ab8-3a7e870d0d01','Azerbaijan Basketball League','mens',true),
('722c5210-ef37-45cb-9c05-0247db123132','Golden Eagle Ylli','Kosovo',null,'Kosovo Basketball Superleague','mens',true),
('742d2946-6606-44e7-82f8-225ca083e7bf','SC Braga','Portugal','760c8720-284d-45be-8354-3455e4aa1c69','Liga Betclic','mens',true),
('776b06f5-d661-4989-bdef-0ef3089db756','Benfica Women','Portugal',null,'Portugal Women’s Basketball League','womens',true),
('7a7e6d9f-c282-41ea-903b-51d267d37f78','BC NOMAD','Kyrgyzstan','3180d90e-6d8a-4b3c-8c79-2d6a6e8c98d4','Armenian Basketball League A','mens',true),
('7b69017a-0706-4ee4-96b9-ffaff69ccc4b','Sigal Prishtina','Kosovo',null,'Kosovo Basketball Superleague','mens',true),
('81578f84-3ac6-4c73-9a65-271dd3604782','FC Porto','Portugal','760c8720-284d-45be-8354-3455e4aa1c69','Liga Betclic','mens',true),
('872b6ade-33d6-4042-90c3-43b98646bc11','Paris Basketball','France','def7c31c-552a-4786-a2e9-66a2d1055b7f','EuroLeague','mens',true),
('8add03bb-1c13-47e8-9b63-ba42d7d23217','LDLC ASVEL Villeurbanne','France','def7c31c-552a-4786-a2e9-66a2d1055b7f','EuroLeague','mens',true),
('8ec0e9b9-e969-4dbf-b754-aadb9b977279','Neftchi SC','Azerbaijan','8d6bf95b-7d57-44d4-a8ae-eb6541130c0c','FIBA Europe Cup','mens',true),
('91fd819b-4e27-4115-8a5d-cae220b29364','União Sportiva Women','Portugal',null,'Portugal Women’s Basketball League','womens',true),
('9385207b-e793-4a9e-a30d-5ff3f78e4de2','Trepca','Kosovo',null,'FIBA Europe Cup','mens',false),
('976e4b88-8891-474a-84a5-5f12527918da','FC Bayern Munich','Germany','def7c31c-552a-4786-a2e9-66a2d1055b7f','EuroLeague','mens',true),
('97947932-202f-4b63-826b-5ee6b19e4aa0','Zalgiris Kaunas','Lithuania','def7c31c-552a-4786-a2e9-66a2d1055b7f','EuroLeague','mens',true),
('9b049a09-7138-44dc-8609-58be7e4299a8','Virtus Bologna','Italy','def7c31c-552a-4786-a2e9-66a2d1055b7f','EuroLeague','mens',true),
('9d072d6c-6706-4125-84eb-5d5f5830652e','Vitória SC','Portugal','760c8720-284d-45be-8354-3455e4aa1c69','Liga Betclic','mens',true),
('9e64dea2-9ce1-4557-bc89-badf9bbccf98','BK Erebuni','Armenia','3180d90e-6d8a-4b3c-8c79-2d6a6e8c98d4','Armenian Basketball League A','mens',true),
('a1403bea-5d4f-481a-a791-07c42e3dc053','ÍR','Iceland','5114c521-cf4b-4ed4-a0f1-b9f0a8275597',null,'mens',true),
('a5b8e2b2-bec1-47b7-b433-8874d8f6616a','ÍR Reykjavík','Iceland',null,'Úrvalsdeild karla','mens',true),
('a5d8c854-12b5-4b03-a2e2-e2d9752e2ea7','Anadolu Efes Istanbul','Türkiye',null,'EuroLeague','mens',true),
('a8785ea3-bcf1-4d7d-850f-fb73cd34672f','Gence BC','Azerbaijan','bec85eb7-a0c3-4147-9ab8-3a7e870d0d01','Azerbaijan Basketball League · FIBA Europe Cup','mens',true),
('ac2510a6-8940-458a-ad64-43befa154436','Ovarense','Portugal',null,'Liga Betclic','mens',true),
('ae2447a4-5101-499e-85c4-f98208747273','Neftchi SC','Azerbaijan',null,'FIBA Europe Cup','mens',false),
('aee0f9a2-210d-4d1a-acd0-3b9d1c2d406e','SC Braga','Portugal',null,'Liga Betclic','mens',true),
('b17c59fb-b5a1-4646-bbcf-c1587346fe67','Barsy Atyrau','Kazakhstan','1e92579b-b1ab-473c-bc0f-89f2b03217e5','Kazakhstan National League','mens',true),
('b1e87196-7bfa-4f84-83a2-6cc49e508c0c','FC Porto Basketball','Portugal','760c8720-284d-45be-8354-3455e4aa1c69','Liga Betclic','mens',false),
('b1eaa5a7-819a-4436-b2d0-cd4d862ea069','Sporting CP','Portugal',null,'FIBA Europe Cup','mens',false),
('b2f4321a-40f1-4ee9-a0f1-43474ea2c033','BC Bashkimi','Kosovo','fc462d0b-c04b-4e16-be0b-6dd670a02481','Kosovo Superleague · FIBA Europe Cup','mens',true),
('b3d665dd-c069-4897-8828-42f7af9245c1','Bashkimi Prizren','Kosovo',null,'Kosovo Basketball Superleague','mens',true),
('b63b8648-2923-4097-9751-9e7216130953','Kosner Baskonia Vitoria-Gasteiz','Spain','def7c31c-552a-4786-a2e9-66a2d1055b7f','EuroLeague','mens',true),
('ba689ee5-402e-450d-9768-edc086e31293','Benfica','Portugal',null,'Liga Betclic','mens',true),
('bdebd0e7-f904-4b07-a846-2a800e8f5773','KB Peja','Kosovo',null,'Kosovo Superleague / FIBA Europe Cup Qualifiers','mens',true),
('bf2c8066-c29c-4ef9-bb3a-246ca378ee93','Valur','Iceland','5114c521-cf4b-4ed4-a0f1-b9f0a8275597',null,'mens',true),
('c0d54bbf-c43e-482f-a6dc-7bfa1536cd85','Panathinaikos AKTOR Athens','Greece','def7c31c-552a-4786-a2e9-66a2d1055b7f','EuroLeague','mens',true),
('c40fc36c-6327-4d51-bf32-cada5e4f5dca','Sporting CP Women','Portugal',null,'Portugal Women’s Basketball League','womens',true),
('c44e640a-0a9b-45f3-af90-ea45a2a58a43','BC Bashkimi','Kosovo','8d6bf95b-7d57-44d4-a8ae-eb6541130c0c','FIBA Europe Cup','mens',true),
('c4d199fb-a678-4a4d-a7c2-cd51dfd5586d','Imortal Basket','Portugal',null,'Liga Betclic','mens',true),
('c6a485f3-903e-41e1-b7d2-c1ff53417b62','Valur','Iceland','5845f8d5-2e2d-4dad-acbf-442d4b4b23a1','Besta deild karla','mens',true),
('c8a110b7-b492-411a-ba94-54cd74188a2c','BC CROSSNATION','United States','3180d90e-6d8a-4b3c-8c79-2d6a6e8c98d4','Armenian Basketball League A','mens',true),
('cacd78e0-4612-43b8-8fb4-f5d54137c9b7','SL Benfica','Portugal',null,'FIBA Europe Cup','mens',false),
('cad10ce7-f0e1-4b49-b2e6-15e9883326a2','Valencia Basket','Spain','def7c31c-552a-4786-a2e9-66a2d1055b7f','EuroLeague','mens',true),
('cc0676c1-fbd7-4a5c-980e-10643794017f','Trepca','Kosovo','8d6bf95b-7d57-44d4-a8ae-eb6541130c0c','FIBA Europe Cup','mens',true),
('ce355c53-de84-46d2-a0e7-6d3f6857ed80','Álftanes','Iceland',null,'Úrvalsdeild karla','mens',true),
('cff56b3a-a50d-4064-bddd-5d168851e09c','Armani Olimpia Milano','Italy','def7c31c-552a-4786-a2e9-66a2d1055b7f','EuroLeague','mens',true),
('d104e37b-2e79-4395-8c71-d20632207e0a','Sporting CP','Portugal','760c8720-284d-45be-8354-3455e4aa1c69','Liga Betclic','mens',true),
('d206882d-c7fa-4d66-ae5c-1e8e12e8eeed','Galitos Barreiro','Portugal',null,'Liga Betclic','mens',true),
('d2e3e86c-0a4b-4780-b8b9-c6cbb20fc16b','Grindavík','Iceland','5114c521-cf4b-4ed4-a0f1-b9f0a8275597',null,'mens',true),
('d8bddf31-8b34-45d8-b6ad-8131bd46b3f4','KR Reykjavík','Iceland',null,'Úrvalsdeild karla','mens',true),
('daef522e-5e16-400e-ace4-97725aecefb8','SL Benfica','Portugal',null,'EuroCup Women 2026-27','womens',true),
('df493661-c77b-4eb3-9586-d2adf32e22e6','Landau Lions','Azerbaijan','bec85eb7-a0c3-4147-9ab8-3a7e870d0d01','Azerbaijan Basketball League · FIBA Europe Cup','mens',true),
('e047864d-f5d3-49b1-a295-055ee48621cf','Maccabi Rapyd Tel Aviv','Israel','def7c31c-552a-4786-a2e9-66a2d1055b7f','EuroLeague','mens',true),
('e2e37ee2-8880-4ee1-bd41-fb671ad4c285','KB Borea','Kosovo','fc462d0b-c04b-4e16-be0b-6dd670a02481','Kosovo Superleague','mens',true),
('e9bdaa56-1bc9-4424-bbf0-3accc7e6f24e','CD Póvoa ESC Online','Portugal','760c8720-284d-45be-8354-3455e4aa1c69','Liga Betclic','mens',true),
('ec10f425-223b-426f-b16a-61147fa715fc','BC HATIS','Armenia','3180d90e-6d8a-4b3c-8c79-2d6a6e8c98d4','Armenian Basketball League A','mens',true),
('ec170351-9301-4e30-a24c-71dfa59ae5f8','BC BARSY ATYRAU','Kazakhstan','3180d90e-6d8a-4b3c-8c79-2d6a6e8c98d4','Armenian Basketball League A','mens',true),
('edb90cf2-5ed6-4f2c-b3bf-a6f1a656c61e','Urartu BC','Armenia','3180d90e-6d8a-4b3c-8c79-2d6a6e8c98d4','Armenian Basketball League A','mens',true),
('ee4e3d33-135f-4653-9bce-366ae621fd4d','Olympiacos Piraeus','Greece','def7c31c-552a-4786-a2e9-66a2d1055b7f','EuroLeague','mens',true),
('ee785f83-e643-4aff-a94f-f756ccfbc9a9','KR','Iceland','5114c521-cf4b-4ed4-a0f1-b9f0a8275597',null,'mens',true),
('ef1024d2-8a32-48a8-ac36-753ae7bf4ae1','CAB Madeira','Portugal','760c8720-284d-45be-8354-3455e4aa1c69','Liga Betclic','mens',true),
('f04d2fc3-f93d-45ce-9383-9c92ee45e67e','Rahoveci','Kosovo',null,'Kosovo Basketball Superleague','mens',true),
('f46db307-26b6-46b7-a0f3-de8d2907b1a7','Vëllaznimi Gjakovë','Kosovo','fc462d0b-c04b-4e16-be0b-6dd670a02481','Kosovo Superleague','mens',true),
('fd34a172-7aed-4cb5-8e21-ce05d8aa7d09','Neftchi IK','Azerbaijan','bec85eb7-a0c3-4147-9ab8-3a7e870d0d01','Azerbaijan Basketball League','mens',true);
insert into pg_temp.ld1_memberships(id,team_id,league_id,season,start_date,end_date,active) values
('0110382f-4d24-4332-a057-215e479409db','8ec0e9b9-e969-4dbf-b754-aadb9b977279','8d6bf95b-7d57-44d4-a8ae-eb6541130c0c','2026-27',null,null,false),
('0dc2d6ac-9d57-4a9b-9557-963f4605a5a6','28c97314-f2d9-45c0-b206-d69a16a0fd9b','f67f0c64-72db-4356-9ad4-f753e01e7bc8','2026-27',null,null,true),
('18d9a561-5803-4209-9964-c71d4cd4b6c0','df493661-c77b-4eb3-9586-d2adf32e22e6','8d6bf95b-7d57-44d4-a8ae-eb6541130c0c','2026-27',null,null,true),
('19ac0743-ce4e-4c4b-be85-c03375b74ef5','a8785ea3-bcf1-4d7d-850f-fb73cd34672f','8d6bf95b-7d57-44d4-a8ae-eb6541130c0c','2026-27',null,null,true),
('305b4b9e-26e2-4d0d-93f8-66121429e80c','5da14bb6-6c62-495c-a244-025ca72e4334','def7c31c-552a-4786-a2e9-66a2d1055b7f','2026-27',null,null,true),
('391f1ef4-258f-4e13-b701-c39608cfdf12','61ee3c85-4edd-42b1-bc49-b6665d3aa0e6','def7c31c-552a-4786-a2e9-66a2d1055b7f','2026-27',null,null,true),
('4c093ee6-f268-4143-8837-28a839b72c0b','cacd78e0-4612-43b8-8fb4-f5d54137c9b7','8d6bf95b-7d57-44d4-a8ae-eb6541130c0c','2026-27',null,null,true),
('4f9dfde8-1aab-42ad-b019-c58a2c8d9195','cc0676c1-fbd7-4a5c-980e-10643794017f','8d6bf95b-7d57-44d4-a8ae-eb6541130c0c','2026-27',null,null,false),
('66721a39-647c-41e9-aab3-ff48793be22b','a5d8c854-12b5-4b03-a2e2-e2d9752e2ea7','def7c31c-552a-4786-a2e9-66a2d1055b7f','2026-27',null,null,true),
('71e37b8d-8100-4f37-8e32-8066f24bf86b','ae2447a4-5101-499e-85c4-f98208747273','8d6bf95b-7d57-44d4-a8ae-eb6541130c0c','2026-27',null,null,true),
('73d08aaf-0d73-4f58-87f1-3104a1c6b8e5','b1eaa5a7-819a-4436-b2d0-cd4d862ea069','8d6bf95b-7d57-44d4-a8ae-eb6541130c0c','2026-27',null,null,true),
('ae9ed4ba-7813-4eb0-ad38-3fa1a08acbf1','57602bbf-9e34-4bca-8b57-011f0b0e395e','8d6bf95b-7d57-44d4-a8ae-eb6541130c0c','2026-27',null,null,false),
('af705a8b-d991-45c2-9f7f-6a8898907e35','9385207b-e793-4a9e-a30d-5ff3f78e4de2','8d6bf95b-7d57-44d4-a8ae-eb6541130c0c','2026-27',null,null,true),
('b56f0fb1-3ed5-4bc6-8ec7-5cc42e988aa0','3da1a735-77e1-481f-9226-716185d10f5c','8d6bf95b-7d57-44d4-a8ae-eb6541130c0c','2026-27',null,null,false),
('bcb1efa6-71db-412a-92b9-395bc016e09a','615088e0-10db-4cd8-9ec2-d9ca9b871eba','def7c31c-552a-4786-a2e9-66a2d1055b7f','2026-27',null,null,true),
('bcc6912b-9e15-4792-8cb0-e2d3958a3134','b2f4321a-40f1-4ee9-a0f1-43474ea2c033','8d6bf95b-7d57-44d4-a8ae-eb6541130c0c','2026-27',null,null,false),
('c8d023fd-2d10-42bc-8f29-05c2d5564291','c44e640a-0a9b-45f3-af90-ea45a2a58a43','8d6bf95b-7d57-44d4-a8ae-eb6541130c0c','2026-27',null,null,true);
insert into pg_temp.ld1_legacy_leagues(id,name,country,active) values
('5539d546-455e-4932-be87-a65ef4a58904','EuroCup Women 2026-27','Europe',true),
('b94bec3a-0da9-4e1e-aabf-82c9b6db4415','Portugal Women’s Basketball League','Portugal',true);
insert into pg_temp.ld1_legacy_teams(id,name,country,league_id,league_name,active) values
('776b06f5-d661-4989-bdef-0ef3089db756','Benfica Women','Portugal','b94bec3a-0da9-4e1e-aabf-82c9b6db4415','Portugal Women’s Basketball League',true),
('91fd819b-4e27-4115-8a5d-cae220b29364','União Sportiva Women','Portugal','b94bec3a-0da9-4e1e-aabf-82c9b6db4415','Portugal Women’s Basketball League',true),
('c40fc36c-6327-4d51-bf32-cada5e4f5dca','Sporting CP Women','Portugal','b94bec3a-0da9-4e1e-aabf-82c9b6db4415','Portugal Women’s Basketball League',true),
('daef522e-5e16-400e-ace4-97725aecefb8','SL Benfica','Portugal','5539d546-455e-4932-be87-a65ef4a58904','EuroCup Women 2026-27',true);
insert into pg_temp.ld1_leagues(id,name,country,season,basketball_type,active) values
('1c883516-158f-4099-8b48-02876e43f07d','Korisliiga','Finland','2026-27','mens',true),
('b408d347-2758-4458-9531-4783ba66f10a','ORLEN Basket Liga','Poland','2026-27','mens',true);
insert into pg_temp.ld1_teams(id,name,country,league_id,league_name,basketball_type,active) values
('10ac2e60-0793-4bf1-af95-a72c7f6911ef','Arriva Lotto Twarde Pierniki Toruń','Poland','b408d347-2758-4458-9531-4783ba66f10a','ORLEN Basket Liga','mens',true),
('14cc437c-a9e5-4d15-9832-1d6a41e9970a','Kataja Basket','Finland','1c883516-158f-4099-8b48-02876e43f07d','Korisliiga','mens',true),
('1acb2b53-7449-40eb-9ade-fd6fe1727b44','Tasomix Rosiek Stal Ostrów Wielkopolski','Poland','b408d347-2758-4458-9531-4783ba66f10a','ORLEN Basket Liga','mens',true),
('27ba7fdb-b124-4551-b603-7c02575dc53d','King Szczecin','Poland','b408d347-2758-4458-9531-4783ba66f10a','ORLEN Basket Liga','mens',true),
('38efb051-df37-4eec-b11f-624eb3c82618','BC Nokia','Finland','1c883516-158f-4099-8b48-02876e43f07d','Korisliiga','mens',false),
('45712789-9737-42ca-89d8-49977a4ab897','Anwil Włocławek','Poland','b408d347-2758-4458-9531-4783ba66f10a','ORLEN Basket Liga','mens',true),
('5f7b3d17-f4e4-4d42-9395-b6abdffa58b3','MKS Dąbrowa Górnicza','Poland','b408d347-2758-4458-9531-4783ba66f10a','ORLEN Basket Liga','mens',true),
('61415a19-4aaf-41a3-b1dc-50b7b04fe657','Energa Trefl Sopot','Poland','b408d347-2758-4458-9531-4783ba66f10a','ORLEN Basket Liga','mens',true),
('64914ef8-3ef7-407a-901f-a5d3b8606323','PGE Start Lublin','Poland','b408d347-2758-4458-9531-4783ba66f10a','ORLEN Basket Liga','mens',true),
('656dc979-7603-4e9b-b3b5-09791b95d418','Kauhajoki','Finland','1c883516-158f-4099-8b48-02876e43f07d','Korisliiga','mens',true),
('68ac74b9-4832-4784-96ac-b12dc69a1ac6','KTP-Basket','Finland','1c883516-158f-4099-8b48-02876e43f07d','Korisliiga','mens',true),
('6a701bc1-d684-4315-a79e-01c929fffc86','Kouvot','Finland','1c883516-158f-4099-8b48-02876e43f07d','Korisliiga','mens',true),
('6e44d786-76c3-4a2c-a6ac-2e0d22c5dad7','GTK Gliwice','Poland','b408d347-2758-4458-9531-4783ba66f10a','ORLEN Basket Liga','mens',true),
('78214a36-b0e0-4d44-afc5-a3bdf96d2287','Salon Vilpas','Finland','1c883516-158f-4099-8b48-02876e43f07d','Korisliiga','mens',true),
('7d22be25-1060-4c02-a6cd-5d8fb9dd3f7d','Górnik Zamek Książ Wałbrzych','Poland','b408d347-2758-4458-9531-4783ba66f10a','ORLEN Basket Liga','mens',true),
('7e6e1ae9-29a4-438d-aaf5-2ddfb5164cd2','AMW Arka Gdynia','Poland','b408d347-2758-4458-9531-4783ba66f10a','ORLEN Basket Liga','mens',true),
('84bf9a9f-38d8-400a-9bac-afc5b9826668','Enea Łaciate Astoria Bydgoszcz','Poland','b408d347-2758-4458-9531-4783ba66f10a','ORLEN Basket Liga','mens',true),
('8d41d286-3968-4ae8-a23f-6f9229c4c9c9','Zastal Zielona Góra','Poland','b408d347-2758-4458-9531-4783ba66f10a','ORLEN Basket Liga','mens',true),
('8fc34e00-12a7-4791-9160-718b37ddad40','Lahti Basketball','Finland','1c883516-158f-4099-8b48-02876e43f07d','Korisliiga','mens',true),
('ab37371f-fcd7-42dd-b72e-4771bb5d2638','Tapiolan Honka','Finland','1c883516-158f-4099-8b48-02876e43f07d','Korisliiga','mens',true),
('b8fbcd0d-d6a0-4898-a6b5-c88d2ee08ce9','Czarni Słupsk','Poland','b408d347-2758-4458-9531-4783ba66f10a','ORLEN Basket Liga','mens',true),
('bfa4c172-5b7f-49b2-af93-a83b31e65f52','Tampereen Pyrintö','Finland','1c883516-158f-4099-8b48-02876e43f07d','Korisliiga','mens',true),
('cb2904a2-2778-4289-91be-17514200cef2','Bisons Loimaa','Finland','1c883516-158f-4099-8b48-02876e43f07d','Korisliiga','mens',true),
('d04f169b-0fd5-4e85-b28f-5776c2356d8e','WKS Śląsk Wrocław','Poland','b408d347-2758-4458-9531-4783ba66f10a','ORLEN Basket Liga','mens',true),
('d1074e47-7248-4e53-a04b-a46ab993e31d','Helsinki Seagulls','Finland','1c883516-158f-4099-8b48-02876e43f07d','Korisliiga','mens',true),
('d9845f51-d838-45f5-ad71-ff1bdbb0374d','Legia Warszawa','Poland','b408d347-2758-4458-9531-4783ba66f10a','ORLEN Basket Liga','mens',true),
('dc77b516-b343-4e4b-a4a3-acd098ca9462','Korihait','Finland','1c883516-158f-4099-8b48-02876e43f07d','Korisliiga','mens',true),
('dcd4874a-121e-4683-80de-80e01d9418e4','Dziki Warszawa','Poland','b408d347-2758-4458-9531-4783ba66f10a','ORLEN Basket Liga','mens',true),
('edd50f0f-ced8-4bcb-a92a-822b1c242b2a','Kipinä Basket','Finland','1c883516-158f-4099-8b48-02876e43f07d','Korisliiga','mens',true);
insert into pg_temp.ld1_leagues(id,name,country,season,basketball_type,active) values
('551948e7-410a-4cab-b39f-feb5ff10cf6d','Basketball Zweite Liga','Austria','2026-27','mens',true),
('ea2c29f1-229b-478b-9df3-ac25e0ce76e5','Basketball Superliga','Austria','2026-27','mens',true);
insert into pg_temp.ld1_teams(id,name,country,league_id,league_name,basketball_type,active) values
('0bf96da1-3a1d-4ff0-afbd-d44a2c50ef84','Vienna United','Austria','551948e7-410a-4cab-b39f-feb5ff10cf6d','Basketball Zweite Liga','mens',true),
('153076a7-7c46-4f00-a4ac-4de2553c80fa','POLFIN KOŠ Celovec','Austria','551948e7-410a-4cab-b39f-feb5ff10cf6d','Basketball Zweite Liga','mens',true),
('1545ed7d-d34d-4d2f-a47a-75ba2118bdbb','UNGER STEEL Gunners Oberwart','Austria','ea2c29f1-229b-478b-9df3-ac25e0ce76e5','Basketball Superliga','mens',true),
('1903f0c1-721b-409c-a543-9abf33836ccb','BK Karbon-X Dukes','Austria','ea2c29f1-229b-478b-9df3-ac25e0ce76e5','Basketball Superliga','mens',true),
('2189926c-b21a-4273-9618-93155a6fd86c','BC Vienna','Austria','ea2c29f1-229b-478b-9df3-ac25e0ce76e5','Basketball Superliga · FIBA Europe Cup · AdmiralBet ABA League','mens',true),
('34e83e06-0250-441c-9f86-4d6dd26d1fa8','Raiffeisen Flyers Wels','Austria','ea2c29f1-229b-478b-9df3-ac25e0ce76e5','Basketball Superliga','mens',true),
('3dcdb610-7969-46f2-bff4-154f859c07c6','Future Team Steiermark','Austria','551948e7-410a-4cab-b39f-feb5ff10cf6d','Basketball Zweite Liga','mens',true),
('60e3c61e-e033-4cef-b093-3b4bcbb67eff','HEFTE HELFEN Bulls Kapfenberg','Austria','ea2c29f1-229b-478b-9df3-ac25e0ce76e5','Basketball Superliga','mens',true),
('6209c6a2-8af4-4377-830b-7e5335f50628','BBU Salzburg','Austria','551948e7-410a-4cab-b39f-feb5ff10cf6d','Basketball Zweite Liga','mens',true),
('625da67d-548e-4510-b7c1-eb26c1800b50','druck.at Traiskirchen Lions','Austria','ea2c29f1-229b-478b-9df3-ac25e0ce76e5','Basketball Superliga','mens',true),
('6440fd33-89ef-458d-ad27-5d769abb8885','SKN St. Pölten Basketball','Austria','ea2c29f1-229b-478b-9df3-ac25e0ce76e5','Basketball Superliga','mens',true),
('7256aca8-4789-426c-abe1-7b40a77d0607','Pirlo Kufstein Towers','Austria','ea2c29f1-229b-478b-9df3-ac25e0ce76e5','Basketball Superliga','mens',true),
('75900f03-087a-4e35-b8c8-1d83ec9f098f','Basketball Klub Rapid Wien','Austria','551948e7-410a-4cab-b39f-feb5ff10cf6d','Basketball Zweite Liga','mens',true),
('7a1a633b-61ae-4daa-9c44-8146a36ed3c6','Safare Traiskirchen Lions NexGen','Austria','551948e7-410a-4cab-b39f-feb5ff10cf6d','Basketball Zweite Liga','mens',true),
('90901ff7-6c21-45b2-8870-9b5438ed8618','Haustechnik Güssing Blackbirds','Austria','551948e7-410a-4cab-b39f-feb5ff10cf6d','Basketball Zweite Liga','mens',true),
('9218ee90-f7fb-4a18-b274-2098f6aaba63','Upper Austrian Ballers','Austria','551948e7-410a-4cab-b39f-feb5ff10cf6d','Basketball Zweite Liga','mens',true),
('999f330c-363a-442f-91ee-6b00188b0fa6','UKJ Mistelbach Mustangs','Austria','551948e7-410a-4cab-b39f-feb5ff10cf6d','Basketball Zweite Liga','mens',true),
('a0ed5191-6ed2-44d9-a17d-43134b94177f','Vienna Timberwolves','Austria','551948e7-410a-4cab-b39f-feb5ff10cf6d','Basketball Zweite Liga','mens',true),
('b6c81f3a-6f48-4d20-a9b1-665e2f05d85a','ASKÖ Radenthein Garnets','Austria','551948e7-410a-4cab-b39f-feb5ff10cf6d','Basketball Zweite Liga','mens',true),
('ba41323f-a2a3-4a33-8c3c-87f9ba4a3b44','SWARCO Raiders Tirol','Austria','551948e7-410a-4cab-b39f-feb5ff10cf6d','Basketball Zweite Liga','mens',true),
('c6fa8ee9-5238-49ad-9260-5b72f37b4ea5','COLDAMARIS BBC Nord Dragonz','Austria','ea2c29f1-229b-478b-9df3-ac25e0ce76e5','Basketball Superliga','mens',true),
('cd8d17c5-1711-46b6-807c-fb8797eaf08e','Eagles Raiffeisen UBSC Graz','Austria','ea2c29f1-229b-478b-9df3-ac25e0ce76e5','Basketball Superliga','mens',true),
('d53c5c05-b59a-4fe6-b844-562c37b011c1','Wörthersee Piraten','Austria','551948e7-410a-4cab-b39f-feb5ff10cf6d','Basketball Zweite Liga','mens',true),
('d6651191-c56d-4d60-ac30-cc7b8a5edbfb','Raiffeisen Mattersburg Rocks','Austria','551948e7-410a-4cab-b39f-feb5ff10cf6d','Basketball Zweite Liga','mens',true),
('e02748c0-22b9-443c-9eed-dfb2cfe0e8b7','Raiffeisen Swans Gmunden','Austria','ea2c29f1-229b-478b-9df3-ac25e0ce76e5','Basketball Superliga','mens',true),
('e867479f-71a5-4bdd-81d8-35b2da7b1e88','Union Deutsch Wagram Alligators','Austria','551948e7-410a-4cab-b39f-feb5ff10cf6d','Basketball Zweite Liga','mens',true);
insert into pg_temp.ld1_teams(id,name,country,league_id,league_name,basketball_type,active) values
('00569c78-42e1-4640-9eda-74e475e2f6d0','Treviglio Brianza Basket','Italy',null,'Serie B Nazionale','mens',true),
('057cdd3d-ae06-4bdc-81cb-d5cc546faff4','Ristopro Fabriano','Italy',null,'Serie B Nazionale','mens',true),
('060b9cc6-ee4f-49de-9f52-041b1659bf58','Andrea Costa Imola','Italy',null,'Serie B Nazionale','mens',true),
('10003fcd-48bd-4727-892d-3d0365323619','Logiman Orzinuovi','Italy',null,'Serie B Nazionale','mens',true),
('143cc422-e4ca-42d6-8695-c3dcc9b04d0d','Luiss Roma','Italy',null,'Serie B Nazionale','mens',true),
('16480fe4-f14c-47bf-b9b5-19efd257c425','Infodrive Capo d''Orlando','Italy',null,'Serie B Nazionale','mens',true),
('26eee4ff-0e9a-4547-ac32-4951ef08d573','Siaz Basket Piazza Armerina','Italy',null,'Serie B Nazionale','mens',true),
('2c738e6d-bcb5-4faf-95f5-eb9c32eccbb3','Benacquista Latina','Italy',null,'Serie B Nazionale','mens',true),
('36ca461a-6a29-4a1c-a4b3-5ebbb3eb2115','Dany Quarrata','Italy',null,'Serie B Nazionale','mens',true),
('38680007-e2df-4558-b585-139d0b74411b','Umana San Giobbe Chiusi','Italy',null,'Serie B Nazionale','mens',true),
('5512c9ac-a50a-4436-b5e7-961036407aea','Luxarm Lumezzane','Italy',null,'Serie B Nazionale','mens',true),
('556ba16a-9851-419d-8cee-507d8a98d9ca','Tema Sinergie Faenza','Italy',null,'Serie B Nazionale','mens',true),
('55ac1cf3-4c31-4815-9bfe-9d71af5f4825','Pallacanestro Viola Reggio Calabria','Italy',null,'Serie B Nazionale','mens',true),
('61461ba4-8fc9-4ea7-9f48-c13b545d5e27','Fiorenzuola Bees','Italy',null,'Serie B Nazionale','mens',true),
('64362e1c-0e9a-4c8e-82c9-840a3cf996ec','Moncada Energy Agrigento','Italy',null,'Serie B Nazionale','mens',true),
('935019ac-5117-4e73-954d-3a6bb7ca9114','Legnano Knights','Italy',null,'Serie B Nazionale','mens',true),
('a138f18a-187b-479b-908e-9eaf8294781b','Cestistica San Severo','Italy',null,'Serie B Nazionale','mens',true),
('a31ba911-1405-4d8a-812d-e5b1564b2cc5','A2A Leonessa Brescia','Italy',null,'Serie B Nazionale','mens',true),
('a3d3c1af-7228-47f5-8f04-cdae1b065162','S4 Energia Vicenza','Italy',null,'Serie B Nazionale','mens',true),
('a686d321-cea1-446b-af07-011cd4794487','Basketball Club Lucca','Italy',null,'Serie B Nazionale','mens',true),
('a8b6edfb-ec57-4ff1-9d7f-14052b98fbc6','Adamant Ferrara','Italy',null,'Serie B Nazionale','mens',true),
('ac2414b7-d25b-49e2-b15e-9ed1e853081e','UCC Assigeco Piacenza','Italy',null,'Serie B Nazionale','mens',true),
('b8082ede-fabd-4e17-8500-e2150ac9e1bf','Rucker San Vendemiano','Italy',null,'Serie B Nazionale','mens',true),
('bab7adaa-8115-46df-968f-37ef5679fa01','Rimadesio Desio','Italy',null,'Serie B Nazionale','mens',true),
('c2e540ff-9baf-411c-b98c-f10f00dbeb1e','Virtus Roma 1960','Italy',null,'Serie B Nazionale','mens',true),
('c3f57f90-7df3-4bde-a730-21a1a5199244','Pielle Livorno','Italy',null,'Serie B Nazionale','mens',true),
('c71045f7-7275-4a7a-a400-9467eab96a79','Fabo Herons Montecatini','Italy',null,'Serie B Nazionale','mens',true),
('cc5a330a-30b5-4a2e-a84a-f2cc0a7a37e1','Fulgor Basket Omegna','Italy',null,'Serie B Nazionale','mens',true),
('df9a2b9a-0746-4ea8-b09d-da190e9411db','Loreto Pesaro','Italy',null,'Serie B Nazionale','mens',true),
('e0113861-fa41-4c4c-a815-bb9ee4e9c319','Solbat Golfo Piombino','Italy',null,'Serie B Nazionale','mens',true),
('e28fa35d-bb54-4ede-b736-2ded1593b039','OraSì Ravenna','Italy',null,'Serie B Nazionale','mens',true),
('e5dd37ac-df02-4f05-a0fa-cc3c933b4b3a','Liofilchem Roseto','Italy',null,'Serie B Nazionale','mens',true),
('ec3a7bab-2047-48b8-a832-d412790f5de3','Mens Sana Basketball Siena','Italy',null,'Serie B Nazionale','mens',true),
('ed22da58-ada3-44e4-8c5d-6f83b0b6df1d','Sangiorgese Basket','Italy',null,'Serie B Nazionale','mens',true),
('ed45e3f5-b33f-48ad-98ce-ab15274ec538','Felice Scandone Avellino','Italy',null,'Serie B Nazionale','mens',true),
('f3da7305-9f68-46a7-ada3-dbc7d65e6947','PSA Napoli Est','Italy',null,'Serie B Nazionale','mens',true);
insert into pg_temp.ld1_teams(id,name,country,league_id,league_name,basketball_type,active) values
('0cb91473-6e77-446c-8088-2f67285f9948','Phoenix Mercury','United States',null,'Women''s National Basketball Association (WNBA)','womens',true),
('18f29d86-aac8-4466-91a8-3c7ea5681174','Golden State Valkyries','United States',null,'Women''s National Basketball Association (WNBA)','womens',true),
('1d4b3f2c-b046-402e-b244-6f96dc6cdb17','Chicago Sky','United States',null,'Women''s National Basketball Association (WNBA)','womens',true),
('397a6d3a-b047-432d-942d-25a84cf562c4','Toronto Tempo','Canada',null,'Women''s National Basketball Association (WNBA)','womens',true),
('4dd7249b-fd23-4392-90af-f7f6cd1353e8','New York Liberty','United States',null,'Women''s National Basketball Association (WNBA)','womens',true),
('63b5bede-a37e-4699-81a4-17ef29f6f9bb','Seattle Storm','United States',null,'Women''s National Basketball Association (WNBA)','womens',true),
('90e9a8ee-da8a-4434-84d5-c43328a75ad0','Las Vegas Aces','United States',null,'Women''s National Basketball Association (WNBA)','womens',true),
('b4d5020c-2cef-42b6-8f02-632daa028d3d','Indiana Fever','United States',null,'Women''s National Basketball Association (WNBA)','womens',true),
('bd8e9670-b4ad-412e-b22c-59f183ff818b','Atlanta Dream','United States',null,'Women''s National Basketball Association (WNBA)','womens',true),
('c4fbab1d-7664-4d88-88ea-de9aac96db08','Minnesota Lynx','United States',null,'Women''s National Basketball Association (WNBA)','womens',true),
('e98489aa-63c4-4c68-9317-9a8462d1ce1a','Portland Fire','United States',null,'Women''s National Basketball Association (WNBA)','womens',true),
('eb5cfa61-b802-408e-a6e3-1df6f1872755','Connecticut Sun','United States',null,'Women''s National Basketball Association (WNBA)','womens',true),
('f182c7ec-83e4-455b-9870-d1a23b1c33cb','Washington Mystics','United States',null,'Women''s National Basketball Association (WNBA)','womens',true),
('fb6dd5a3-f927-4bfb-b5d9-f0840d4cd5ad','Dallas Wings','United States',null,'Women''s National Basketball Association (WNBA)','womens',true),
('ff0e2bcf-b30b-42be-bcfe-88b8deee9252','Los Angeles Sparks','United States',null,'Women''s National Basketball Association (WNBA)','womens',true);
insert into pg_temp.ld1_legacy_leagues(id,name,country,active) values
('3e0e1b7c-b14c-4bf3-b0a7-a94b271ffed4','Women''s National Basketball Association (WNBA)','United States',true),
('bd8a3864-10ed-4ad3-8d31-51158c553401','WNBA','United States',false);
insert into pg_temp.ld1_legacy_teams(id,name,country,league_id,league_name,active) values
('0cb91473-6e77-446c-8088-2f67285f9948','Phoenix Mercury','United States','3e0e1b7c-b14c-4bf3-b0a7-a94b271ffed4','Women''s National Basketball Association (WNBA)',true),
('18f29d86-aac8-4466-91a8-3c7ea5681174','Golden State Valkyries','United States','3e0e1b7c-b14c-4bf3-b0a7-a94b271ffed4','Women''s National Basketball Association (WNBA)',true),
('1d4b3f2c-b046-402e-b244-6f96dc6cdb17','Chicago Sky','United States','3e0e1b7c-b14c-4bf3-b0a7-a94b271ffed4','Women''s National Basketball Association (WNBA)',true),
('397a6d3a-b047-432d-942d-25a84cf562c4','Toronto Tempo','Canada','3e0e1b7c-b14c-4bf3-b0a7-a94b271ffed4','Women''s National Basketball Association (WNBA)',true),
('4dd7249b-fd23-4392-90af-f7f6cd1353e8','New York Liberty','United States','3e0e1b7c-b14c-4bf3-b0a7-a94b271ffed4','Women''s National Basketball Association (WNBA)',true),
('63b5bede-a37e-4699-81a4-17ef29f6f9bb','Seattle Storm','United States','3e0e1b7c-b14c-4bf3-b0a7-a94b271ffed4','Women''s National Basketball Association (WNBA)',true),
('90e9a8ee-da8a-4434-84d5-c43328a75ad0','Las Vegas Aces','United States','3e0e1b7c-b14c-4bf3-b0a7-a94b271ffed4','Women''s National Basketball Association (WNBA)',true),
('b4d5020c-2cef-42b6-8f02-632daa028d3d','Indiana Fever','United States','3e0e1b7c-b14c-4bf3-b0a7-a94b271ffed4','Women''s National Basketball Association (WNBA)',true),
('bd8e9670-b4ad-412e-b22c-59f183ff818b','Atlanta Dream','United States','3e0e1b7c-b14c-4bf3-b0a7-a94b271ffed4','Women''s National Basketball Association (WNBA)',true),
('c4fbab1d-7664-4d88-88ea-de9aac96db08','Minnesota Lynx','United States','3e0e1b7c-b14c-4bf3-b0a7-a94b271ffed4','Women''s National Basketball Association (WNBA)',true),
('e98489aa-63c4-4c68-9317-9a8462d1ce1a','Portland Fire','United States','3e0e1b7c-b14c-4bf3-b0a7-a94b271ffed4','Women''s National Basketball Association (WNBA)',true),
('eb5cfa61-b802-408e-a6e3-1df6f1872755','Connecticut Sun','United States','3e0e1b7c-b14c-4bf3-b0a7-a94b271ffed4','Women''s National Basketball Association (WNBA)',true),
('f182c7ec-83e4-455b-9870-d1a23b1c33cb','Washington Mystics','United States','3e0e1b7c-b14c-4bf3-b0a7-a94b271ffed4','Women''s National Basketball Association (WNBA)',true),
('fb6dd5a3-f927-4bfb-b5d9-f0840d4cd5ad','Dallas Wings','United States','3e0e1b7c-b14c-4bf3-b0a7-a94b271ffed4','Women''s National Basketball Association (WNBA)',true),
('ff0e2bcf-b30b-42be-bcfe-88b8deee9252','Los Angeles Sparks','United States','3e0e1b7c-b14c-4bf3-b0a7-a94b271ffed4','Women''s National Basketball Association (WNBA)',true);
insert into pg_temp.ld1_teams(id,name,country,league_id,league_name,basketball_type,active) values
('0512ffba-fed9-470f-8034-82f3e5344712','Sport Club do Recife','Brazil',null,'Brazilian LBF','womens',true),
('08ff30d3-2d32-4e19-ad87-d982f2410704','Pro-Network Enea AJP Gorzów Wlkp.','Poland',null,'Polish Women Basketball League','womens',true),
('11437f39-d6dd-4547-b6c0-7af83ef839a8','Santo André','Brazil',null,'Brazilian LBF','womens',true),
('19109739-148d-47a7-8899-c38e797a36fb','Lotto AZS UMCS Lublin','Poland',null,'Polish Women Basketball League','womens',true),
('3ddb8217-a6fb-4c0f-943d-2059c882f17c','SESI Araraquara Basquete','Brazil',null,'Brazilian LBF','womens',true),
('4b078b6b-d144-4f9e-adbb-6ec4fa832167','Corinthians Basquete Feminino','Brazil',null,'Brazilian LBF','womens',true),
('52dbdd2a-c2c2-404c-a9a3-0f995cce0b39','Cerrado Basquete','Brazil',null,'Brazilian LBF','womens',true),
('5ca1f3b4-ab64-45bf-b642-84283cc136b5','Salvador Basketball','Brazil',null,'Brazilian LBF','womens',true),
('5ecdbfd5-83cd-4c90-9594-1e8833aa8a39','Isands JTEC Wichoś Jelenia Góra','Poland',null,'Polish Women Basketball League','womens',true),
('85b88d4e-ee35-4f4c-b59d-b4735412e84d','Artego Bydgoszcz','Poland',null,'Polish Women Basketball League','womens',true),
('88b100f7-768b-4a1e-afbe-74fb80ca51e1','Contimax MOSIR Bochnia','Poland',null,'Polish Women Basketball League','womens',true),
('8a51fc72-9b7d-4889-8c92-16ec1e144c8e','PGE Wisła Kraków','Poland',null,'Polish Women Basketball League','womens',true),
('9296954d-81f8-4bc0-aaed-af63e5c83ed0','São José Basketball','Brazil',null,'Brazilian LBF','womens',true),
('99e3ffff-9fe4-40b6-be90-915d41fcb286','Enea AZS Politechnika Poznań','Poland',null,'Polish Women Basketball League','womens',true),
('a846b49a-9afc-4486-819f-c28b91630ae9','Energa Toruń','Poland',null,'Polish Women Basketball League','womens',true),
('ad04901c-6d65-4978-aa1a-f53af3c988e7','MB Zagłębie Sosnowiec','Poland',null,'Polish Women Basketball League','womens',true),
('b00de2f6-554c-44a9-b191-0f58844a40f6','ADRM Maringá','Brazil',null,'Brazilian LBF','womens',true),
('b94c4917-26a7-4d85-8dcb-87218ec7e11b','1KS Ślęza Wrocław','Poland',null,'Polish Women Basketball League','womens',true),
('c16fed56-66c8-4869-8a2c-4dadcd1906e4','Unimed Campinas Basquete','Brazil',null,'Brazilian LBF','womens',true),
('cc80c12d-27fb-4185-8ade-ebd71457a0b9','Widzew Łódź','Poland',null,'Polish Women Basketball League','womens',true),
('d8407e8e-4f36-4ef9-87e0-38fdfb8a64d4','SKK Polonia Warszawa','Poland',null,'Polish Women Basketball League','womens',true),
('d9979ede-9fd5-4b26-8c6d-6a10f6726d4e','Sampaio Basquete','Brazil',null,'Brazilian LBF','womens',true),
('de27044d-fe82-48f1-aea8-340f6b99f1f4','Lotto MKS Pruszków','Poland',null,'Polish Women Basketball League','womens',true),
('ea76f41d-588c-499b-8228-229fb6b61f23','Sodiê Mesquita','Brazil',null,'Brazilian LBF','womens',true);
insert into pg_temp.ld1_legacy_leagues(id,name,country,active) values
('656c1095-d1ef-4aaf-8291-f57cbb9123a6','Brazilian LBF','Brazil',true),
('8198b77d-8ad4-4ca5-b8c9-1f4cfc9e3992','Polish Women’s Basketball League','Poland',true);
insert into pg_temp.ld1_legacy_teams(id,name,country,league_id,league_name,active) values
('0512ffba-fed9-470f-8034-82f3e5344712','Sport Club do Recife','Brazil','656c1095-d1ef-4aaf-8291-f57cbb9123a6','Brazilian LBF',true),
('11437f39-d6dd-4547-b6c0-7af83ef839a8','Santo André','Brazil','656c1095-d1ef-4aaf-8291-f57cbb9123a6','Brazilian LBF',true),
('3db06745-8313-4a7d-b9c8-40023c99bc26','Arka Gdynia Women','Poland','8198b77d-8ad4-4ca5-b8c9-1f4cfc9e3992','Polish Women’s Basketball League',true),
('3ddb8217-a6fb-4c0f-943d-2059c882f17c','SESI Araraquara Basquete','Brazil','656c1095-d1ef-4aaf-8291-f57cbb9123a6','Brazilian LBF',true),
('4b078b6b-d144-4f9e-adbb-6ec4fa832167','Corinthians Basquete Feminino','Brazil','656c1095-d1ef-4aaf-8291-f57cbb9123a6','Brazilian LBF',true),
('52dbdd2a-c2c2-404c-a9a3-0f995cce0b39','Cerrado Basquete','Brazil','656c1095-d1ef-4aaf-8291-f57cbb9123a6','Brazilian LBF',true),
('5ca1f3b4-ab64-45bf-b642-84283cc136b5','Salvador Basketball','Brazil','656c1095-d1ef-4aaf-8291-f57cbb9123a6','Brazilian LBF',true),
('7dc74ca5-1d2b-440f-ba2e-345c6e95b3cf','Polkowice Women','Poland','8198b77d-8ad4-4ca5-b8c9-1f4cfc9e3992','Polish Women’s Basketball League',true),
('9296954d-81f8-4bc0-aaed-af63e5c83ed0','São José Basketball','Brazil','656c1095-d1ef-4aaf-8291-f57cbb9123a6','Brazilian LBF',true),
('b00de2f6-554c-44a9-b191-0f58844a40f6','ADRM Maringá','Brazil','656c1095-d1ef-4aaf-8291-f57cbb9123a6','Brazilian LBF',true),
('c16fed56-66c8-4869-8a2c-4dadcd1906e4','Unimed Campinas Basquete','Brazil','656c1095-d1ef-4aaf-8291-f57cbb9123a6','Brazilian LBF',true),
('d9979ede-9fd5-4b26-8c6d-6a10f6726d4e','Sampaio Basquete','Brazil','656c1095-d1ef-4aaf-8291-f57cbb9123a6','Brazilian LBF',true),
('ea76f41d-588c-499b-8228-229fb6b61f23','Sodiê Mesquita','Brazil','656c1095-d1ef-4aaf-8291-f57cbb9123a6','Brazilian LBF',true),
('f65ab92b-240a-4a7e-a990-4e4d796fd31d','AZS UMCS Lublin Women','Poland','8198b77d-8ad4-4ca5-b8c9-1f4cfc9e3992','Polish Women’s Basketball League',true);
insert into pg_temp.ld1_teams(id,name,country,league_id,league_name,basketball_type,active) values
('06ebd739-7cc7-4cfb-9b20-14acb39fbc4b','Independiente Neuquén Women','Argentina',null,'Argentina Women’s Basketball League','womens',true),
('3617b1c3-d22d-457b-8740-855086b99c52','Instituto Women','Argentina',null,'Argentina Women’s Basketball League','womens',true),
('44e20cab-1815-4d71-a943-0733a4fdc377','Boca Juniors Women','Argentina',null,'Argentina Women’s Basketball League','womens',true),
('493dd967-2f76-4d1b-97b4-fe0301bb113c','Náutico Sportivo Avellaneda Women','Argentina',null,'Argentina Women’s Basketball League','womens',true),
('54d597a0-ecf1-4a5f-9674-4a84f580533c','El Biguá Women','Argentina',null,'Argentina Women’s Basketball League','womens',true),
('64194c72-d593-4e09-8d8b-7e3d79e34276','Obras Basket Women','Argentina',null,'Argentina Women’s Basketball League','womens',true),
('6f1ef03e-9794-4327-9c09-b49e644eff7f','Quilmes Women','Argentina',null,'Argentina Women’s Basketball League','womens',true),
('7b96d6cc-97f2-4b2b-9c21-e2980e5356f3','Unión Bahía Women','Argentina',null,'Argentina Women’s Basketball League','womens',true),
('93ebb134-24d4-447d-9252-b45ef5403f46','Deportivo Berazategui Women','Argentina',null,'Argentina Women’s Basketball League','womens',true),
('9cdd59c7-928a-4b65-8544-fb3701afd135','Rocamora Women','Argentina',null,'Argentina Women’s Basketball League','womens',true),
('a3d553a9-fe1e-4d89-a95f-339a1aab2106','Chañares Women','Argentina',null,'Argentina Women’s Basketball League','womens',true),
('ac46a861-efcd-4707-be7d-b694990dc05c','Hindú Club Córdoba Women','Argentina',null,'Argentina Women’s Basketball League','womens',true),
('ae5a06eb-9f00-4058-9d29-c5c7306ef637','Unión Florida Women','Argentina',null,'Argentina Women’s Basketball League','womens',true),
('d81e6e25-9f94-492d-a635-c17bbb7fcd36','Vélez Sarsfield Women','Argentina',null,'Argentina Women’s Basketball League','womens',true),
('e1252fbb-461b-4e64-9214-4f2d49a61889','Sociedad Española Women','Argentina',null,'Argentina Women’s Basketball League','womens',true),
('e7cd8a94-b125-4449-840c-7557b492bf27','Ferro Carril Oeste Women','Argentina',null,'Argentina Women’s Basketball League','womens',true),
('e9eee4dd-f560-4e2f-a5aa-7ed2f7ea5456','Regatas San Nicolás Women','Argentina',null,'Argentina Women’s Basketball League','womens',true),
('f61d016d-45d4-44e8-b650-aca5f8cd9974','Peñarol Mar del Plata Women','Argentina',null,'Argentina Women’s Basketball League','womens',true),
('fafe3d53-ea35-45ac-85d9-8437d0f66e6d','San José Mendoza Women','Argentina',null,'Argentina Women’s Basketball League','womens',true),
('fca0b404-b098-419c-afa2-5852adc96814','El Talar Women','Argentina',null,'Argentina Women’s Basketball League','womens',true);
insert into pg_temp.ld1_legacy_leagues(id,name,country,active) values
('5c2e00b7-391d-4630-bba1-fd8887fb9c39','Argentina Women’s Basketball League','Argentina',true);
insert into pg_temp.ld1_legacy_teams(id,name,country,league_id,league_name,active) values
('06ebd739-7cc7-4cfb-9b20-14acb39fbc4b','Independiente Neuquén Women','Argentina','5c2e00b7-391d-4630-bba1-fd8887fb9c39','Argentina Women’s Basketball League',true),
('3617b1c3-d22d-457b-8740-855086b99c52','Instituto Women','Argentina','5c2e00b7-391d-4630-bba1-fd8887fb9c39','Argentina Women’s Basketball League',true),
('44e20cab-1815-4d71-a943-0733a4fdc377','Boca Juniors Women','Argentina','5c2e00b7-391d-4630-bba1-fd8887fb9c39','Argentina Women’s Basketball League',true),
('493dd967-2f76-4d1b-97b4-fe0301bb113c','Náutico Sportivo Avellaneda Women','Argentina','5c2e00b7-391d-4630-bba1-fd8887fb9c39','Argentina Women’s Basketball League',true),
('54d597a0-ecf1-4a5f-9674-4a84f580533c','El Biguá Women','Argentina','5c2e00b7-391d-4630-bba1-fd8887fb9c39','Argentina Women’s Basketball League',true),
('64194c72-d593-4e09-8d8b-7e3d79e34276','Obras Basket Women','Argentina','5c2e00b7-391d-4630-bba1-fd8887fb9c39','Argentina Women’s Basketball League',true),
('6f1ef03e-9794-4327-9c09-b49e644eff7f','Quilmes Women','Argentina','5c2e00b7-391d-4630-bba1-fd8887fb9c39','Argentina Women’s Basketball League',true),
('7b96d6cc-97f2-4b2b-9c21-e2980e5356f3','Unión Bahía Women','Argentina','5c2e00b7-391d-4630-bba1-fd8887fb9c39','Argentina Women’s Basketball League',true),
('93ebb134-24d4-447d-9252-b45ef5403f46','Deportivo Berazategui Women','Argentina','5c2e00b7-391d-4630-bba1-fd8887fb9c39','Argentina Women’s Basketball League',true),
('9cdd59c7-928a-4b65-8544-fb3701afd135','Rocamora Women','Argentina','5c2e00b7-391d-4630-bba1-fd8887fb9c39','Argentina Women’s Basketball League',true),
('a3d553a9-fe1e-4d89-a95f-339a1aab2106','Chañares Women','Argentina','5c2e00b7-391d-4630-bba1-fd8887fb9c39','Argentina Women’s Basketball League',true),
('ac46a861-efcd-4707-be7d-b694990dc05c','Hindú Club Córdoba Women','Argentina','5c2e00b7-391d-4630-bba1-fd8887fb9c39','Argentina Women’s Basketball League',true),
('ae5a06eb-9f00-4058-9d29-c5c7306ef637','Unión Florida Women','Argentina','5c2e00b7-391d-4630-bba1-fd8887fb9c39','Argentina Women’s Basketball League',true),
('d81e6e25-9f94-492d-a635-c17bbb7fcd36','Vélez Sarsfield Women','Argentina','5c2e00b7-391d-4630-bba1-fd8887fb9c39','Argentina Women’s Basketball League',true),
('e1252fbb-461b-4e64-9214-4f2d49a61889','Sociedad Española Women','Argentina','5c2e00b7-391d-4630-bba1-fd8887fb9c39','Argentina Women’s Basketball League',true),
('e7cd8a94-b125-4449-840c-7557b492bf27','Ferro Carril Oeste Women','Argentina','5c2e00b7-391d-4630-bba1-fd8887fb9c39','Argentina Women’s Basketball League',true),
('e9eee4dd-f560-4e2f-a5aa-7ed2f7ea5456','Regatas San Nicolás Women','Argentina','5c2e00b7-391d-4630-bba1-fd8887fb9c39','Argentina Women’s Basketball League',true),
('f61d016d-45d4-44e8-b650-aca5f8cd9974','Peñarol Mar del Plata Women','Argentina','5c2e00b7-391d-4630-bba1-fd8887fb9c39','Argentina Women’s Basketball League',true),
('fafe3d53-ea35-45ac-85d9-8437d0f66e6d','San José Mendoza Women','Argentina','5c2e00b7-391d-4630-bba1-fd8887fb9c39','Argentina Women’s Basketball League',true),
('fca0b404-b098-419c-afa2-5852adc96814','El Talar Women','Argentina','5c2e00b7-391d-4630-bba1-fd8887fb9c39','Argentina Women’s Basketball League',true);
insert into pg_temp.ld1_teams(id,name,country,league_id,league_name,basketball_type,active) values
('0e125cbb-52df-4ff2-b00d-3e06010899c9','Gimnástico Women','Chile',null,'Liga Nacional Femenina (Chile)','womens',true),
('242ee735-a5b4-427b-9c3d-9a653b47ed4b','Sportiva Italiana Women','Chile',null,'Liga Nacional Femenina (Chile)','womens',true),
('24be5f5c-52c9-4735-9a6b-c994132adca5','UdeC Women','Chile',null,'Liga Nacional Femenina (Chile)','womens',true),
('8a3a576a-524b-4267-8ca0-4ef3e02881cc','Colegio Los Leones Women','Chile',null,'Liga Nacional Femenina (Chile)','womens',true),
('8d26dd71-7abf-4e67-b364-86c8786c7648','Sergio Ceppi Women','Chile',null,'Liga Nacional Femenina (Chile)','womens',true),
('a9a93cdc-badc-4c0a-8af5-d9442f915b76','Boston College Women','Chile',null,'Liga Nacional Femenina (Chile)','womens',true),
('b3d3967f-98ae-41c9-a3fa-8f3deb452ec8','Luis Matte Larraín Women','Chile',null,'Liga Nacional Femenina (Chile)','womens',true),
('be4f57b9-382a-4608-b53e-ecaa6ba2441a','Azul y Rojo Women','Chile',null,'Liga Nacional Femenina (Chile)','womens',true),
('02a0163a-5311-4b1b-98f5-b49c383d9e1e','Adelitas de Chihuahua','Mexico',null,'LNBP Femenil','womens',true),
('564c7a9b-3659-4b86-a1ad-9d28a93467a6','El Calor de Cancún Femenil','Mexico',null,'LNBP Femenil','womens',true),
('7877c834-ae49-43e2-8ab9-ffa1b8704e79','Abejas de León Femenil','Mexico',null,'LNBP Femenil','womens',true),
('876f1352-33dd-4be4-8a4e-3726b09597bd','Fuerza Regia Femenil','Mexico',null,'LNBP Femenil','womens',true),
('88dd1028-abae-4daa-a348-b3bcff67426c','Freseras de Irapuato','Mexico',null,'LNBP Femenil','womens',true),
('8c1c2e2d-3ed9-4896-9a88-4083409d7b8f','Correcaminos UAT Femenil','Mexico',null,'LNBP Femenil','womens',true),
('a98b6893-d29d-4972-961a-5848645c9653','Panteras de Aguascalientes Femenil','Mexico',null,'LNBP Femenil','womens',true),
('e316dfee-28fd-4e90-9e80-3cc18d7c2204','Santas del Potosí','Mexico',null,'LNBP Femenil','womens',true),
('18c01b60-c607-4f80-a2c5-3f3d0dd605b7','CS Oxigen București','Romania',null,'Liga Națională de Baschet Feminin','womens',true),
('2190b4db-3b15-4707-afb4-d1441a9f0253','CSM CSU Târgoviște Women','Romania',null,'Liga Națională de Baschet Feminin','womens',true),
('4c29a7ad-924f-4182-a6b0-75bcbfd8597b','ACS Sepsi SIC Sfântu Gheorghe','Romania',null,'Liga Națională de Baschet Feminin','womens',true),
('72e524c1-2d10-4885-ab33-57e94b7075d5','CS Agronomia București','Romania',null,'Liga Națională de Baschet Feminin','womens',true),
('768823af-d21d-41ad-ac6b-43e22e8176dd','CSJ Teleorman Alexandria','Romania',null,'Liga Națională de Baschet Feminin','womens',true),
('809dedc8-b895-4cd8-b52c-dc87c46c8aad','CS Universitatea Cluj-Napoca Women','Romania',null,'Liga Națională de Baschet Feminin','womens',true),
('81c37b3f-ebea-40a6-8e5f-15ac64d7fa86','Sportul Studențesc București Women','Romania',null,'Liga Națională de Baschet Feminin','womens',true),
('907c47c0-9569-4a1d-8812-ece61d87daf5','CSU Politehnica Timișoara Women','Romania',null,'Liga Națională de Baschet Feminin','womens',true),
('e13f73ca-c7ac-4938-8762-0236edb2358d','FCC Baschet UAV Arad','Romania',null,'Liga Națională de Baschet Feminin','womens',true),
('f91a25cc-854d-47d8-b552-ab41e778ec19','CS Rapid București Women','Romania',null,'Liga Națională de Baschet Feminin','womens',true),
('075dc80f-9e7b-4d1d-8c12-be26eee40af9','ŽKK Kraljevo','Serbia',null,'Prva ženska liga Srbije','womens',true),
('2308695d-8b9d-4964-a423-2c8d2b81c5cd','Vojvodina 021','Serbia',null,'Prva ženska liga Srbije','womens',true),
('353a6a41-46ac-4d7f-aa4b-b6f132596d3f','Ras Beograd','Serbia',null,'Prva ženska liga Srbije','womens',true),
('3d1b5bce-4825-42f6-8b12-702ca6dc5e30','Mega Basket Women','Serbia',null,'Prva ženska liga Srbije','womens',true),
('45e18a98-3cba-44d7-af9a-dfd1d396cdbf','Student Niš Women','Serbia',null,'Prva ženska liga Srbije','womens',true),
('55579fb4-7ed9-40af-a8db-fd8b74a48682','Nibak Niš','Serbia',null,'Prva ženska liga Srbije','womens',true),
('8603eef0-5c1c-44db-943a-62fca5c49431','Korać Akademija 011','Serbia',null,'Prva ženska liga Srbije','womens',true),
('9b92b113-296a-4990-8283-20b75e50f557','Duga Šabac','Serbia',null,'Prva ženska liga Srbije','womens',true),
('a18685b4-8003-4676-805d-958e2499b5b5','Novosadska ženska košarkaška akademija','Serbia',null,'Prva ženska liga Srbije','womens',true),
('d2b9cecd-a157-43cf-be1a-cbf0f6bdad2d','Partizan 1953','Serbia',null,'Prva ženska liga Srbije','womens',true),
('e4d63468-650c-4f5c-bf11-c5a703adc8c5','Spartak Subotica Women','Serbia',null,'Prva ženska liga Srbije','womens',true),
('f7d74e1d-9975-481c-b97b-3b2c7365d0f3','Crvena zvezda Women','Serbia',null,'Prva ženska liga Srbije','womens',true);
insert into pg_temp.ld1_legacy_leagues(id,name,country,active) values
('682f5612-be1e-420e-8eb0-877e92d88c91','Liga Nacional Femenina (Chile)','Chile',true),
('6e594f35-8a5e-4cb7-9b0c-8fc8385d142a','LNBP Femenil','Mexico',true),
('bf301d70-8bf3-4650-8236-5d34bc6766e1','Serbian Women’s Basketball League','Serbia',true),
('c8b0fe1b-15ed-4a64-af62-f1d33b6436cc','Romanian Women’s Basketball League','Romania',true);
insert into pg_temp.ld1_legacy_teams(id,name,country,league_id,league_name,active) values
('02a0163a-5311-4b1b-98f5-b49c383d9e1e','Adelitas de Chihuahua','Mexico','6e594f35-8a5e-4cb7-9b0c-8fc8385d142a','LNBP Femenil',true),
('0e125cbb-52df-4ff2-b00d-3e06010899c9','Gimnástico Women','Chile','682f5612-be1e-420e-8eb0-877e92d88c91','Liga Nacional Femenina (Chile)',true),
('242ee735-a5b4-427b-9c3d-9a653b47ed4b','Sportiva Italiana Women','Chile','682f5612-be1e-420e-8eb0-877e92d88c91','Liga Nacional Femenina (Chile)',true),
('24be5f5c-52c9-4735-9a6b-c994132adca5','UdeC Women','Chile','682f5612-be1e-420e-8eb0-877e92d88c91','Liga Nacional Femenina (Chile)',true),
('2796c3c0-8cd2-430b-8a7e-947a15791ed4','CSM Târgoviște Women','Romania','c8b0fe1b-15ed-4a64-af62-f1d33b6436cc','Romanian Women’s Basketball League',true),
('4f7fbca5-7983-4fa1-b1dd-0a74eb210503','Sepsi-SIC Women','Romania','c8b0fe1b-15ed-4a64-af62-f1d33b6436cc','Romanian Women’s Basketball League',true),
('564c7a9b-3659-4b86-a1ad-9d28a93467a6','El Calor de Cancún Femenil','Mexico','6e594f35-8a5e-4cb7-9b0c-8fc8385d142a','LNBP Femenil',true),
('68cb99b5-dd4b-486a-a36e-317154dda00c','Partizan Women','Serbia','bf301d70-8bf3-4650-8236-5d34bc6766e1','Serbian Women’s Basketball League',true),
('7877c834-ae49-43e2-8ab9-ffa1b8704e79','Abejas de León Femenil','Mexico','6e594f35-8a5e-4cb7-9b0c-8fc8385d142a','LNBP Femenil',true),
('876f1352-33dd-4be4-8a4e-3726b09597bd','Fuerza Regia Femenil','Mexico','6e594f35-8a5e-4cb7-9b0c-8fc8385d142a','LNBP Femenil',true),
('88dd1028-abae-4daa-a348-b3bcff67426c','Freseras de Irapuato','Mexico','6e594f35-8a5e-4cb7-9b0c-8fc8385d142a','LNBP Femenil',true),
('8a3a576a-524b-4267-8ca0-4ef3e02881cc','Colegio Los Leones Women','Chile','682f5612-be1e-420e-8eb0-877e92d88c91','Liga Nacional Femenina (Chile)',true),
('8c1c2e2d-3ed9-4896-9a88-4083409d7b8f','Correcaminos UAT Femenil','Mexico','6e594f35-8a5e-4cb7-9b0c-8fc8385d142a','LNBP Femenil',true),
('8d26dd71-7abf-4e67-b364-86c8786c7648','Sergio Ceppi Women','Chile','682f5612-be1e-420e-8eb0-877e92d88c91','Liga Nacional Femenina (Chile)',true),
('a98b6893-d29d-4972-961a-5848645c9653','Panteras de Aguascalientes Femenil','Mexico','6e594f35-8a5e-4cb7-9b0c-8fc8385d142a','LNBP Femenil',true),
('a9a93cdc-badc-4c0a-8af5-d9442f915b76','Boston College Women','Chile','682f5612-be1e-420e-8eb0-877e92d88c91','Liga Nacional Femenina (Chile)',true),
('b3d3967f-98ae-41c9-a3fa-8f3deb452ec8','Luis Matte Larraín Women','Chile','682f5612-be1e-420e-8eb0-877e92d88c91','Liga Nacional Femenina (Chile)',true),
('be4f57b9-382a-4608-b53e-ecaa6ba2441a','Azul y Rojo Women','Chile','682f5612-be1e-420e-8eb0-877e92d88c91','Liga Nacional Femenina (Chile)',true),
('d70d9399-058b-4601-900e-6f70d4dcfc19','Budućnost Bemax Women','Montenegro','bf301d70-8bf3-4650-8236-5d34bc6766e1','Serbian Women’s Basketball League',true),
('e316dfee-28fd-4e90-9e80-3cc18d7c2204','Santas del Potosí','Mexico','6e594f35-8a5e-4cb7-9b0c-8fc8385d142a','LNBP Femenil',true),
('ffdd8c62-e3de-47d1-a3cd-66661fabfc8f','Crvena zvezda Women','Serbia','bf301d70-8bf3-4650-8236-5d34bc6766e1','Serbian Women’s Basketball League',true);
insert into pg_temp.ld1_teams(id,name,country,league_id,league_name,basketball_type,active) values
('0916d9e0-af39-4bf6-889f-aafa94e560e2','Mitsubishi Electric Koalas','Japan',null,'Women''s Japan Basketball League (W League)','womens',true),
('349c4587-f8b9-4acc-b0d9-df8151b7bb68','Denso Iris','Japan',null,'FIBA Women’s Basketball League Asia 2026','womens',true),
('48a2a351-b469-4e02-8877-8902bb8c0945','Aisin Wings','Japan',null,'Women''s Japan Basketball League (W League)','womens',true),
('77ba4a45-ce2f-4557-bac7-e552626f63b3','Toyota Boshoku Sunshine Rabbits','Japan',null,'Women''s Japan Basketball League (W League)','womens',true),
('78f5980b-7a50-40c6-93e0-6bb76516dd2a','Toyota Antelopes','Japan',null,'Women''s Japan Basketball League (W League)','womens',true),
('81812618-1363-47f2-9596-dffb06fd82b7','Fujitsu Red Wave','Japan',null,'Women''s Japan Basketball League (W League)','womens',true),
('98790482-cff1-4f6e-8a35-0afe081d1e78','Chanson V-Magic','Japan',null,'Women''s Japan Basketball League (W League)','womens',true),
('a0b2c6d7-9254-4209-9493-58024207afc8','Yamanashi Queen Bees','Japan',null,'Women''s Japan Basketball League (W League)','womens',true),
('a41bc561-0f4b-4848-9558-f7157b096a83','Hitachi High-Tech Cougars','Japan',null,'Women''s Japan Basketball League (W League)','womens',true),
('fcb09422-a662-48c0-8cf3-189d690d10fc','ENEOS Sunflowers','Japan',null,'Women''s Japan Basketball League (W League)','womens',true);
insert into pg_temp.ld1_legacy_leagues(id,name,country,active) values
('1f56c6cc-05bb-4a66-991e-64b74b9499bc','Women''s Japan Basketball League (W League)','Japan',true),
('c76ff23e-b8f7-42c3-aa3f-5c37918a960e','FIBA Women’s Basketball League Asia 2026','Asia',true),
('fdd810a1-aea5-4438-9137-b95ea3e05cd0','Japan W League','Japan',true);
insert into pg_temp.ld1_legacy_teams(id,name,country,league_id,league_name,active) values
('0916d9e0-af39-4bf6-889f-aafa94e560e2','Mitsubishi Electric Koalas','Japan','1f56c6cc-05bb-4a66-991e-64b74b9499bc','Women''s Japan Basketball League (W League)',true),
('349c4587-f8b9-4acc-b0d9-df8151b7bb68','Denso Iris','Japan','c76ff23e-b8f7-42c3-aa3f-5c37918a960e','FIBA Women’s Basketball League Asia 2026',true),
('48a2a351-b469-4e02-8877-8902bb8c0945','Aisin Wings','Japan','1f56c6cc-05bb-4a66-991e-64b74b9499bc','Women''s Japan Basketball League (W League)',true),
('77ba4a45-ce2f-4557-bac7-e552626f63b3','Toyota Boshoku Sunshine Rabbits','Japan','1f56c6cc-05bb-4a66-991e-64b74b9499bc','Women''s Japan Basketball League (W League)',true),
('78f5980b-7a50-40c6-93e0-6bb76516dd2a','Toyota Antelopes','Japan','1f56c6cc-05bb-4a66-991e-64b74b9499bc','Women''s Japan Basketball League (W League)',true),
('81812618-1363-47f2-9596-dffb06fd82b7','Fujitsu Red Wave','Japan','1f56c6cc-05bb-4a66-991e-64b74b9499bc','Women''s Japan Basketball League (W League)',true),
('98790482-cff1-4f6e-8a35-0afe081d1e78','Chanson V-Magic','Japan','1f56c6cc-05bb-4a66-991e-64b74b9499bc','Women''s Japan Basketball League (W League)',true),
('a0b2c6d7-9254-4209-9493-58024207afc8','Yamanashi Queen Bees','Japan','1f56c6cc-05bb-4a66-991e-64b74b9499bc','Women''s Japan Basketball League (W League)',true),
('a41bc561-0f4b-4848-9558-f7157b096a83','Hitachi High-Tech Cougars','Japan','1f56c6cc-05bb-4a66-991e-64b74b9499bc','Women''s Japan Basketball League (W League)',true),
('fcb09422-a662-48c0-8cf3-189d690d10fc','ENEOS Sunflowers','Japan','1f56c6cc-05bb-4a66-991e-64b74b9499bc','Women''s Japan Basketball League (W League)',true);
create temporary table before_ld1_leagues on commit drop as select * from pg_temp.ld1_leagues;
create temporary table before_ld1_teams on commit drop as select * from pg_temp.ld1_teams;
create temporary table before_ld1_memberships on commit drop as select * from pg_temp.ld1_memberships;
create temporary table before_ld1_legacy_leagues on commit drop as select * from pg_temp.ld1_legacy_leagues;
create temporary table before_ld1_legacy_teams on commit drop as select * from pg_temp.ld1_legacy_teams;
\ir ../../reports/league-data-1/directory-shadow-corrections.sql
\ir ../../reports/league-data-1/kosovo-shadow-correction.sql
\ir ../../reports/league-data-1/iceland-womens-shadow-expansion.sql
\ir ../../reports/league-data-1/iceland-womens-legacy-shadow.sql
\ir ../../reports/league-data-1/iceland-mens-shadow-correction.sql
\ir ../../reports/league-data-1/portugal-shadow-correction.sql
\ir ../../reports/league-data-1/euroleague-shadow-memberships.sql
\ir ../../reports/league-data-1/finland-poland-shadow-memberships.sql
\ir ../../reports/league-data-1/austria-shadow-memberships.sql
\ir ../../reports/league-data-1/italy-serie-b-shadow-correction.sql
\ir ../../reports/league-data-1/wnba-shadow-correction.sql
\ir ../../reports/league-data-1/brazil-poland-womens-shadow-correction.sql
\ir ../../reports/league-data-1/argentina-womens-shadow-correction.sql
\ir ../../reports/league-data-1/chile-mexico-romania-serbia-womens-shadow-correction.sql
\ir ../../reports/league-data-1/poland-romania-womens-legacy-shadow.sql
\ir ../../reports/league-data-1/japan-wleague-shadow-correction.sql
create temporary table after_ld1_leagues on commit drop as select * from pg_temp.ld1_leagues;
create temporary table after_ld1_teams on commit drop as select * from pg_temp.ld1_teams;
create temporary table after_ld1_memberships on commit drop as select * from pg_temp.ld1_memberships;
create temporary table after_ld1_legacy_leagues on commit drop as select * from pg_temp.ld1_legacy_leagues;
create temporary table after_ld1_legacy_teams on commit drop as select * from pg_temp.ld1_legacy_teams;
\ir ../../reports/league-data-1/directory-shadow-corrections.sql
\ir ../../reports/league-data-1/kosovo-shadow-correction.sql
\ir ../../reports/league-data-1/iceland-womens-shadow-expansion.sql
\ir ../../reports/league-data-1/iceland-womens-legacy-shadow.sql
\ir ../../reports/league-data-1/iceland-mens-shadow-correction.sql
\ir ../../reports/league-data-1/portugal-shadow-correction.sql
\ir ../../reports/league-data-1/euroleague-shadow-memberships.sql
\ir ../../reports/league-data-1/finland-poland-shadow-memberships.sql
\ir ../../reports/league-data-1/austria-shadow-memberships.sql
\ir ../../reports/league-data-1/italy-serie-b-shadow-correction.sql
\ir ../../reports/league-data-1/wnba-shadow-correction.sql
\ir ../../reports/league-data-1/brazil-poland-womens-shadow-correction.sql
\ir ../../reports/league-data-1/argentina-womens-shadow-correction.sql
\ir ../../reports/league-data-1/chile-mexico-romania-serbia-womens-shadow-correction.sql
\ir ../../reports/league-data-1/poland-romania-womens-legacy-shadow.sql
\ir ../../reports/league-data-1/japan-wleague-shadow-correction.sql
do $combined$ begin
if (select count(*) from pg_temp.ld1_leagues)<>(select count(*)+16 from pg_temp.before_ld1_leagues) then raise exception 'ld1_leagues: unexpected delta';end if;
if exists(select * from pg_temp.after_ld1_leagues except select * from pg_temp.ld1_leagues) or exists(select * from pg_temp.ld1_leagues except select * from pg_temp.after_ld1_leagues) then raise exception 'ld1_leagues: second run changed state';end if;
if exists(select id from pg_temp.before_ld1_leagues except select id from pg_temp.ld1_leagues) then raise exception 'ld1_leagues: lost existing ID';end if;
if (select count(*) from pg_temp.ld1_teams)<>(select count(*)+27 from pg_temp.before_ld1_teams) then raise exception 'ld1_teams: unexpected delta';end if;
if exists(select * from pg_temp.after_ld1_teams except select * from pg_temp.ld1_teams) or exists(select * from pg_temp.ld1_teams except select * from pg_temp.after_ld1_teams) then raise exception 'ld1_teams: second run changed state';end if;
if exists(select id from pg_temp.before_ld1_teams except select id from pg_temp.ld1_teams) then raise exception 'ld1_teams: lost existing ID';end if;
if (select count(*) from pg_temp.ld1_memberships)<>(select count(*)+295 from pg_temp.before_ld1_memberships) then raise exception 'ld1_memberships: unexpected delta';end if;
if exists(select * from pg_temp.after_ld1_memberships except select * from pg_temp.ld1_memberships) or exists(select * from pg_temp.ld1_memberships except select * from pg_temp.after_ld1_memberships) then raise exception 'ld1_memberships: second run changed state';end if;
if exists(select id from pg_temp.before_ld1_memberships except select id from pg_temp.ld1_memberships) then raise exception 'ld1_memberships: lost existing ID';end if;
if (select count(*) from pg_temp.ld1_legacy_leagues)<>(select count(*)+1 from pg_temp.before_ld1_legacy_leagues) then raise exception 'ld1_legacy_leagues: unexpected delta';end if;
if exists(select * from pg_temp.after_ld1_legacy_leagues except select * from pg_temp.ld1_legacy_leagues) or exists(select * from pg_temp.ld1_legacy_leagues except select * from pg_temp.after_ld1_legacy_leagues) then raise exception 'ld1_legacy_leagues: second run changed state';end if;
if exists(select id from pg_temp.before_ld1_legacy_leagues except select id from pg_temp.ld1_legacy_leagues) then raise exception 'ld1_legacy_leagues: lost existing ID';end if;
if (select count(*) from pg_temp.ld1_legacy_teams)<>(select count(*)+39 from pg_temp.before_ld1_legacy_teams) then raise exception 'ld1_legacy_teams: unexpected delta';end if;
if exists(select * from pg_temp.after_ld1_legacy_teams except select * from pg_temp.ld1_legacy_teams) or exists(select * from pg_temp.ld1_legacy_teams except select * from pg_temp.after_ld1_legacy_teams) then raise exception 'ld1_legacy_teams: second run changed state';end if;
if exists(select id from pg_temp.before_ld1_legacy_teams except select id from pg_temp.ld1_legacy_teams) then raise exception 'ld1_legacy_teams: lost existing ID';end if;
if exists(select 1 from pg_temp.before_ld1_leagues b join pg_temp.ld1_leagues a using(id) where (b.name,b.country,b.basketball_type,b.active) is distinct from (a.name,a.country,a.basketball_type,a.active) or (b.season is distinct from a.season and not (b.id='5114c521-cf4b-4ed4-a0f1-b9f0a8275597' and b.season is null and a.season='2026-27'))) then raise exception 'ld1_leagues: unexpected existing record change';end if;
if exists(select * from pg_temp.before_ld1_memberships except select * from pg_temp.ld1_memberships) then raise exception 'ld1_memberships: existing record changed';end if;
if exists(select * from pg_temp.before_ld1_legacy_leagues except select * from pg_temp.ld1_legacy_leagues) then raise exception 'ld1_legacy_leagues: existing record changed';end if;
if exists(select * from pg_temp.before_ld1_legacy_teams except select * from pg_temp.ld1_legacy_teams) then raise exception 'ld1_legacy_teams: existing record changed';end if;
if (select count(*) from (select * from pg_temp.before_ld1_teams except select * from pg_temp.ld1_teams) q)<>148 then raise exception 'unexpected existing team changes';end if;
if exists(select 1 from pg_temp.before_ld1_teams b join pg_temp.ld1_teams a using(id) where (b.name,b.country,b.basketball_type,b.active) is distinct from (a.name,a.country,a.basketball_type,a.active)) then raise exception 'team identity altered';end if;
end $combined$;
select 'PASS: combined league data correction, twice applied, original identities and historical records preserved' result;
rollback;
