-- HoopCheck directory, support/admin, and signup preference expansion
-- 2026-10-06

-- Hide WNBA entries from the women's directory without deleting historical data.
update public.womens_teams set active=false where league_id in (select id from public.womens_leagues where name='WNBA');
update public.womens_leagues set active=false where name='WNBA';

-- Add deeper Europe + Russia coverage for team discovery and signup preferences.
insert into public.teams (name,country,league_name,city,league_id,active,source)
select v.name,v.country,v.league_name,v.city,l.id,true,'HoopCheck curated 2026'
from (values
  ('CSKA Moscow','Russia','VTB United League','Moscow'),
  ('Zenit St Petersburg','Russia','VTB United League','Saint Petersburg'),
  ('UNICS Kazan','Russia','VTB United League','Kazan'),
  ('Lokomotiv Kuban','Russia','VTB United League','Krasnodar'),
  ('MBA Moscow','Russia','VTB United League','Moscow'),
  ('Runa Basket Moscow','Russia','VTB United League','Moscow'),
  ('Avtodor Saratov','Russia','VTB United League','Saratov'),
  ('Parma Perm','Russia','VTB United League','Perm'),
  ('Nizhny Novgorod','Russia','VTB United League','Nizhny Novgorod'),
  ('Uralmash Ekaterinburg','Russia','VTB United League','Yekaterinburg'),
  ('Real Madrid Baloncesto','Spain','Liga Endesa','Madrid'),
  ('FC Barcelona Bàsquet','Spain','Liga Endesa','Barcelona'),
  ('Valencia Basket','Spain','Liga Endesa','Valencia'),
  ('Unicaja Malaga','Spain','Liga Endesa','Malaga'),
  ('Joventut Badalona','Spain','Liga Endesa','Badalona'),
  ('Gran Canaria','Spain','Liga Endesa','Las Palmas'),
  ('Olympiacos BC','Greece','Greek Basketball League','Piraeus'),
  ('Panathinaikos BC','Greece','Greek Basketball League','Athens'),
  ('Fenerbahce Beko','Türkiye','Türkiye Sigorta Basketbol Süper Ligi','Istanbul'),
  ('Anadolu Efes','Türkiye','Türkiye Sigorta Basketbol Süper Ligi','Istanbul'),
  ('Besiktas Fibabanka','Türkiye','Türkiye Sigorta Basketbol Süper Ligi','Istanbul'),
  ('Galatasaray','Türkiye','Türkiye Sigorta Basketbol Süper Ligi','Istanbul'),
  ('Bayern Munich Basketball','Germany','Basketball Bundesliga','Munich'),
  ('ALBA Berlin','Germany','Basketball Bundesliga','Berlin'),
  ('Paris Basketball','France','Betclic Élite','Paris'),
  ('ASVEL Basket','France','Betclic Élite','Villeurbanne'),
  ('Partizan Belgrade','Serbia','Košarkaška liga Srbije','Belgrade'),
  ('Crvena zvezda Meridianbet','Serbia','Košarkaška liga Srbije','Belgrade'),
  ('Virtus Bologna','Italy','Lega Basket Serie A','Bologna'),
  ('Olimpia Milano','Italy','Lega Basket Serie A','Milan'),
  ('Maccabi Tel Aviv','Israel','Israeli Basketball Premier League','Tel Aviv'),
  ('Hapoel Jerusalem','Israel','Israeli Basketball Premier League','Jerusalem'),
  ('Benfica Basketball','Portugal','Liga Betclic','Lisbon'),
  ('FC Porto Basketball','Portugal','Liga Betclic','Porto'),
  ('Cedevita Olimpija','Slovenia','Liga Nova KBM','Ljubljana'),
  ('Budućnost VOLI','Montenegro','Erste Liga','Podgorica'),
  ('Rytas Vilnius','Lithuania','LKL','Vilnius'),
  ('Zalgiris Kaunas','Lithuania','LKL','Kaunas'),
  ('Riga Zelli','Latvia','Latvian-Estonian Basketball League','Riga'),
  ('Bakken Bears','Denmark','Basketligaen','Aarhus'),
  ('Nymburk','Czechia','Kooperativa NBL','Nymburk'),
  ('BC Oostende','Belgium','BNXT League','Oostende'),
  ('Leiden Basketball','Netherlands','BNXT League','Leiden'),
  ('Norrkoping Dolphins','Sweden','Svenska Basketligan','Norrkoping'),
  ('PAOK BC','Greece','Greek Basketball League','Thessaloniki'),
  ('AEK Betsson BC','Greece','Greek Basketball League','Athens'),
  ('Aris BC','Greece','Greek Basketball League','Thessaloniki'),
  ('Tofas Bursa','Türkiye','Türkiye Sigorta Basketbol Süper Ligi','Bursa'),
  ('Darussafaka','Türkiye','Türkiye Sigorta Basketbol Süper Ligi','Istanbul')
) v(name,country,league_name,city)
join public.leagues l on l.name=v.league_name and l.country=v.country
where not exists (
  select 1 from public.teams t where lower(t.name)=lower(v.name) and t.active=true
);

-- Let admins review and manage support/donation inboxes.
alter table public.sponsor_inquiries add column if not exists status text not null default 'open';
alter table public.sponsor_inquiries add column if not exists updated_at timestamptz not null default now();

drop policy if exists "sponsor inquiry admin read" on public.sponsor_inquiries;
create policy "sponsor inquiry admin read" on public.sponsor_inquiries
for select to authenticated
using ((select public.is_current_user_admin_or_moderator()) or user_id=(select auth.uid()));

drop policy if exists "sponsor inquiry admin update" on public.sponsor_inquiries;
create policy "sponsor inquiry admin update" on public.sponsor_inquiries
for update to authenticated
using ((select public.is_current_user_admin_or_moderator()))
with check ((select public.is_current_user_admin_or_moderator()));

drop policy if exists "support admin update" on public.support_requests;
create policy "support admin update" on public.support_requests
for update to authenticated
using ((select public.is_current_user_admin_or_moderator()))
with check ((select public.is_current_user_admin_or_moderator()));

create index if not exists idx_support_requests_status_created on public.support_requests(status,created_at desc);
create index if not exists idx_sponsor_inquiries_type_created on public.sponsor_inquiries(type,created_at desc);

-- Signup preference indexes.
create index if not exists idx_teams_name_country_active on public.teams(name,country) where active=true;
