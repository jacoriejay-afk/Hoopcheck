-- Official WJBL 2026-27 teams: https://www.wjbl.org/team/?bid=12
-- Promotion/relegation: https://www2.wjbl.org/topics/detail.html?id=4218
-- Canonical two-tier structure, existing legacy league and Denso Asia association untouched.
-- Only temporary directory writes; no real schema or production mutation.
do $japan$
declare c record; l record;
begin
 if not exists(select 1 from pg_temp.ld1_legacy_leagues where id='1f56c6cc-05bb-4a66-991e-64b74b9499bc' and name='Women''s Japan Basketball League (W League)' and country='Japan' and active)
 or exists(select 1 from pg_temp.ld1_leagues where country='Japan' and basketball_type='womens' and id not in ('f1112027-289a-51c3-8520-000000000001','f1112027-289a-51c3-8520-000000000002'))
 then raise exception 'Japan league identity changed';end if;
 for l in select * from (values ('f1112027-289a-51c3-8520-000000000001'::uuid,'W League Premier',8),('f1112027-289a-51c3-8520-000000000002'::uuid,'W League Future',7)) x(id,name,n) loop
  if exists(select 1 from pg_temp.ld1_leagues where id=l.id and (name is distinct from l.name or country is distinct from 'Japan' or season is distinct from '2026-27' or basketball_type is distinct from 'womens' or active is not true)) then raise exception 'Japan league ID collision';end if;
  insert into pg_temp.ld1_leagues(id,name,country,season,basketball_type,active) values(l.id,l.name,'Japan','2026-27','womens',true) on conflict(id) do nothing;
 end loop;
 for c in select * from (values
('349c4587-f8b9-4acc-b0d9-df8151b7bb68'::uuid,'Denso Iris','f1112027-289a-51c3-8520-000000000001'::uuid,'W League Premier',true,'FIBA Women’s Basketball League Asia 2026'::text),
('78f5980b-7a50-40c6-93e0-6bb76516dd2a'::uuid,'Toyota Antelopes','f1112027-289a-51c3-8520-000000000001'::uuid,'W League Premier',true,'Women''s Japan Basketball League (W League)'::text),
('81812618-1363-47f2-9596-dffb06fd82b7'::uuid,'Fujitsu Red Wave','f1112027-289a-51c3-8520-000000000001'::uuid,'W League Premier',true,'Women''s Japan Basketball League (W League)'::text),
('77ba4a45-ce2f-4557-bac7-e552626f63b3'::uuid,'Toyota Boshoku Sunshine Rabbits','f1112027-289a-51c3-8520-000000000001'::uuid,'W League Premier',true,'Women''s Japan Basketball League (W League)'::text),
('fcb09422-a662-48c0-8cf3-189d690d10fc'::uuid,'ENEOS Sunflowers','f1112027-289a-51c3-8520-000000000001'::uuid,'W League Premier',true,'Women''s Japan Basketball League (W League)'::text),
('98790482-cff1-4f6e-8a35-0afe081d1e78'::uuid,'Chanson V-Magic','f1112027-289a-51c3-8520-000000000001'::uuid,'W League Premier',true,'Women''s Japan Basketball League (W League)'::text),
('48a2a351-b469-4e02-8877-8902bb8c0945'::uuid,'Aisin Wings','f1112027-289a-51c3-8520-000000000001'::uuid,'W League Premier',true,'Women''s Japan Basketball League (W League)'::text),
('a41bc561-0f4b-4848-9558-f7157b096a83'::uuid,'Hitachi High-Tech Cougars','f1112027-289a-51c3-8520-000000000001'::uuid,'W League Premier',true,'Women''s Japan Basketball League (W League)'::text),
('f1112027-289a-51c3-8521-000000000001'::uuid,'Tokyo Haneda Vickies','f1112027-289a-51c3-8520-000000000002'::uuid,'W League Future',false,null::text),
('a0b2c6d7-9254-4209-9493-58024207afc8'::uuid,'Yamanashi Queen Bees','f1112027-289a-51c3-8520-000000000002'::uuid,'W League Future',true,'Women''s Japan Basketball League (W League)'::text),
('f1112027-289a-51c3-8521-000000000002'::uuid,'Prestige International Aranmare','f1112027-289a-51c3-8520-000000000002'::uuid,'W League Future',false,null::text),
('0916d9e0-af39-4bf6-889f-aafa94e560e2'::uuid,'Mitsubishi Electric Koalas','f1112027-289a-51c3-8520-000000000002'::uuid,'W League Future',true,'Women''s Japan Basketball League (W League)'::text),
('f1112027-289a-51c3-8521-000000000003'::uuid,'SMBC Tokyo Solua','f1112027-289a-51c3-8520-000000000002'::uuid,'W League Future',false,null::text),
('f1112027-289a-51c3-8521-000000000004'::uuid,'Hiroshima Egrets','f1112027-289a-51c3-8520-000000000002'::uuid,'W League Future',false,null::text),
('f1112027-289a-51c3-8521-000000000005'::uuid,'Niigata Albirex BB Rabbits','f1112027-289a-51c3-8520-000000000002'::uuid,'W League Future',false,null::text)
 ) x(id,name,lid,label,existing,old_label) loop
  if c.existing then
   if not exists(select 1 from pg_temp.ld1_teams where id=c.id and name=c.name and country='Japan' and basketball_type='womens' and active and ((league_id is null and league_name is not distinct from c.old_label) or (league_id=c.lid and league_name=c.label)))
   or not exists(select 1 from pg_temp.ld1_legacy_teams where id=c.id and name=c.name and country='Japan' and active) then raise exception 'Japan existing club changed: %',c.id;end if;
   update pg_temp.ld1_teams set league_id=c.lid,league_name=c.label where id=c.id and league_id is null;
  else
   if exists(select 1 from pg_temp.ld1_teams where id=c.id and (name is distinct from c.name or country is distinct from 'Japan' or league_id is distinct from c.lid or league_name is distinct from c.label or basketball_type is distinct from 'womens' or active is not true))
   or exists(select 1 from pg_temp.ld1_teams where id<>c.id and country='Japan' and basketball_type='womens' and lower(name)=lower(c.name))
   or exists(select 1 from pg_temp.ld1_legacy_teams where id=c.id and (name is distinct from c.name or country is distinct from 'Japan' or league_id is distinct from '1f56c6cc-05bb-4a66-991e-64b74b9499bc'::uuid or active is not true))
   or exists(select 1 from pg_temp.ld1_legacy_teams where id<>c.id and country='Japan' and lower(name)=lower(c.name)) then raise exception 'Japan new club identity collision: %',c.id;end if;
   insert into pg_temp.ld1_teams(id,name,country,league_id,league_name,basketball_type,active) values(c.id,c.name,'Japan',c.lid,c.label,'womens',true) on conflict(id) do nothing;
   insert into pg_temp.ld1_legacy_teams(id,name,country,league_id,league_name,active) values(c.id,c.name,'Japan','1f56c6cc-05bb-4a66-991e-64b74b9499bc','Women''s Japan Basketball League (W League)',true) on conflict(id) do nothing;
  end if;
  if exists(select 1 from pg_temp.ld1_memberships where team_id=c.id and league_id=c.lid and season='2026-27' and active is not true) then raise exception 'Japan inactive membership conflict';end if;
  insert into pg_temp.ld1_memberships(id,team_id,league_id,season,active) values(gen_random_uuid(),c.id,c.lid,'2026-27',true) on conflict(team_id,league_id,season) do nothing;
 end loop;
 for l in select * from (values ('f1112027-289a-51c3-8520-000000000001'::uuid,8),('f1112027-289a-51c3-8520-000000000002'::uuid,7)) x(id,n) loop
 if (select count(*) from pg_temp.ld1_teams where league_id=l.id and active)<>l.n or (select count(*) from pg_temp.ld1_memberships where league_id=l.id and season='2026-27' and active)<>l.n then raise exception 'Japan division roster mismatch';end if;
 end loop;
end $japan$;
