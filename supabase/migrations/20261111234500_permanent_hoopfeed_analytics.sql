-- Staged only. Keep historical 24-hour activity KPI while adding permanent total.
create or replace function public.get_hoopcheck_kpis() returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare result jsonb;
begin
  if not public.is_current_user_admin_or_moderator() then raise exception 'not authorized'; end if;
  select jsonb_build_object(
    'users_total',(select count(*) from public.profiles),
    'players_total',(select count(*) from public.profiles where account_type='player'),
    'verified_players',(select count(*) from public.profiles where account_type='player' and player_verified=true),
    'paying_users',(select count(*) from public.subscriptions where status in ('active','trialing') and plan in ('pro','premium')),
    'pro_users',(select count(*) from public.subscriptions where status in ('active','trialing') and plan='pro'),
    'premium_users',(select count(*) from public.subscriptions where status in ('active','trialing') and plan='premium'),
    'reviews_total',(select count(*) from public.reviews),
    'reviews_pending',(select count(*) from public.reviews where status='pending'),
    'reviews_legal_review',(select count(*) from public.reviews where legal_review_required=true and status in ('pending','flagged')),
    'teams_active',(select count(*) from public.teams where active=true),
    'leagues_active',(select count(*) from public.leagues where active=true),
    'feed_posts_24h',(select count(*) from public.feed_posts where created_at >= now()-interval '24 hours'),
    'feed_posts_total',(select count(*) from public.feed_posts),
    'open_tickets',(select count(*) from public.support_tickets where status in ('open','in_progress','waiting_on_user')),
    'active_users_7d',(select count(*) from public.profiles where last_seen_at >= now()-interval '7 days'),
    'new_users_7d',(select count(*) from public.profiles where created_at >= now()-interval '7 days'),
    'new_reviews_7d',(select count(*) from public.reviews where created_at >= now()-interval '7 days')
  ) into result;
  return result;
end; $$;
revoke all on function public.get_hoopcheck_kpis() from public;
grant execute on function public.get_hoopcheck_kpis() to authenticated;
