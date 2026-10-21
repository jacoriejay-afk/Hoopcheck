-- HoopFeed topic tags. Existing posts remain untagged and continue rendering.
alter table public.feed_posts
  add column if not exists topic_tag text;

alter table public.feed_posts
  drop constraint if exists feed_posts_topic_tag_check;

alter table public.feed_posts
  add constraint feed_posts_topic_tag_check
  check (topic_tag is null or topic_tag in (
    'Practice', 'Game Day', 'Travel', 'Teammates', 'Culture', 'Win', 'Challenge'
  ));

create index if not exists feed_posts_topic_tag_created_at_idx
  on public.feed_posts (topic_tag, created_at desc)
  where topic_tag is not null;
