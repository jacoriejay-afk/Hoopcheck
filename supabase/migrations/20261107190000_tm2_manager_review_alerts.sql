-- TM-2: manager-specific review alerts. Follower alerts remain independent.
create table if not exists public.team_manager_alert_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  new_review boolean not null default true,
  review_moderation boolean not null default true,
  join_batch boolean not null default false,
  flagged_post boolean not null default true,
  roster_dispute boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, team_id)
);
alter table public.team_manager_alert_preferences enable row level security;
revoke all on public.team_manager_alert_preferences from anon;
grant select,insert,update on public.team_manager_alert_preferences to authenticated;
drop policy if exists "manager alert prefs own approved club" on public.team_manager_alert_preferences;
create policy "manager alert prefs own approved club" on public.team_manager_alert_preferences
for all to authenticated
using (user_id=auth.uid() and exists (
  select 1 from public.profile_claim_requests c
  where c.requester_id=auth.uid() and c.entity_type='team'
    and c.entity_id=team_id and c.status='approved'
))
with check (user_id=auth.uid() and exists (
  select 1 from public.profile_claim_requests c
  where c.requester_id=auth.uid() and c.entity_type='team'
    and c.entity_id=team_id and c.status='approved'
));

create or replace function public.notify_approved_team_managers_of_review()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  if new.team_id is null or new.status <> 'approved' then return new; end if;
  if tg_op='UPDATE' and old.status='approved' then return new; end if;
  insert into public.notifications(user_id,target_type,target_id,notification_type,title,body)
  select distinct c.requester_id,'team',new.team_id,'review',
    'New review on your club','A published club review is awaiting your official response.'
  from public.profile_claim_requests c
  left join public.team_manager_alert_preferences pref
    on pref.user_id=c.requester_id and pref.team_id=c.entity_id
  where c.entity_type='team' and c.entity_id=new.team_id and c.status='approved'
    and coalesce(pref.new_review,true)
;
  return new;
end; $$;
drop trigger if exists tm2_review_manager_alert on public.reviews;
create trigger tm2_review_manager_alert after insert or update of status on public.reviews
for each row execute function public.notify_approved_team_managers_of_review();
revoke execute on function public.notify_approved_team_managers_of_review() from public,anon,authenticated;
