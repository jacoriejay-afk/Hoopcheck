-- Team Hub RPCs must preserve the same follow and author-role boundaries as the fan-feed RLS policy.
create or replace function public.get_fan_team_hub_posts(
  p_team_id uuid,
  p_womens_team_id uuid default null
)
returns table (
  id uuid,
  author_id uuid,
  body text,
  image_url text,
  created_at timestamptz,
  expires_at timestamptz,
  display_name text,
  avatar_url text
)
language sql
stable
security definer
set search_path = public
as $function$
  select fp.id, fp.author_id, fp.body, fp.image_url, fp.created_at, fp.expires_at,
         author.display_name, author.avatar_url
  from public.fan_feed_posts fp
  join public.profiles author on author.id = fp.author_id and author.account_type = 'fan'
  where (
      (p_womens_team_id is null and fp.team_id = p_team_id)
      or
      (p_womens_team_id is not null and fp.womens_team_id = p_womens_team_id)
    )
    and fp.status = 'approved'
    and fp.expires_at > now()
    and exists (
      select 1
      from public.profiles viewer
      join public.subscriptions sub on sub.user_id = viewer.id
      where viewer.id = (select auth.uid())
        and viewer.account_type = 'fan'
        and sub.plan in ('pro','premium')
        and sub.status in ('active','trialing')
        and coalesce(sub.access_status,'active') in ('active','trialing','pro','premium')
        and exists (
          select 1
          from public.follow_relationships fr
          where fr.follower_id = viewer.id
            and fr.target_type = 'team'
            and fr.target_id = coalesce(fp.team_id, fp.womens_team_id)
        )
    )
  order by fp.created_at desc
  limit 20;
$function$;

-- These RPCs are authenticated fan-group operations; anonymous access is not needed.
revoke all on function public.get_fan_team_hub_posts(uuid,uuid) from public, anon;
grant execute on function public.get_fan_team_hub_posts(uuid,uuid) to authenticated;

revoke all on function public.get_team_fan_group_summary(uuid) from public, anon;
grant execute on function public.get_team_fan_group_summary(uuid) to authenticated;

revoke all on function public.is_team_fan_group_member(uuid,uuid) from public, anon;
grant execute on function public.is_team_fan_group_member(uuid,uuid) to authenticated;

revoke all on function public.is_team_fan_group_moderator(uuid,uuid) from public, anon;
grant execute on function public.is_team_fan_group_moderator(uuid,uuid) to authenticated;

-- Trigger-only SECURITY DEFINER functions are not callable through the public RPC surface.
revoke all on function public.ensure_team_fan_group() from public, anon, authenticated;
revoke all on function public.sync_womens_team_fan_group_mirror() from public, anon, authenticated;
revoke all on function public.transfer_team_fan_group_moderator() from public, anon, authenticated;

-- Avoid per-row re-evaluation of auth.uid() in fan-group RLS policies.
drop policy if exists "members can see own group membership" on public.team_fan_group_members;
create policy "members can see own group membership"
on public.team_fan_group_members
for select to authenticated
using (user_id = (select auth.uid()) or public.is_team_fan_group_moderator(team_id));

drop policy if exists "users can see own join requests or moderators can manage" on public.team_fan_group_join_requests;
create policy "users can see own join requests or moderators can manage"
on public.team_fan_group_join_requests
for select to authenticated
using (user_id = (select auth.uid()) or public.is_team_fan_group_moderator(team_id));

drop policy if exists "reporters and moderators can read reports" on public.team_fan_group_reports;
create policy "reporters and moderators can read reports"
on public.team_fan_group_reports
for select to authenticated
using (reporter_id = (select auth.uid()) or public.is_team_fan_group_moderator(team_id));
