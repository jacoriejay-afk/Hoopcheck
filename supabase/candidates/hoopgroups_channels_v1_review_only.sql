-- REVIEW CANDIDATE ONLY. DO NOT APPLY TO PRODUCTION.
-- Run in an isolated schema-equivalent database and review migration ordering,
-- RLS, moderation operations, report abuse, retention, and native compatibility.
-- No team_fan_groups tables or policies are modified.
begin;
create table if not exists public.hoop_group_spaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  name text not null check (char_length(name) between 3 and 80),
  description text not null default '' check (char_length(description) <= 300),
  category text not null check (category in ('players','fans','coaches','agents','womens','global')),
  created_at timestamptz not null default now()
);
create table if not exists public.hoop_group_channels (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.hoop_group_spaces(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (char_length(name) between 2 and 50),
  sort_index smallint not null default 0,
  created_at timestamptz not null default now(),
  unique(space_id,slug)
);
create table if not exists public.hoop_group_members (
  space_id uuid not null references public.hoop_group_spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(space_id,user_id)
);
create table if not exists public.hoop_group_posts (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.hoop_group_channels(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1200),
  moderation_status text not null default 'pending' check (moderation_status in ('pending','approved','rejected','removed')),
  created_at timestamptz not null default now(),
  -- Immutable author/time slot identity: one new post per 20-second bucket.
  posting_slot bigint not null default floor(extract(epoch from now()) / 20)::bigint,
  unique(author_id,posting_slot)
);
create index if not exists hoop_group_posts_channel_time_idx on public.hoop_group_posts(channel_id,created_at desc);
create table if not exists public.hoop_group_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.hoop_group_posts(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 3 and 350),
  created_at timestamptz not null default now(),
  unique(post_id,reporter_id)
);
create table if not exists public.hoop_group_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker_id,blocked_id),
  check(blocker_id <> blocked_id)
);
-- Moderator actions are server-only, independently audited and atomic.
create table if not exists public.hoop_group_moderation_events (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.hoop_group_posts(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  from_status text not null,
  to_status text not null,
  created_at timestamptz not null default now()
);
create index if not exists hoop_group_moderation_events_post_idx on public.hoop_group_moderation_events(post_id,created_at desc);
alter table public.hoop_group_moderation_events enable row level security;
revoke all on public.hoop_group_moderation_events from public,anon,authenticated;

create or replace function public.moderate_hoop_group_post(
  p_post_id uuid, p_actor_id uuid, p_new_status text)
returns table(id uuid, moderation_status text)
language plpgsql security invoker set search_path=''
as $moderation$
declare previous text;
begin
  if p_new_status not in ('approved','rejected','removed') then
    raise exception 'Invalid moderation action';
  end if;
  if not exists (
    select 1 from public.admin_roles
    where user_id=p_actor_id and role in ('admin','moderator')
  ) then raise exception 'Not authorized to moderate';
  end if;
  select p.moderation_status into previous
    from public.hoop_group_posts p where p.id=p_post_id for update;
  if not found then raise exception 'Post not found'; end if;
  if not ((previous='pending' and p_new_status in ('approved','rejected','removed'))
    or (previous='approved' and p_new_status='removed')) then
    raise exception 'Invalid moderation transition';
  end if;
  update public.hoop_group_posts p set moderation_status=p_new_status
    where p.id=p_post_id;
  insert into public.hoop_group_moderation_events(post_id,actor_id,from_status,to_status)
    values(p_post_id,p_actor_id,previous,p_new_status);
  return query select p.id,p.moderation_status from public.hoop_group_posts p where p.id=p_post_id;
end; $moderation$;
revoke all on function public.moderate_hoop_group_post(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.moderate_hoop_group_post(uuid,uuid,text) to service_role;

alter table public.hoop_group_spaces enable row level security;
alter table public.hoop_group_channels enable row level security;
alter table public.hoop_group_members enable row level security;
alter table public.hoop_group_posts enable row level security;
alter table public.hoop_group_reports enable row level security;
alter table public.hoop_group_blocks enable row level security;

-- Public-by-membership: authenticated users can discover category servers and channels.
create policy hoop_group_spaces_read on public.hoop_group_spaces for select to authenticated using (true);
create policy hoop_group_channels_read on public.hoop_group_channels for select to authenticated using (true);
create policy hoop_group_members_read_self on public.hoop_group_members for select to authenticated
  using (user_id=(select auth.uid()));
create policy hoop_group_members_join_self on public.hoop_group_members for insert to authenticated
  with check (user_id=(select auth.uid()));
create policy hoop_group_members_leave_self on public.hoop_group_members for delete to authenticated
  using (user_id=(select auth.uid()));
create policy hoop_group_blocks_read_self on public.hoop_group_blocks for select to authenticated
  using (blocker_id=(select auth.uid()));
create policy hoop_group_blocks_insert_self on public.hoop_group_blocks for insert to authenticated
  with check(blocker_id=(select auth.uid()));
create policy hoop_group_blocks_delete_self on public.hoop_group_blocks for delete to authenticated
  using(blocker_id=(select auth.uid()));

-- Only members may read posts; new posts are ALWAYS pending until approved by
-- an independently reviewed moderation workflow. No client UPDATE grant.
create policy hoop_group_posts_read_visible on public.hoop_group_posts for select to authenticated using (
  exists (
    select 1 from public.hoop_group_channels c
    join public.hoop_group_members m on m.space_id=c.space_id
    where c.id=channel_id and m.user_id=(select auth.uid())
  ) and (moderation_status='approved' or author_id=(select auth.uid())) and
  not exists (select 1 from public.hoop_group_blocks b
    where b.blocker_id=(select auth.uid()) and b.blocked_id=author_id)
);
create policy hoop_group_posts_insert_pending on public.hoop_group_posts for insert to authenticated with check (
  author_id=(select auth.uid()) and moderation_status='pending'
  and posting_slot = floor(extract(epoch from now()) / 20)::bigint
  and created_at between now() - interval '10 seconds' and now() + interval '10 seconds'
  and
  exists(select 1 from public.hoop_group_channels c
    join public.hoop_group_members m on m.space_id=c.space_id
    where c.id=channel_id and m.user_id=(select auth.uid()))
);
create policy hoop_group_reports_read_self on public.hoop_group_reports for select to authenticated
  using(reporter_id=(select auth.uid()));
create policy hoop_group_reports_insert_self on public.hoop_group_reports for insert to authenticated
  with check(reporter_id=(select auth.uid()) and exists (
    select 1 from public.hoop_group_posts p where p.id=post_id
  ));

revoke all on public.hoop_group_spaces,public.hoop_group_channels,public.hoop_group_members,
  public.hoop_group_posts,public.hoop_group_reports,public.hoop_group_blocks from anon,authenticated;
grant select on public.hoop_group_spaces,public.hoop_group_channels to authenticated;
grant select,insert,delete on public.hoop_group_members,public.hoop_group_blocks to authenticated;
grant select,insert on public.hoop_group_posts,public.hoop_group_reports to authenticated;

insert into public.hoop_group_spaces(slug,name,category,description) values
 ('world-basketball','World Basketball','global','Global league discussion and basketball conversations'),
 ('players-network','Players Network','players','Career experiences and player-to-player basketball talk'),
 ('fans-courtside','Fans Courtside','fans','Fan discussions across clubs and countries'),
 ('coaches-corner','Coaches Corner','coaches','Coaching ideas, clinics and basketball development'),
 ('scouting-room','Scouting Room','agents','Basketball opportunities and professional networking'),
 ('womens-hoops','Women’s Hoops','womens','Women’s basketball around the world')
on conflict (slug) do nothing;

insert into public.hoop_group_channels(space_id,slug,name,sort_index)
select s.id, c.slug, c.name, c.sort_index from public.hoop_group_spaces s
cross join (values ('welcome','welcome',0),('general','general',1),('game-talk','game-talk',2)) as c(slug,name,sort_index)
where s.slug in ('world-basketball','players-network','fans-courtside','coaches-corner','scouting-room','womens-hoops')
on conflict(space_id,slug) do nothing;
commit;
