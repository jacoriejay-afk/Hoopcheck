-- Align fan-feed premium access with current subscription billing periods.
CREATE OR REPLACE FUNCTION public.can_view_fan_feed_post(p_post_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.fan_feed_posts fp
    join public.profiles viewer on viewer.id=(select auth.uid()) and viewer.account_type='fan'
    join public.subscriptions sub on sub.user_id=viewer.id
    where fp.id=p_post_id and fp.status='approved' and fp.expires_at>now()
      and sub.plan in ('pro','premium') and sub.status in ('active','trialing')
        and (sub.current_period_end is null or sub.current_period_end > now())
      and coalesce(sub.access_status,'active') in ('active','trialing','pro','premium')
      and (
        fp.author_id=viewer.id
        or exists(select 1 from public.follow_relationships fr where fr.follower_id=viewer.id and fr.target_type='fan' and fr.target_id=fp.author_id)
        or exists(select 1 from public.follow_relationships tr where tr.follower_id=viewer.id and tr.target_type='team' and tr.target_id=fp.team_id)
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_fan_team_hub_posts(p_team_id uuid, p_womens_team_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, author_id uuid, body text, image_url text, created_at timestamp with time zone, expires_at timestamp with time zone, display_name text, avatar_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        and (sub.current_period_end is null or sub.current_period_end > now())
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

