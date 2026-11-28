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
do $combined$ begin
if (select count(*) from pg_temp.ld1_leagues)<>(select count(*)+5 from pg_temp.before_ld1_leagues) then raise exception 'ld1_leagues: unexpected delta';end if;
if exists(select * from pg_temp.after_ld1_leagues except select * from pg_temp.ld1_leagues) or exists(select * from pg_temp.ld1_leagues except select * from pg_temp.after_ld1_leagues) then raise exception 'ld1_leagues: second run changed state';end if;
if exists(select id from pg_temp.before_ld1_leagues except select id from pg_temp.ld1_leagues) then raise exception 'ld1_leagues: lost existing ID';end if;
if (select count(*) from pg_temp.ld1_teams)<>(select count(*)+22 from pg_temp.before_ld1_teams) then raise exception 'ld1_teams: unexpected delta';end if;
if exists(select * from pg_temp.after_ld1_teams except select * from pg_temp.ld1_teams) or exists(select * from pg_temp.ld1_teams except select * from pg_temp.after_ld1_teams) then raise exception 'ld1_teams: second run changed state';end if;
if exists(select id from pg_temp.before_ld1_teams except select id from pg_temp.ld1_teams) then raise exception 'ld1_teams: lost existing ID';end if;
if (select count(*) from pg_temp.ld1_memberships)<>(select count(*)+94 from pg_temp.before_ld1_memberships) then raise exception 'ld1_memberships: unexpected delta';end if;
if exists(select * from pg_temp.after_ld1_memberships except select * from pg_temp.ld1_memberships) or exists(select * from pg_temp.ld1_memberships except select * from pg_temp.after_ld1_memberships) then raise exception 'ld1_memberships: second run changed state';end if;
if exists(select id from pg_temp.before_ld1_memberships except select id from pg_temp.ld1_memberships) then raise exception 'ld1_memberships: lost existing ID';end if;
if (select count(*) from pg_temp.ld1_legacy_leagues)<>(select count(*)+1 from pg_temp.before_ld1_legacy_leagues) then raise exception 'ld1_legacy_leagues: unexpected delta';end if;
if exists(select * from pg_temp.after_ld1_legacy_leagues except select * from pg_temp.ld1_legacy_leagues) or exists(select * from pg_temp.ld1_legacy_leagues except select * from pg_temp.after_ld1_legacy_leagues) then raise exception 'ld1_legacy_leagues: second run changed state';end if;
if exists(select id from pg_temp.before_ld1_legacy_leagues except select id from pg_temp.ld1_legacy_leagues) then raise exception 'ld1_legacy_leagues: lost existing ID';end if;
if (select count(*) from pg_temp.ld1_legacy_teams)<>(select count(*)+19 from pg_temp.before_ld1_legacy_teams) then raise exception 'ld1_legacy_teams: unexpected delta';end if;
if exists(select * from pg_temp.after_ld1_legacy_teams except select * from pg_temp.ld1_legacy_teams) or exists(select * from pg_temp.ld1_legacy_teams except select * from pg_temp.after_ld1_legacy_teams) then raise exception 'ld1_legacy_teams: second run changed state';end if;
if exists(select id from pg_temp.before_ld1_legacy_teams except select id from pg_temp.ld1_legacy_teams) then raise exception 'ld1_legacy_teams: lost existing ID';end if;
if exists(select 1 from pg_temp.before_ld1_leagues b join pg_temp.ld1_leagues a using(id) where (b.name,b.country,b.basketball_type,b.active) is distinct from (a.name,a.country,a.basketball_type,a.active) or (b.season is distinct from a.season and not (b.id='5114c521-cf4b-4ed4-a0f1-b9f0a8275597' and b.season is null and a.season='2026-27'))) then raise exception 'ld1_leagues: unexpected existing record change';end if;
if exists(select * from pg_temp.before_ld1_memberships except select * from pg_temp.ld1_memberships) then raise exception 'ld1_memberships: existing record changed';end if;
if exists(select * from pg_temp.before_ld1_legacy_leagues except select * from pg_temp.ld1_legacy_leagues) then raise exception 'ld1_legacy_leagues: existing record changed';end if;
if exists(select * from pg_temp.before_ld1_legacy_teams except select * from pg_temp.ld1_legacy_teams) then raise exception 'ld1_legacy_teams: existing record changed';end if;
if (select count(*) from (select * from pg_temp.before_ld1_teams except select * from pg_temp.ld1_teams) q)<>6 then raise exception 'unexpected existing team changes';end if;
if exists(select 1 from pg_temp.before_ld1_teams b join pg_temp.ld1_teams a using(id) where (b.name,b.country,b.basketball_type,b.active) is distinct from (a.name,a.country,a.basketball_type,a.active)) then raise exception 'team identity altered';end if;
end $combined$;
select 'PASS: combined league data correction, twice applied, original identities and historical records preserved' result;
rollback;
