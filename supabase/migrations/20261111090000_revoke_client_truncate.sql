-- Revoke table-wide destructive privileges from API client roles.
-- RLS does not apply to TRUNCATE. Preserve SELECT/INSERT/UPDATE/DELETE.
begin;
revoke truncate on table public.fan_connection_requests from anon, authenticated;
revoke truncate on table public.fan_feed_archives from anon, authenticated;
revoke truncate on table public.fan_feed_checks from anon, authenticated;
revoke truncate on table public.fan_feed_comments from anon, authenticated;
revoke truncate on table public.fan_feed_likes from anon, authenticated;
revoke truncate on table public.fan_feed_posts from anon, authenticated;
revoke truncate on table public.fan_live_chat_presence from anon, authenticated;
revoke truncate on table public.fan_live_chat_reports from anon, authenticated;
revoke truncate on table public.fan_live_chat_user_controls from anon, authenticated;
revoke truncate on table public.feed_poll_votes from anon, authenticated;
revoke truncate on table public.feed_post_archives from anon, authenticated;
revoke truncate on table public.feed_post_bookmarks from anon, authenticated;
revoke truncate on table public.feed_posting_activity from anon, authenticated;
revoke truncate on table public.profile_claim_requests from anon, authenticated;
revoke truncate on table public.team_fan_group_comments from anon, authenticated;
revoke truncate on table public.team_fan_group_join_requests from anon, authenticated;
revoke truncate on table public.team_fan_group_members from anon, authenticated;
revoke truncate on table public.team_fan_group_moderators from anon, authenticated;
revoke truncate on table public.team_fan_group_posts from anon, authenticated;
revoke truncate on table public.team_fan_group_reports from anon, authenticated;
revoke truncate on table public.team_fan_groups from anon, authenticated;
commit;
