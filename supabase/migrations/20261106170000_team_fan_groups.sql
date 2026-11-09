-- FAN-GRP-1: one official fan group per team, isolated from player HoopFeed and team FanFeed.
create table if not exists public.team_fan_groups (
  team_id uuid primary key references public.teams(id) on delete cascade,
  group_name text not null,
  join_mode text not null default 'open' check (join_mode in ('open','approval')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_fan_group_moderators (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.team_fan_groups(team_id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  moderator_type text not null check (moderator_type in ('platform','club_admin','fan_co_moderator')),
  created_at timestamptz not null default now(),
  constraint team_fan_group_moderator_user_unique unique(team_id,user_id)
);
create unique index if not exists team_fan_group_one_platform_moderator_idx
  on public.team_fan_group_moderators(team_id) where moderator_type='platform';
create index if not exists team_fan_group_moderators_user_idx
  on public.team_fan_group_moderators(user_id,team_id);

create table if not exists public.team_fan_group_members (
  team_id uuid not null references public.team_fan_groups(team_id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(team_id,user_id)
);
create index if not exists team_fan_group_members_user_idx on public.team_fan_group_members(user_id,team_id);

create table if not exists public.team_fan_group_join_requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.team_fan_groups(team_id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null
);
create unique index if not exists team_fan_group_one_pending_request_idx
  on public.team_fan_group_join_requests(team_id,user_id) where status='pending';

create table if not exists public.team_fan_group_posts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.team_fan_groups(team_id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  image_url text,
  is_pinned boolean not null default false,
  status text not null default 'published' check(status in ('published','removed')),
  created_at timestamptz not null default now(),
  constraint team_fan_group_post_content_check check (
    char_length(body) <= 2000 and (length(trim(body)) > 0 or image_url is not null)
  )
);
create index if not exists team_fan_group_posts_timeline_idx
  on public.team_fan_group_posts(team_id,is_pinned desc,created_at desc) where status='published';
create unique index if not exists team_fan_group_one_pinned_post_idx
  on public.team_fan_group_posts(team_id) where is_pinned=true and status='published';

create table if not exists public.team_fan_group_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.team_fan_group_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check(char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists team_fan_group_comments_post_idx on public.team_fan_group_comments(post_id,created_at);

create table if not exists public.team_fan_group_reports (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.team_fan_groups(team_id) on delete cascade,
  post_id uuid not null references public.team_fan_group_posts(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check(char_length(trim(reason)) between 3 and 500),
  status text not null default 'open' check(status in ('open','reviewed','dismissed')),
  created_at timestamptz not null default now()
);
create unique index if not exists team_fan_group_report_once_idx on public.team_fan_group_reports(post_id,reporter_id);

-- Every existing and future team gets exactly one group.
insert into public.team_fan_groups(team_id,group_name)
select id, name || ' Fan Group' from public.teams
on conflict(team_id) do update set group_name=excluded.group_name;
insert into public.team_fan_group_moderators(team_id,moderator_type)
select team_id,'platform' from public.team_fan_groups
on conflict do nothing;

create or replace function public.ensure_team_fan_group()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.team_fan_groups(team_id,group_name) values(new.id,new.name || ' Fan Group')
  on conflict(team_id) do update set group_name=excluded.group_name;
  if not exists (select 1 from public.team_fan_group_moderators m where m.team_id=new.id) then
    insert into public.team_fan_group_moderators(team_id,moderator_type)
    values(new.id,'platform') on conflict do nothing;
  end if;
  return new;
end; $$;
drop trigger if exists teams_ensure_fan_group on public.teams;
create trigger teams_ensure_fan_group after insert or update of name on public.teams
for each row execute function public.ensure_team_fan_group();

-- The approved claimant becomes the club's default moderator automatically.
create or replace function public.transfer_team_fan_group_moderator()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.entity_type='team' and new.status='approved' then
    if tg_op='INSERT' then
      insert into public.team_fan_group_moderators(team_id,user_id,moderator_type)
      values(new.entity_id,new.requester_id,'club_admin')
      on conflict(team_id,user_id) do update set moderator_type='club_admin';
      delete from public.team_fan_group_moderators where team_id=new.entity_id and moderator_type='platform';
    elsif old.status is distinct from new.status then
      insert into public.team_fan_group_moderators(team_id,user_id,moderator_type)
      values(new.entity_id,new.requester_id,'club_admin')
      on conflict(team_id,user_id) do update set moderator_type='club_admin';
      delete from public.team_fan_group_moderators where team_id=new.entity_id and moderator_type='platform';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists profile_claim_team_fan_group_moderator on public.profile_claim_requests;
create trigger profile_claim_team_fan_group_moderator
after insert or update of status on public.profile_claim_requests
for each row execute function public.transfer_team_fan_group_moderator();

create or replace function public.is_team_fan_group_member(p_team_id uuid,p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select case when p_user_id is distinct from auth.uid() then false else (
    exists(
      select 1 from public.team_fan_group_members m
      join public.profiles p on p.id=m.user_id and p.account_type='fan'
      where m.team_id=p_team_id and m.user_id=auth.uid()
    ) or exists(select 1 from public.team_fan_group_moderators m where m.team_id=p_team_id and m.user_id=auth.uid())
    or (
      exists(select 1 from public.team_fan_group_moderators m where m.team_id=p_team_id and m.moderator_type='platform')
      and public.is_current_user_admin_or_moderator()
    )
  ) end;
$$;
create or replace function public.is_team_fan_group_moderator(p_team_id uuid,p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select case when p_user_id is distinct from auth.uid() then false else (
    exists(select 1 from public.team_fan_group_moderators m where m.team_id=p_team_id and m.user_id=auth.uid())
    or (exists(select 1 from public.team_fan_group_moderators m where m.team_id=p_team_id and m.moderator_type='platform')
        and public.is_current_user_admin_or_moderator())
  ) end;
$$;
revoke all on function public.is_team_fan_group_member(uuid,uuid) from public;
revoke all on function public.is_team_fan_group_moderator(uuid,uuid) from public;
grant execute on function public.is_team_fan_group_member(uuid,uuid) to authenticated;
grant execute on function public.is_team_fan_group_moderator(uuid,uuid) to authenticated;

create or replace function public.get_team_fan_group_summary(p_team_id uuid)
returns table(group_name text,member_count bigint,join_mode text,is_member boolean,has_pending_request boolean)
language sql stable security definer set search_path=public as $$
  select g.group_name,
    (select count(*) from public.team_fan_group_members m join public.profiles p on p.id=m.user_id and p.account_type='fan' where m.team_id=g.team_id),
    g.join_mode,
    public.is_team_fan_group_member(g.team_id,auth.uid()),
    exists(select 1 from public.team_fan_group_join_requests r where r.team_id=g.team_id and r.user_id=auth.uid() and r.status='pending')
  from public.team_fan_groups g where g.team_id=p_team_id;
$$;
revoke all on function public.get_team_fan_group_summary(uuid) from public;
grant execute on function public.get_team_fan_group_summary(uuid) to authenticated;

alter table public.team_fan_groups enable row level security;
alter table public.team_fan_group_moderators enable row level security;
alter table public.team_fan_group_members enable row level security;
alter table public.team_fan_group_join_requests enable row level security;
alter table public.team_fan_group_posts enable row level security;
alter table public.team_fan_group_comments enable row level security;
alter table public.team_fan_group_reports enable row level security;

-- Clients can discover group metadata/counts; all writes are performed by the authenticated server route.
grant select on public.team_fan_groups to authenticated;
grant select on public.team_fan_group_moderators to authenticated;
grant select on public.team_fan_group_members to authenticated;
grant select on public.team_fan_group_join_requests to authenticated;
grant select on public.team_fan_group_posts to authenticated;
grant select on public.team_fan_group_comments to authenticated;
grant select on public.team_fan_group_reports to authenticated;
revoke insert,update,delete on public.team_fan_groups,public.team_fan_group_moderators,public.team_fan_group_members,public.team_fan_group_join_requests,public.team_fan_group_posts,public.team_fan_group_comments,public.team_fan_group_reports from anon,authenticated;
grant all on public.team_fan_groups,public.team_fan_group_moderators,public.team_fan_group_members,public.team_fan_group_join_requests,public.team_fan_group_posts,public.team_fan_group_comments,public.team_fan_group_reports to service_role;

create policy "fan groups discoverable to signed in users" on public.team_fan_groups
for select to authenticated using(true);
create policy "moderators can inspect moderators" on public.team_fan_group_moderators
for select to authenticated using(public.is_team_fan_group_moderator(team_id));
create policy "members can see own group membership" on public.team_fan_group_members
for select to authenticated using(user_id=auth.uid() or public.is_team_fan_group_moderator(team_id));
create policy "users can see own join requests or moderators can manage" on public.team_fan_group_join_requests
for select to authenticated using(user_id=auth.uid() or public.is_team_fan_group_moderator(team_id));
create policy "group members can read group posts" on public.team_fan_group_posts
for select to authenticated using(status='published' and public.is_team_fan_group_member(team_id));
create policy "group members can read comments" on public.team_fan_group_comments
for select to authenticated using(exists(select 1 from public.team_fan_group_posts p where p.id=post_id and p.status='published' and public.is_team_fan_group_member(p.team_id)));
create policy "reporters and moderators can read reports" on public.team_fan_group_reports
for select to authenticated using(reporter_id=auth.uid() or public.is_team_fan_group_moderator(team_id));

-- Extend the existing notification type allowlist without changing existing notification behavior.
alter table public.notifications drop constraint if exists notifications_notification_type_check;
alter table public.notifications add constraint notifications_notification_type_check
check(notification_type in ('review','rating','update','game_reminder','group_request','group_approved','group_report'));

-- Existing approved claims are transferred at migration time as well as by the trigger.
insert into public.team_fan_group_moderators(team_id,user_id,moderator_type)
select c.entity_id,c.requester_id,'club_admin'
from public.profile_claim_requests c
where c.entity_type='team' and c.status='approved'
on conflict(team_id,user_id) do update set moderator_type='club_admin';
delete from public.team_fan_group_moderators m
where m.moderator_type='platform'
and exists(select 1 from public.team_fan_group_moderators c where c.team_id=m.team_id and c.moderator_type='club_admin');

-- Group images must not be publicly readable; members receive short-lived signed URLs.
insert into storage.buckets(id,name,public)
values('fan-group-images','fan-group-images',false)
on conflict(id) do nothing;
drop policy if exists "fan group members read group images" on storage.objects;
create policy "fan group members read group images"
on storage.objects for select to authenticated
using (
  bucket_id='fan-group-images'
  and public.is_team_fan_group_member(((storage.foldername(name))[1])::uuid,(select auth.uid()))
);
