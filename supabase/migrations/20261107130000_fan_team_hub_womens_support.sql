drop function if exists public.get_fan_team_hub_posts(uuid);

create function public.get_fan_team_hub_posts(
  p_team_id uuid,
  p_womens_team_id uuid default null
)
returns table(
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
  join public.profiles author on author.id = fp.author_id
  where (
      (p_womens_team_id is null and p_team_id is not null and fp.team_id = p_team_id)
      or
      (p_womens_team_id is not null and p_team_id is null and fp.womens_team_id = p_womens_team_id)
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
    )
  order by fp.created_at desc
  limit 20;
$function$;

revoke all on function public.get_fan_team_hub_posts(uuid,uuid) from public;
grant execute on function public.get_fan_team_hub_posts(uuid,uuid) to authenticated;
