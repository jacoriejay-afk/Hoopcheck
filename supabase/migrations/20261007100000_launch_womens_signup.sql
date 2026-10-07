-- HoopCheck launch checklist: women directory expansion + signup demographics
update public.womens_leagues set active=false where lower(name)='wnba';
update public.womens_teams set active=false where lower(league_name)='wnba';

insert into public.womens_leagues(name,country,level,active)
select v.name,v.country,v.level,true from (values
('Italian Serie A1 Women','Italy','Professional'),('Polish Women’s Basketball League','Poland','Professional'),
('Czech Women’s Basketball League','Czechia','Professional'),('Belgian Women’s Basketball League','Belgium','Professional'),
('Greek Women’s Basket League','Greece','Professional'),('Portugal Women’s Basketball League','Portugal','Professional'),
('Hungarian Women’s NB I/A','Hungary','Professional'),('Romanian Women’s Basketball League','Romania','Professional'),
('Serbian Women’s Basketball League','Serbia','Professional'),('Croatian Women’s Basketball League','Croatia','Professional'),
('Slovak Women’s Basketball League','Slovakia','Professional'),('Slovenian Women’s Basketball League','Slovenia','Professional'),
('Swedish Basketligan Dam','Sweden','Professional'),('Finnish Women’s Korisliiga','Finland','Professional'),
('Danish Kvindebasketligaen','Denmark','Professional'),('Norwegian Women’s Basketball League','Norway','Professional'),
('Brazilian LBF','Brazil','Professional'),('Argentina Women’s Basketball League','Argentina','Professional'),
('Japan W League','Japan','Professional'),('Korean Women’s Basketball League','South Korea','Professional'),
('Chinese Women’s Basketball Association','China','Professional')
) v(name,country,level)
where not exists(select 1 from public.womens_leagues l where lower(l.name)=lower(v.name));

insert into public.womens_teams(name,country,city,league_id,active,league_name)
select v.team,v.country,v.city,l.id,true,l.name from (values
('Famila Schio','Italy','Schio','Italian Serie A1 Women'),('Reyer Venezia Women','Italy','Venice','Italian Serie A1 Women'),
('Virtus Bologna Women','Italy','Bologna','Italian Serie A1 Women'),('ASD GEAS Basket','Italy','Sesto San Giovanni','Italian Serie A1 Women'),
('Bourges Basket Women','France','Bourges','Ligue Féminine de Basketball'),('Basket Landes Women','France','Landes','Ligue Féminine de Basketball'),
('Villeneuve-d’Ascq ESB Lille Metropole Women','France','Villeneuve-d’Ascq','Ligue Féminine de Basketball'),
('Mersin Women','Türkiye','Mersin','Turkish Women’s Basketball Super League'),('Galatasaray Women','Türkiye','Istanbul','Turkish Women’s Basketball Super League'),
('Çukurova Basketbol Women','Türkiye','Mersin','Turkish Women’s Basketball Super League'),('ZVVZ USK Praha Women','Czechia','Prague','Czech Women’s Basketball League'),
('BK Brno Women','Czechia','Brno','Czech Women’s Basketball League'),('Polkowice Women','Poland','Polkowice','Polish Women’s Basketball League'),
('AZS UMCS Lublin Women','Poland','Lublin','Polish Women’s Basketball League'),('Arka Gdynia Women','Poland','Gdynia','Polish Women’s Basketball League'),
('Olympiacos Women','Greece','Piraeus','Greek Women’s Basket League'),('Panathinaikos Women','Greece','Athens','Greek Women’s Basket League'),
('Sporting CP Women','Portugal','Lisbon','Portugal Women’s Basketball League'),('Benfica Women','Portugal','Lisbon','Portugal Women’s Basketball League'),
('União Sportiva Women','Portugal','Ponta Delgada','Portugal Women’s Basketball League'),('DVTK HUN-Therm','Hungary','Miskolc','Hungarian Women’s NB I/A'),
('Sopron Basket','Hungary','Sopron','Hungarian Women’s NB I/A'),('Sepsi-SIC Women','Romania','Sfântu Gheorghe','Romanian Women’s Basketball League'),
('CSM Târgoviște Women','Romania','Târgoviște','Romanian Women’s Basketball League'),('Crvena zvezda Women','Serbia','Belgrade','Serbian Women’s Basketball League'),
('Partizan Women','Serbia','Belgrade','Serbian Women’s Basketball League'),('ŽKK Ragusa','Croatia','Dubrovnik','Croatian Women’s Basketball League'),
('ŽKK Trešnjevka 2009','Croatia','Zagreb','Croatian Women’s Basketball League'),('Pieštanské Čajky Women','Slovakia','Piešťany','Slovak Women’s Basketball League'),
('Cinkarna Celje Women','Slovenia','Celje','Slovenian Women’s Basketball League'),('A3 Basket Umeå Women','Sweden','Umeå','Swedish Basketligan Dam'),
('Luleå Basket Women','Sweden','Luleå','Swedish Basketligan Dam'),('Peli-Karhut Women','Finland','Kauhajoki','Finnish Women’s Korisliiga'),
('Helsinki Basketball Academy Women','Finland','Helsinki','Finnish Women’s Korisliiga'),('BK Amager Women','Denmark','Copenhagen','Danish Kvindebasketligaen'),
('Horsens Women','Denmark','Horsens','Danish Kvindebasketligaen'),('Sampaio Basquete','Brazil','São Luís','Brazilian LBF'),
('Corinthians Basquete Feminino','Brazil','São Paulo','Brazilian LBF'),('Avenida Women','Spain','Salamanca','Liga Femenina Endesa'),
('Casademont Zaragoza Women','Spain','Zaragoza','Liga Femenina Endesa'),('Beşiktaş Women','Türkiye','Istanbul','Turkish Women’s Basketball Super League'),
('Emlak Konut Women','Türkiye','Istanbul','Turkish Women’s Basketball Super League')
) v(team,country,city,league_name)
join public.womens_leagues l on lower(l.name)=lower(v.league_name)
where not exists(select 1 from public.womens_teams t where lower(t.name)=lower(v.team) and lower(coalesce(t.country,''))=lower(coalesce(v.country,'')));

alter table public.profiles add column if not exists birthdate date;
alter table public.profiles add column if not exists gender text;
alter table public.profiles drop constraint if exists profiles_gender_check;
alter table public.profiles add constraint profiles_gender_check check(gender is null or gender in ('male','female','non_binary','prefer_not_to_say'));

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $function$
begin
  if nullif(new.raw_user_meta_data->>'birthdate','') is null then raise exception 'Birthdate is required'; end if;
  if (new.raw_user_meta_data->>'birthdate')::date > (current_date - interval '18 years')::date then raise exception 'You must be 18 or older'; end if;
  if coalesce(new.raw_user_meta_data->>'gender','') not in ('male','female','non_binary','prefer_not_to_say') then raise exception 'Gender is required'; end if;
  insert into public.profiles(id,display_name,username,account_type,position,years_pro,professional_experience,is_adult,agreed_to_terms,terms_accepted_at,terms_version,birthdate,gender)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)),lower(nullif(new.raw_user_meta_data->>'username','')),
    coalesce(new.raw_user_meta_data->>'account_type','player'),
    case when new.raw_user_meta_data->>'account_type'='player' then new.raw_user_meta_data->>'position' else null end,
    case when new.raw_user_meta_data->>'account_type'='player' then (new.raw_user_meta_data->>'years_pro')::integer else null end,
    coalesce((new.raw_user_meta_data->>'professional_experience')::boolean,false),true,
    coalesce((new.raw_user_meta_data->>'agreed_to_terms')::boolean,false),
    case when new.raw_user_meta_data->>'terms_accepted_at' is not null then (new.raw_user_meta_data->>'terms_accepted_at')::timestamptz else null end,
    new.raw_user_meta_data->>'terms_version',(new.raw_user_meta_data->>'birthdate')::date,new.raw_user_meta_data->>'gender');
  return new;
end; $function$;