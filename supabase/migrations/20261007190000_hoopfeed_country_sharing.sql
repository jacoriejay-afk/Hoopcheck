-- HoopCheck: HoopFeed country sharing and pre-publication AI moderation support

alter table public.feed_posts add column if not exists location_country text;
create index if not exists feed_posts_location_country_idx on public.feed_posts(location_country);

-- Only approved, active posts are visible through the existing feed policies.
-- The application performs AI safety screening before inserting approved content.
