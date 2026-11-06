-- FOL-1: fan career tracking is deliberately isolated from follow_relationships.
-- It must never participate in player HoopFeed visibility or interaction policies.

create table if not exists public.fan_player_career_follows (
  fan_id uuid not null references public.profiles(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  notify_team_changes boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (fan_id, player_id),
  constraint fan_player_career_follow_not_self check (fan_id <> player_id)
);
create index if not exists fan_player_career_follows_player_idx
  on public.fan_player_career_follows(player_id, fan_id);

alter table public.fan_player_career_follows enable row level security;
revoke all on public.fan_player_career_follows from anon;
grant select, insert, update, delete on public.fan_player_career_follows to authenticated;

drop policy if exists "fans read own career follows" on public.fan_player_career_follows;
create policy "fans read own career follows"
on public.fan_player_career_follows for select to authenticated
using (
  fan_id = (select auth.uid())
  and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_type='fan')
);
drop policy if exists "fans create own career follows" on public.fan_player_career_follows;
create policy "fans create own career follows"
on public.fan_player_career_follows for insert to authenticated
with check (
  fan_id = (select auth.uid())
  and exists(select 1 from public.profiles f where f.id=(select auth.uid()) and f.account_type='fan')
  and exists(select 1 from public.profiles p where p.id=player_id and p.account_type='player')
);
drop policy if exists "fans update own career follow alerts" on public.fan_player_career_follows;
create policy "fans update own career follow alerts"
on public.fan_player_career_follows for update to authenticated
using (fan_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_type='fan'))
with check (fan_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_type='fan'));
drop policy if exists "fans unfollow own career follows" on public.fan_player_career_follows;
create policy "fans unfollow own career follows"
on public.fan_player_career_follows for delete to authenticated
using (fan_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_type='fan'));

-- Add a player destination to the existing notification system without dropping
-- any notification types introduced by earlier feature migrations.
alter table public.notifications drop constraint if exists notifications_target_type_check;
alter table public.notifications add constraint notifications_target_type_check
  check (target_type in ('team','coach','league','game','player'));

alter table public.notifications drop constraint if exists notifications_notification_type_check;
alter table public.notifications add constraint notifications_notification_type_check
  check (notification_type in (
    'review','rating','update','trust_score','roster_spot','pay_warning',
    'game_reminder','group_request','group_approved','group_report','player_team_change'
  ));

-- A directory current-team change sends an alert to fans who explicitly opted
-- into career tracking. Removing the relationship immediately stops future alerts.
create or replace function public.notify_fan_player_team_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_team text;
  new_team text;
  player_label text;
begin
  if new.account_type <> 'player' or new.current_team is not distinct from old.current_team then
    return new;
  end if;

  old_team := nullif(trim(old.current_team), '');
  new_team := nullif(trim(new.current_team), '');
  player_label := coalesce(nullif(trim(new.display_name), ''), 'A player you follow');

  insert into public.notifications(user_id,target_type,target_id,notification_type,title,body)
  select f.fan_id, 'player', new.id, 'player_team_change',
    case when new_team is not null
      then player_label || ' has signed with ' || new_team
      else player_label || ' has left ' || coalesce(old_team, 'their previous team')
    end,
    case when new_team is not null
      then player_label || ' is now listed with ' || new_team || ' in the HoopCheck directory.'
      else player_label || ' is no longer listed with ' || coalesce(old_team, 'their previous team') || '.'
    end
  from public.fan_player_career_follows f
  left join public.user_preferences prefs on prefs.user_id=f.fan_id
  where f.player_id=new.id
    and f.notify_team_changes=true
    and coalesce(prefs.notifications_enabled,true)=true;

  return new;
end;
$$;
drop trigger if exists profiles_notify_fan_player_team_change on public.profiles;
create trigger profiles_notify_fan_player_team_change
after update of current_team on public.profiles
for each row execute function public.notify_fan_player_team_change();
revoke all on function public.notify_fan_player_team_change() from public, anon, authenticated;

-- A safe list RPC returns directory-facing profile data only.
create or replace function public.get_fan_career_following()
returns table (
  player_id uuid,
  display_name text,
  avatar_url text,
  current_team text,
  current_country text,
  followed_at timestamptz,
  notify_team_changes boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.avatar_url, p.current_team, p.current_country,
         f.created_at, f.notify_team_changes
  from public.fan_player_career_follows f
  join public.profiles viewer on viewer.id=(select auth.uid()) and viewer.account_type='fan'
  join public.profiles p on p.id=f.player_id and p.account_type='player'
  where f.fan_id=(select auth.uid())
  order by f.created_at desc;
$$;
revoke all on function public.get_fan_career_following() from public, anon;
grant execute on function public.get_fan_career_following() to authenticated;

-- Explicitly document the feed boundary: neither player feed reads nor feed
-- interaction authorization consult this career-follow table. Existing
-- feed_posts / feed_comments policies remain unchanged.
