create table if not exists public.follow_relationships (
 id uuid primary key default gen_random_uuid(), follower_id uuid not null references public.profiles(id) on delete cascade,
 target_type text not null check(target_type in ('team','player','league')), target_id uuid not null,
 notify_reviews boolean not null default true, notify_ratings boolean not null default false, notify_updates boolean not null default true,
 created_at timestamptz not null default now(), unique(follower_id,target_type,target_id)
);
alter table public.follow_relationships enable row level security;
drop policy if exists "followers manage own" on public.follow_relationships;
create policy "followers manage own" on public.follow_relationships for all to authenticated using((select auth.uid())=follower_id) with check((select auth.uid())=follower_id);
create index if not exists idx_follow_relationships_target on public.follow_relationships(target_type,target_id);
create table if not exists public.review_likes(id uuid primary key default gen_random_uuid(),review_id uuid not null references public.reviews(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,created_at timestamptz not null default now(),unique(review_id,user_id));
alter table public.review_likes enable row level security;
create policy "review likes readable" on public.review_likes for select to authenticated using(true);
create policy "review likes own" on public.review_likes for insert to authenticated with check((select auth.uid())=user_id);
create policy "review likes delete own" on public.review_likes for delete to authenticated using((select auth.uid())=user_id);
create table if not exists public.review_comments(id uuid primary key default gen_random_uuid(),review_id uuid not null references public.reviews(id) on delete cascade,author_id uuid not null references public.profiles(id) on delete cascade,body text not null check(char_length(body) between 1 and 1000),status text not null default 'pending' check(status in ('pending','approved','rejected','flagged')),created_at timestamptz not null default now());
alter table public.review_comments enable row level security;
create policy "review comments public approved" on public.review_comments for select to authenticated using(status='approved' or author_id=(select auth.uid()) or public.is_current_user_admin_or_moderator());
create policy "review comments own insert" on public.review_comments for insert to authenticated with check(author_id=(select auth.uid()));
create table if not exists public.womens_leagues(id uuid primary key default gen_random_uuid(),name text not null,country text,level text,active boolean not null default true,created_at timestamptz not null default now());
create table if not exists public.womens_teams(id uuid primary key default gen_random_uuid(),name text not null,country text,city text,league_id uuid references public.womens_leagues(id) on delete set null,league_name text,active boolean not null default true,created_at timestamptz not null default now());
alter table public.womens_teams add column if not exists league_name text;
alter table public.womens_leagues enable row level security; alter table public.womens_teams enable row level security;
drop policy if exists "womens leagues public read" on public.womens_leagues;
create policy "womens leagues public read" on public.womens_leagues for select to anon,authenticated using(active=true);
drop policy if exists "womens teams public read" on public.womens_teams;
create policy "womens teams public read" on public.womens_teams for select to anon,authenticated using(active=true);
insert into public.womens_leagues(name,country,level) values ('WNBA','United States','Professional'),('WNBL','Australia','Professional'),('EuroLeague Women','Europe','Continental'),('Liga Femenina Endesa','Spain','Professional'),('Women’s Basketball Bundesliga','Germany','Professional'),('Ligue Féminine de Basketball','France','Professional'),('Women’s National Basketball League','United Kingdom','Professional'),('Turkish Women’s Basketball Super League','Türkiye','Professional') on conflict do nothing;
insert into public.womens_teams(name,country,league_id) select v.name,v.country,l.id from (values ('Las Vegas Aces','United States','WNBA'),('New York Liberty','United States','WNBA'),('Phoenix Mercury','United States','WNBA'),('Minnesota Lynx','United States','WNBA'),('Southside Flyers','Australia','WNBL'),('Bendigo Spirit','Australia','WNBL'),('Canberra Capitals','Australia','WNBL'),('Perfumerías Avenida','Spain','Liga Femenina Endesa'),('Valencia Basket Women','Spain','Liga Femenina Endesa'),('ALBA Berlin Women','Germany','Women’s Basketball Bundesliga'),('ASVEL Women','France','Ligue Féminine de Basketball'),('Fenerbahçe Women','Türkiye','Turkish Women’s Basketball Super League')) v(name,country,league_name) join public.womens_leagues l on l.name=v.league_name where not exists(select 1 from public.womens_teams t where t.name=v.name and t.league_id=l.id);
update public.womens_teams t set league_name=l.name from public.womens_leagues l where t.league_id=l.id and (t.league_name is null or t.league_name='');
alter table public.profiles add column if not exists basketball_type text not null default 'mens' check(basketball_type in ('mens','womens'));
alter table public.profiles add column if not exists free_agent boolean not null default false;
alter table public.profiles add column if not exists hometown text;
alter table public.profiles add column if not exists nationality text;
alter table public.profiles add column if not exists display_name_changed_at timestamptz;
alter table public.profiles add column if not exists selected_team_id uuid references public.teams(id) on delete set null;
alter table public.profiles add column if not exists selected_team_verified boolean not null default false;
alter table public.profiles add column if not exists selected_womens_team_id uuid references public.womens_teams(id) on delete set null;
create table if not exists public.display_name_changes(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,changed_at timestamptz not null default now());
create index if not exists idx_display_name_changes_user_date on public.display_name_changes(user_id,changed_at);
create table if not exists public.support_requests(id uuid primary key default gen_random_uuid(),user_id uuid references public.profiles(id) on delete set null,subject text not null,body text not null,status text not null default 'open',created_at timestamptz not null default now());
alter table public.support_requests enable row level security;
create policy "support own" on public.support_requests for insert to authenticated with check(user_id=(select auth.uid()));
create policy "support read own admin" on public.support_requests for select to authenticated using(user_id=(select auth.uid()) or public.is_current_user_admin_or_moderator());
create table if not exists public.sponsor_inquiries(id uuid primary key default gen_random_uuid(),user_id uuid references public.profiles(id) on delete set null,type text not null check(type in('sponsor','donate','inquire')),message text not null,created_at timestamptz not null default now());
alter table public.sponsor_inquiries enable row level security;
create policy "sponsor inquiry own" on public.sponsor_inquiries for insert to authenticated with check(user_id=(select auth.uid()));
create table if not exists public.feed_posts(id uuid primary key default gen_random_uuid(),author_id uuid not null references public.profiles(id) on delete cascade,body text not null check(char_length(body) between 1 and 2000),status text not null default 'pending',created_at timestamptz not null default now());
alter table public.feed_posts enable row level security;
create policy "feed approved read" on public.feed_posts for select to authenticated using(status='approved' or author_id=(select auth.uid()) or public.is_current_user_admin_or_moderator());
create policy "feed own insert" on public.feed_posts for insert to authenticated with check(author_id=(select auth.uid()));
create or replace function public.enforce_player_profile_locks() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or public.is_current_user_admin_or_moderator() then return new; end if;
 if old.account_type='player' then
  if new.position is distinct from old.position then raise exception 'Position cannot be changed after account creation.'; end if;
  if new.years_pro is distinct from old.years_pro then raise exception 'Years professional cannot be changed after account creation.'; end if;
  if new.country is distinct from old.country then raise exception 'Country cannot be changed after selection.'; end if;
  if new.current_country is distinct from old.current_country then raise exception 'Current country is managed through verified team changes.'; end if;
  if new.selected_team_id is distinct from old.selected_team_id or new.selected_womens_team_id is distinct from old.selected_womens_team_id then raise exception 'Current team can only be changed after a new team is verified by HoopCheck.'; end if;
  if new.display_name is distinct from old.display_name and old.display_name is not null then
   if (select count(*) from public.display_name_changes where user_id=old.id and changed_at >= date_trunc('month',now())) >= 2 then raise exception 'Display name can only be changed twice per month.'; end if;
   insert into public.display_name_changes(user_id) values(old.id);
   new.display_name_changed_at:=now();
  end if;
 end if; return new;
end; $$;
drop trigger if exists enforce_player_profile_locks on public.profiles;
create trigger enforce_player_profile_locks before update on public.profiles for each row execute function public.enforce_player_profile_locks();
create or replace function public.get_follow_count(p_target_type text,p_target_id uuid) returns bigint language sql stable security definer set search_path=public as $$ select count(*) from public.follow_relationships where target_type=p_target_type and target_id=p_target_id; $$;
grant execute on function public.get_follow_count(text,uuid) to anon,authenticated;

create or replace function public.moderate_player_verification(p_request_id uuid,p_status text,p_reviewer_note text default null)
returns public.player_verification_requests language plpgsql security definer set search_path=public,pg_catalog as $$
declare v_request public.player_verification_requests; v_now timestamptz:=now();
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.admin_roles where user_id=auth.uid() and trim(lower(role)) in ('admin','moderator')) then raise exception 'Admin or moderator access required'; end if;
 if p_status not in ('approved','rejected') then raise exception 'Invalid verification status'; end if;
 update public.player_verification_requests set status=p_status,reviewer_id=auth.uid(),reviewer_note=case when p_reviewer_note is null then reviewer_note else left(trim(p_reviewer_note),1000) end,reviewed_at=v_now where id=p_request_id and status='pending' returning * into v_request;
 if v_request.id is null then raise exception 'Pending verification request not found'; end if;
 update public.profiles set player_verified=(p_status='approved'),player_verified_at=case when p_status='approved' then v_now else null end,
 selected_team_id=case when p_status='approved' then v_request.team_id else selected_team_id end,
 selected_womens_team_id=case when p_status='approved' then v_request.womens_team_id else selected_womens_team_id end,
 selected_team_verified=case when p_status='approved' and (v_request.team_id is not null or v_request.womens_team_id is not null) then true else selected_team_verified end
 where id=v_request.user_id;
 if p_status='approved' and v_request.team_id is not null then
  insert into public.player_team_affiliations(user_id,team_id,relationship,start_date,verified,evidence_url) values(v_request.user_id,v_request.team_id,'current',current_date,true,v_request.evidence_url)
  on conflict(user_id,team_id) do update set relationship='current',verified=true,evidence_url=excluded.evidence_url,end_date=null;
 end if;
 return v_request;
end; $$;