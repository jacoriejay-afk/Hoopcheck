-- Remove inherited legacy Data API grants from the official team FanFeed table.
-- Only the server-side moderation route may insert official team updates.
revoke all on table public.team_fanfeed_posts from anon, authenticated;
grant select, update, delete on table public.team_fanfeed_posts to authenticated;
grant all on table public.team_fanfeed_posts to service_role;
