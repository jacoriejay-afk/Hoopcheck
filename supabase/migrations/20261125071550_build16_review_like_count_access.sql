-- Match the full review access contract; never expose like counts for hidden reviews.
create or replace function public.get_review_like_count(p_review_id uuid)
returns bigint language sql stable security definer set search_path=''
as $function$
  select count(*)::bigint
  from public.review_likes rl
  where rl.review_id=p_review_id
    and auth.uid() is not null
    and exists (
      select 1 from public.reviews r
      where r.id=p_review_id and (
        r.author_id=auth.uid()
        or private.is_admin_or_moderator()
        or (r.status='approved' and exists (
          select 1 from public.profiles p
          join public.subscriptions s on s.user_id=p.id
          where p.id=auth.uid()
            and p.account_type in ('player','fan','coach','scout','agent','club_admin','manager','admin')
            and s.plan in ('pro','premium')
            and s.status in ('active','trialing')
            and (s.current_period_end is null or s.current_period_end>pg_catalog.now())
            and (p.account_type<>'fan' or s.plan='premium')
        ))
      )
    );
$function$;
revoke execute on function public.get_review_like_count(uuid) from public,anon;
grant execute on function public.get_review_like_count(uuid) to authenticated;
