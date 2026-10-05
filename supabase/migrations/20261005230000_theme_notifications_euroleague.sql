create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'dark' check (theme in ('light','dark','dynamic')),
  notifications_enabled boolean not null default true,
  reduced_motion boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;
grant select, insert, update on public.user_preferences to authenticated;

create policy "Users can read own preferences" on public.user_preferences for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert own preferences" on public.user_preferences for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own preferences" on public.user_preferences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table if not exists public.user_watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('team','coach','league')),
  target_id uuid not null,
  notify boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);

create index if not exists user_watchlists_user_idx on public.user_watchlists(user_id);
create index if not exists user_watchlists_target_idx on public.user_watchlists(target_type, target_id);
alter table public.user_watchlists enable row level security;
grant select, insert, update, delete on public.user_watchlists to authenticated;

create policy "Users can read own watchlist" on public.user_watchlists for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can add own watchlist" on public.user_watchlists for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own watchlist" on public.user_watchlists for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete own watchlist" on public.user_watchlists for delete to authenticated using ((select auth.uid()) = user_id);

insert into public.leagues (name,country,level,season,active,source)
select 'EuroLeague','Europe','European premier division','2026-27',true,'official-euroleague'
where not exists (select 1 from public.leagues where lower(name)='euroleague' and season='2026-27');

with euroleague as (select id from public.leagues where lower(name)='euroleague' and season='2026-27' limit 1),
teams(name,country,city) as (
  values
  ('Anadolu Efes Istanbul','Türkiye','Istanbul'),('Armani Olimpia Milano','Italy','Milan'),('Beşiktaş Istanbul','Türkiye','Istanbul'),
  ('Crvena Zvezda Meridianbet Belgrade','Serbia','Belgrade'),('Dubai Basketball','United Arab Emirates','Dubai'),('FC Barcelona','Spain','Barcelona'),
  ('FC Bayern Munich','Germany','Munich'),('Fenerbahçe Tarfin Istanbul','Türkiye','Istanbul'),('Hapoel IBI Tel Aviv','Israel','Tel Aviv'),
  ('Kosner Baskonia Vitoria-Gasteiz','Spain','Vitoria-Gasteiz'),('LDLC ASVEL Villeurbanne','France','Villeurbanne'),('Maccabi Rapyd Tel Aviv','Israel','Tel Aviv'),
  ('Olympiacos Piraeus','Greece','Piraeus'),('Panathinaikos AKTOR Athens','Greece','Athens'),('Paris Basketball','France','Paris'),
  ('Partizan Mozzart Bet Belgrade','Serbia','Belgrade'),('Real Madrid','Spain','Madrid'),('Valencia Basket','Spain','Valencia'),
  ('Virtus Bologna','Italy','Bologna'),('Zalgiris Kaunas','Lithuania','Kaunas')
)
insert into public.teams(name,country,city,league_id,league_name,active,source)
select t.name,t.country,t.city,e.id,'EuroLeague',true,'official-euroleague'
from teams t cross join euroleague e
where not exists (select 1 from public.teams x where lower(x.name)=lower(t.name) and coalesce(x.country,'')=t.country);

update public.teams x set league_id=e.id, league_name='EuroLeague'
from public.leagues e
where lower(e.name)='euroleague' and e.season='2026-27'
and lower(x.name) in ('anadolu efes istanbul','armani olimpia milano','beşiktaş istanbul','crvena zvezda meridianbet belgrade','dubai basketball','fc barcelona','fc bayern munich','fenerbahçe tarfin istanbul','hapoel ibi tel aviv','kosner baskonia vitoria-gasteiz','ldlc asvel villeurbanne','maccabi rapyd tel aviv','olympiacos piraeus','panathinaikos aktor athens','paris basketball','partizan mozzart bet belgrade','real madrid','valencia basket','virtus bologna','zalgiris kaunas');