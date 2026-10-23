-- Tighten all fan feed interactions to the same audience rule as the feed itself.
create or replace function public.can_view_fan_feed_post(p_post_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1
    from public.fan_feed_posts fp
    join public.profiles viewer on viewer.id=(select auth.uid()) and viewer.account_type='fan'
    join public.subscriptions sub on sub.user_id=viewer.id
    where fp.id=p_post_id and fp.status='approved' and fp.expires_at>now()
      and sub.plan in ('pro','premium') and sub.status in ('active','trialing')
      and coalesce(sub.access_status,'active') in ('active','trialing','pro','premium')
      and (
        fp.author_id=viewer.id
        or exists(select 1 from public.follow_relationships fr where fr.follower_id=viewer.id and fr.target_type='fan' and fr.target_id=fp.author_id)
        or exists(select 1 from public.follow_relationships tr where tr.follower_id=viewer.id and tr.target_type='team' and tr.target_id=fp.team_id)
      )
  );
$$;
revoke all on function public.can_view_fan_feed_post(uuid) from public;
grant execute on function public.can_view_fan_feed_post(uuid) to authenticated;

drop policy if exists "fan feed posts visible to fans" on public.fan_feed_posts;
create policy "fan feed posts visible to fans" on public.fan_feed_posts for select to authenticated
using (public.can_view_fan_feed_post(id));
drop policy if exists "fan feed likes visible with post" on public.fan_feed_likes;
create policy "fan feed likes visible with post" on public.fan_feed_likes for select to authenticated
using (public.can_view_fan_feed_post(post_id));
drop policy if exists "fans like fan posts" on public.fan_feed_likes;
create policy "fans like fan posts" on public.fan_feed_likes for insert to authenticated
with check (user_id=(select auth.uid()) and public.can_view_fan_feed_post(post_id));
drop policy if exists "fans remove own likes" on public.fan_feed_likes;
create policy "fans remove own likes" on public.fan_feed_likes for delete to authenticated
using (user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.account_type='fan'));
drop policy if exists "fan feed comments visible with post" on public.fan_feed_comments;
create policy "fan feed comments visible with post" on public.fan_feed_comments for select to authenticated
using (public.can_view_fan_feed_post(post_id));
drop policy if exists "fans comment on fan posts" on public.fan_feed_comments;
create policy "fans comment on fan posts" on public.fan_feed_comments for insert to authenticated
with check (author_id=(select auth.uid()) and public.can_view_fan_feed_post(post_id));
