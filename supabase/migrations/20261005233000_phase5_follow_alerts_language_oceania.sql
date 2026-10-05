-- HoopCheck Phase 5 follow/alerts, language preferences, Oceania directory, and coach reset.
alter table public.user_preferences
  add column if not exists language text not null default 'en'
  check (language in ('en','es','fr','de','tr','pt','it','el','ar'));

alter table public.user_watchlists
  add column if not exists follow boolean not null default true,
  add column if not exists alert_reviews boolean not null default true,
  add column if not exists alert_ratings boolean not null default true,
  add column if not exists alert_updates boolean not null default true;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('team','coach','league')),
  target_id uuid not null,
  notification_type text not null check (notification_type in ('review','rating','update')),
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon;
grant select, update on public.notifications to authenticated;

drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "notifications_update_own" on public.notifications
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);

create or replace function public.create_review_notifications()
returns trigger language plpgsql security definer set search_path = public
as $$
declare target_kind text; target_uuid uuid; target_label text;
begin
  if new.status <> 'approved' then return new; end if;
  if new.team_id is not null then
    target_kind := 'team'; target_uuid := new.team_id; select name into target_label from public.teams where id = new.team_id;
  elsif new.league_id is not null then
    target_kind := 'league'; target_uuid := new.league_id; select name into target_label from public.leagues where id = new.league_id;
  elsif new.coach_id is not null then
    target_kind := 'coach'; target_uuid := new.coach_id; select name into target_label from public.coaches where id = new.coach_id;
  else return new; end if;

  insert into public.notifications(user_id,target_type,target_id,notification_type,title,body)
  select w.user_id,target_kind,target_uuid,'review','New review: '||coalesce(target_label,'HoopCheck profile'),'A new approved player review is available.'
  from public.user_watchlists w join public.user_preferences p on p.user_id=w.user_id
  where w.target_type=target_kind and w.target_id=target_uuid and w.follow=true and w.alert_reviews=true and p.notifications_enabled=true;

  insert into public.notifications(user_id,target_type,target_id,notification_type,title,body)
  select w.user_id,target_kind,target_uuid,'rating','New rating: '||coalesce(target_label,'HoopCheck profile'),'A new approved rating may change the community rating.'
  from public.user_watchlists w join public.user_preferences p on p.user_id=w.user_id
  where w.target_type=target_kind and w.target_id=target_uuid and w.follow=true and w.alert_ratings=true and p.notifications_enabled=true;
  return new;
end; $$;

drop trigger if exists reviews_create_notifications on public.reviews;
create trigger reviews_create_notifications after insert or update of status on public.reviews
for each row execute function public.create_review_notifications();
revoke execute on function public.create_review_notifications() from public, anon, authenticated;

update public.teams t set league_id=l.id,league_name=l.name from public.leagues l where t.name='Gence BC' and l.name='Azerbaijan Basketball League';
update public.teams t set league_id=l.id,league_name=l.name from public.leagues l where t.name='Bakken Bears Aarhus' and l.name='Basketligaen';
update public.teams t set league_id=l.id,league_name=l.name from public.leagues l where t.name='BC Oostende' and l.name='BNXT League' and l.country='Belgium';
update public.teams t set league_id=l.id,league_name=l.name from public.leagues l where t.name='BC Prievidza' and l.name='Nike SBL';
update public.teams t set league_id=l.id,league_name=l.name from public.leagues l where t.name='Iraklis BC' and l.name='Greek Basketball League';
update public.teams t set league_id=l.id,league_name=l.name from public.leagues l where t.name='Lions de Geneve' and l.name='SB League';
update public.teams t set league_id=l.id,league_name=l.name from public.leagues l where t.name='VEF Riga' and l.name='Latvian-Estonian Basketball League';
update public.teams t set league_id=l.id,league_name=l.name from public.leagues l where t.name='BC Bashkimi' and l.name='Kosovo Superleague';

insert into public.leagues(name,country,level,season,source,active)
select 'CIBACOPA','Mexico','Mexican professional division','2026','official-cibacopa',true
where not exists (select 1 from public.leagues where name='CIBACOPA');
update public.teams t set league_id=l.id,league_name=l.name from public.leagues l where t.name='Astros de Jalisco' and l.name='CIBACOPA';

insert into public.leagues(name,country,level,season,source,active)
select 'National Basketball League (Australia)','Australia','Australian premier professional division','2026-27','official-nbl-australia',true
where not exists (select 1 from public.leagues where name='National Basketball League (Australia)');
insert into public.leagues(name,country,level,season,source,active)
select 'New Zealand National Basketball League','New Zealand','New Zealand premier professional division','2026','official-nznbl',true
where not exists (select 1 from public.leagues where name='New Zealand National Basketball League');

with league as (select id,name from public.leagues where name='National Basketball League (Australia)' limit 1),
teams(name,country,city) as (values
('Adelaide 36ers','Australia','Adelaide'),('BNZ Breakers','New Zealand','Auckland'),('Brisbane Bullets','Australia','Brisbane'),
('Cairns Taipans','Australia','Cairns'),('Illawarra Hawks','Australia','Wollongong'),('Melbourne United','Australia','Melbourne'),
('Perth Wildcats','Australia','Perth'),('South East Melbourne Phoenix','Australia','Melbourne'),('Sydney Kings','Australia','Sydney'),
('Tasmania JackJumpers','Australia','Launceston'))
insert into public.teams(name,country,city,league_id,league_name,source,active)
select t.name,t.country,t.city,league.id,league.name,'official-nbl-australia',true from teams t cross join league
where not exists (select 1 from public.teams x where lower(x.name)=lower(t.name));

with league as (select id,name from public.leagues where name='New Zealand National Basketball League' limit 1),
teams(name,country,city) as (values
('Auckland Tuatara','New Zealand','Auckland'),('Canterbury Rams','New Zealand','Christchurch'),('Franklin Bulls','New Zealand','Pukekohe'),
('Hawke''s Bay Hawks','New Zealand','Napier'),('Manawatu Jets','New Zealand','Palmerston North'),('Nelson Giants','New Zealand','Nelson'),
('Otago Nuggets','New Zealand','Dunedin'),('Southland Sharks','New Zealand','Invercargill'),('Taranaki Airs','New Zealand','New Plymouth'),
('Tauranga Whai','New Zealand','Tauranga'),('Wellington Saints','New Zealand','Wellington'))
insert into public.teams(name,country,city,league_id,league_name,source,active)
select t.name,t.country,t.city,league.id,league.name,'official-nznbl',true from teams t cross join league
where not exists (select 1 from public.teams x where lower(x.name)=lower(t.name));

delete from public.coaches;
