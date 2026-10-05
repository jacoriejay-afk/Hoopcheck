-- Phase 6 identity, anonymous reviews, opt-in following, onboarding affiliations, and expanded divisions
alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists professional_experience boolean not null default false;

alter table public.reviews add column if not exists is_anonymous boolean not null default false;

update public.profiles
set first_name = nullif(split_part(trim(display_name), ' ', 1), ''),
    last_name = case when position(' ' in trim(display_name))>0 then substring(trim(display_name) from position(' ' in trim(display_name))+1) else null end
where first_name is null and display_name is not null and length(trim(display_name)) > 0;

create or replace function public.prevent_profile_name_change()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if old.first_name is not null and new.first_name is distinct from old.first_name then
    raise exception 'First name cannot be changed after account setup.';
  end if;
  if old.last_name is not null and new.last_name is distinct from old.last_name then
    raise exception 'Last name cannot be changed after account setup.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_name_immutable on public.profiles;
create trigger profiles_name_immutable
before update on public.profiles
for each row execute function public.prevent_profile_name_change();
revoke execute on function public.prevent_profile_name_change() from public, anon, authenticated;

update public.user_watchlists
set follow=false, alert_reviews=false, alert_ratings=false, alert_updates=false;
alter table public.user_watchlists alter column follow set default false;
alter table public.user_watchlists alter column alert_reviews set default false;
alter table public.user_watchlists alter column alert_ratings set default false;
alter table public.user_watchlists alter column alert_updates set default false;

insert into public.leagues(name,country,level,season,source,active)
select * from (values
('Primera FEB','Spain','2nd division','2026-27','official-spanish-basketball',true),
('Serie A2','Italy','2nd division','2026-27','official-legapallacanestro',true),
('LNB Pro B','France','2nd division','2026-27','official-lnb',true),
('ProA','Germany','2nd division','2026-27','official-2basketballbundesliga',true),
('ProB','Germany','3rd division','2026-27','official-2basketballbundesliga',true)
) s(name,country,level,season,source,active)
where not exists (select 1 from public.leagues l where l.name=s.name and l.country=s.country);

with seed(name,country,city,league_name,source) as (
 values
 ('Movistar Estudiantes','Spain','Madrid','Primera FEB','official-spanish-basketball'),
 ('Alimerka Oviedo Baloncesto','Spain','Oviedo','Primera FEB','official-spanish-basketball'),
 ('Flexicar Fuenlabrada','Spain','Fuenlabrada','Primera FEB','official-spanish-basketball'),
 ('Coviran Granada','Spain','Granada','Primera FEB','official-spanish-basketball'),
 ('Fortitudo Bologna','Italy','Bologna','Serie A2','official-legapallacanestro'),
 ('New Basket Brindisi','Italy','Brindisi','Serie A2','official-legapallacanestro'),
 ('Libertas Livorno 1947','Italy','Livorno','Serie A2','official-legapallacanestro'),
 ('Basket Torino','Italy','Turin','Serie A2','official-legapallacanestro'),
 ('Pistoia Basket','Italy','Pistoia','Serie A2','official-legapallacanestro'),
 ('Antibes','France','Antibes','LNB Pro B','official-lnb'),
 ('Blois','France','Blois','LNB Pro B','official-lnb'),
 ('Caen Basket Calvados','France','Caen','LNB Pro B','official-lnb'),
 ('Orléans','France','Orléans','LNB Pro B','official-lnb'),
 ('Rouen','France','Rouen','LNB Pro B','official-lnb'),
 ('BBC Bayreuth','Germany','Bayreuth','ProA','official-2basketballbundesliga'),
 ('Nürnberg Falcons BC','Germany','Nuremberg','ProA','official-2basketballbundesliga'),
 ('Paderborn Baskets','Germany','Paderborn','ProA','official-2basketballbundesliga'),
 ('RheinStars Köln','Germany','Cologne','ProA','official-2basketballbundesliga'),
 ('Tigers Tübingen','Germany','Tübingen','ProA','official-2basketballbundesliga'),
 ('Uni Baskets Münster','Germany','Münster','ProB','official-2basketballbundesliga'),
 ('Bayer Giants Leverkusen','Germany','Leverkusen','ProB','official-2basketballbundesliga'),
 ('ART Giants Düsseldorf','Germany','Düsseldorf','ProB','official-2basketballbundesliga')
)
insert into public.teams(name,country,city,league_id,league_name,source,active)
select s.name,s.country,s.city,l.id,l.name,s.source,true
from seed s join public.leagues l on l.name=s.league_name and l.country=s.country
where not exists (select 1 from public.teams t where lower(t.name)=lower(s.name));

insert into public.team_league_memberships(team_id,league_id,season,active)
select t.id,l.id,'2026-27',true
from public.teams t join public.leagues l on l.name=t.league_name and l.country=t.country
where t.name in ('Movistar Estudiantes','Alimerka Oviedo Baloncesto','Flexicar Fuenlabrada','Coviran Granada','Fortitudo Bologna','New Basket Brindisi','Libertas Livorno 1947','Basket Torino','Pistoia Basket','Antibes','Blois','Caen Basket Calvados','Orléans','Rouen','BBC Bayreuth','Nürnberg Falcons BC','Paderborn Baskets','RheinStars Köln','Tigers Tübingen','Uni Baskets Münster','Bayer Giants Leverkusen','ART Giants Düsseldorf')
on conflict (team_id,league_id,season) do nothing;

insert into public.team_league_memberships(team_id,league_id,season,active)
select t.id,l.id,'2026-27',true
from public.teams t cross join public.leagues l
where (t.name='FC Barcelona' and l.name='Liga Endesa')
   or (t.name='Real Madrid' and l.name='Liga Endesa')
   or (t.name='Fenerbahçe Tarfin Istanbul' and l.name='Türkiye Sigorta Basketbol Süper Ligi')
   or (t.name='Anadolu Efes Istanbul' and l.name='Türkiye Sigorta Basketbol Süper Ligi')
on conflict (team_id,league_id,season) do nothing;


insert into public.teams(name,country,city,league_name,source,active)
select * from (values
('FC Barcelona','Spain','Barcelona','Liga Endesa','official-euroleague-2026-27',true),
('Real Madrid','Spain','Madrid','Liga Endesa','official-euroleague-2026-27',true),
('Fenerbahçe Tarfin Istanbul','Türkiye','Istanbul','Türkiye Sigorta Basketbol Süper Ligi','official-euroleague-2026-27',true),
('Anadolu Efes Istanbul','Türkiye','Istanbul','Türkiye Sigorta Basketbol Süper Ligi','official-euroleague-2026-27',true)
) v(name,country,city,league_name,source,active)
where not exists (select 1 from public.teams t where t.name=v.name);

update public.teams t set league_id=(select l.id from public.leagues l where l.name=t.league_name and l.country=t.country limit 1)
where t.name in ('FC Barcelona','Real Madrid','Fenerbahçe Tarfin Istanbul','Anadolu Efes Istanbul');

insert into public.team_league_memberships(team_id,league_id,season,active)
select t.id,l.id,'2026-27',true from public.teams t cross join public.leagues l
where (t.name in ('FC Barcelona','Real Madrid') and l.name in ('Liga Endesa','EuroLeague'))
   or (t.name in ('Fenerbahçe Tarfin Istanbul','Anadolu Efes Istanbul') and l.name in ('Türkiye Sigorta Basketbol Süper Ligi','EuroLeague'))
on conflict (team_id,league_id,season) do nothing;
