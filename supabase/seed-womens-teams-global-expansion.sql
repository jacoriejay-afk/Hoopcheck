-- Idempotent expansion of the global women's professional basketball directory.
-- Safe to run more than once: existing team/league names are left untouched.
begin;

insert into public.womens_leagues (name,country,level,active)
select v.name,v.country,v.level,true
from (values
 ('Women''s National Basketball Association (WNBA)','United States','Professional · North American first division'),
 ('Women''s Korean Basketball League (WKBL)','South Korea','Professional · National first division'),
 ('Women''s Japan Basketball League (W League)','Japan','Professional · National first division')
) as v(name,country,level)
where not exists (
  select 1 from public.womens_leagues l
  where lower(l.name)=lower(v.name) and lower(l.country)=lower(v.country)
);

with additions(name,country,city,league_name) as (
 values
 ('Atlanta Dream','United States','Atlanta','Women''s National Basketball Association (WNBA)'),
 ('Chicago Sky','United States','Chicago','Women''s National Basketball Association (WNBA)'),
 ('Connecticut Sun','United States','Uncasville','Women''s National Basketball Association (WNBA)'),
 ('Dallas Wings','United States','Dallas','Women''s National Basketball Association (WNBA)'),
 ('Golden State Valkyries','United States','San Francisco','Women''s National Basketball Association (WNBA)'),
 ('Indiana Fever','United States','Indianapolis','Women''s National Basketball Association (WNBA)'),
 ('Las Vegas Aces','United States','Las Vegas','Women''s National Basketball Association (WNBA)'),
 ('Los Angeles Sparks','United States','Los Angeles','Women''s National Basketball Association (WNBA)'),
 ('Minnesota Lynx','United States','Minneapolis','Women''s National Basketball Association (WNBA)'),
 ('New York Liberty','United States','Brooklyn','Women''s National Basketball Association (WNBA)'),
 ('Phoenix Mercury','United States','Phoenix','Women''s National Basketball Association (WNBA)'),
 ('Seattle Storm','United States','Seattle','Women''s National Basketball Association (WNBA)'),
 ('Washington Mystics','United States','Washington','Women''s National Basketball Association (WNBA)'),
 ('Toronto Tempo','Canada','Toronto','Women''s National Basketball Association (WNBA)'),
 ('Portland Fire','United States','Portland','Women''s National Basketball Association (WNBA)'),
 ('Samsung Life Blue Minx','South Korea','Yongin','Women''s Korean Basketball League (WKBL)'),
 ('Woori Bank Woori WON','South Korea','Asan','Women''s Korean Basketball League (WKBL)'),
 ('Shinhan Bank S-Birds','South Korea','Incheon','Women''s Korean Basketball League (WKBL)'),
 ('Hana Bank','South Korea','Bucheon','Women''s Korean Basketball League (WKBL)'),
 ('BNK Sum','South Korea','Busan','Women''s Korean Basketball League (WKBL)'),
 ('Toyota Antelopes','Japan','Toyota','Women''s Japan Basketball League (W League)'),
 ('Fujitsu Red Wave','Japan','Kawasaki','Women''s Japan Basketball League (W League)'),
 ('ENEOS Sunflowers','Japan','Kashiwa','Women''s Japan Basketball League (W League)'),
 ('Chanson V-Magic','Japan','Shizuoka','Women''s Japan Basketball League (W League)'),
 ('Mitsubishi Electric Koalas','Japan','Nagoya','Women''s Japan Basketball League (W League)'),
 ('Hitachi High-Tech Cougars','Japan','Hitachinaka','Women''s Japan Basketball League (W League)'),
 ('Toyota Boshoku Sunshine Rabbits','Japan','Kariya','Women''s Japan Basketball League (W League)'),
 ('Aisin Wings','Japan','Anjo','Women''s Japan Basketball League (W League)'),
 ('Yamanashi Queen Bees','Japan','Kofu','Women''s Japan Basketball League (W League)')
)
insert into public.womens_teams(name,country,city,league_id,league_name,active)
select a.name,a.country,a.city,l.id,a.league_name,true
from additions a
left join public.womens_leagues l on lower(l.name)=lower(a.league_name) and l.active=true
where not exists (
  select 1 from public.womens_teams existing
  where lower(existing.name)=lower(a.name)
    and lower(coalesce(existing.country,''))=lower(a.country)
);

commit;
