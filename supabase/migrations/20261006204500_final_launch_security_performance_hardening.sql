-- Final security/performance hardening for launch.
create index if not exists idx_feed_posts_author_id on public.feed_posts(author_id);
create index if not exists idx_profiles_moderation_updated_by on public.profiles(moderation_updated_by);
create index if not exists idx_profiles_selected_team_id on public.profiles(selected_team_id);
create index if not exists idx_profiles_selected_womens_team_id on public.profiles(selected_womens_team_id);
create index if not exists idx_review_comments_author_id on public.review_comments(author_id);
create index if not exists idx_review_likes_user_id on public.review_likes(user_id);
create index if not exists idx_sponsor_inquiries_user_id on public.sponsor_inquiries(user_id);
create index if not exists idx_support_requests_user_id on public.support_requests(user_id);
create index if not exists idx_womens_teams_league_id on public.womens_teams(league_id);

drop policy if exists "subscription_events_admin_read" on public.subscription_events;
create policy "subscription_events_admin_read" on public.subscription_events for select to authenticated using (public.is_current_user_admin_or_moderator());

revoke execute on function public.enforce_player_profile_locks() from anon, authenticated;
revoke execute on function public.can_user_follow_target(uuid,text,uuid) from anon;
revoke execute on function public.get_follow_count(text,uuid) from anon;