-- Current Austrian men's professional teams for the 2026-27 season.
-- Source: Basketball Austria official 2026-27 BSL/B2L competition information.

update public.leagues
set active=false
where country='Austria' and lower(name)='austria superleague';

update public.teams
set active=false
where country='Austria' and lower(league_name)='austria superleague';

update public.teams
set league_name='Basketball Superliga',
    league_id=(select id from public.leagues where country='Austria' and name='Basketball Superliga' and active=true limit 1)
where country='Austria'
  and active=true
  and lower(name) in (
    'bc vienna','kapfenberg bulls','oberwart gunners','swans gmunden',
    'traiskirchen lions','ubsc graz'
  );

update public.teams
set name=case lower(name)
  when 'kapfenberg bulls' then 'HEFTE HELFEN Bulls Kapfenberg'
  when 'oberwart gunners' then 'UNGER STEEL Gunners Oberwart'
  when 'swans gmunden' then 'Raiffeisen Swans Gmunden'
  when 'traiskirchen lions' then 'druck.at Traiskirchen Lions'
  when 'ubsc graz' then 'Eagles Raiffeisen UBSC Graz'
  else name
end
where country='Austria' and active=true and lower(name) in (
  'kapfenberg bulls','oberwart gunners','swans gmunden','traiskirchen lions','ubsc graz'
);

insert into public.leagues (name,country,level,season,active,source)
select 'Basketball Zweite Liga','Austria','Second Division','2026-27',true,'Basketball Austria'
where not exists (
  select 1 from public.leagues where country='Austria' and name='Basketball Zweite Liga' and season='2026-27'
);

do $$
declare
  bsl_id uuid;
  b2l_id uuid;
begin
  select id into bsl_id from public.leagues where country='Austria' and name='Basketball Superliga' and active=true order by created_at desc limit 1;
  select id into b2l_id from public.leagues where country='Austria' and name='Basketball Zweite Liga' and active=true order by created_at desc limit 1;

  insert into public.teams(name,country,league_name,league_id,active,source)
  select v.name,'Austria','Basketball Superliga',bsl_id,true,'Basketball Austria'
  from (values
    ('COLDAMARIS BBC Nord Dragonz'),
    ('SKN St. Pölten Basketball'),
    ('BK Karbon-X Dukes'),
    ('Raiffeisen Flyers Wels'),
    ('Pirlo Kufstein Towers')
  ) v(name)
  where not exists (
    select 1 from public.teams t
    where t.country='Austria' and t.name=v.name and t.active=true
  );

  insert into public.teams(name,country,league_name,league_id,active,source)
  select v.name,'Austria','Basketball Zweite Liga',b2l_id,true,'Basketball Austria'
  from (values
    ('Union Deutsch Wagram Alligators'),
    ('UKJ Mistelbach Mustangs'),
    ('Vienna United'),
    ('Raiffeisen Mattersburg Rocks'),
    ('Basketball Klub Rapid Wien'),
    ('Vienna Timberwolves'),
    ('Future Team Steiermark'),
    ('Upper Austrian Ballers'),
    ('BBU Salzburg'),
    ('Haustechnik Güssing Blackbirds'),
    ('Wörthersee Piraten'),
    ('SWARCO Raiders Tirol'),
    ('POLFIN KOŠ Celovec'),
    ('Safare Traiskirchen Lions NexGen'),
    ('ASKÖ Radenthein Garnets')
  ) v(name)
  where not exists (
    select 1 from public.teams t
    where t.country='Austria' and t.name=v.name and t.active=true
  );
end $$;
