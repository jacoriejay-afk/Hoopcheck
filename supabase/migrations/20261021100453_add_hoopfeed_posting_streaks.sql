-- Persistent daily activity lets HoopFeed posting streaks survive post expiry/deletion.
create table if not exists public.feed_posting_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, activity_date)
);

alter table public.feed_posting_activity enable row level security;
grant select on public.feed_posting_activity to authenticated;

drop policy if exists "Users can read their own HoopFeed posting activity" on public.feed_posting_activity;
create policy "Users can read their own HoopFeed posting activity"
  on public.feed_posting_activity
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists feed_posting_activity_date_idx
  on public.feed_posting_activity (user_id, activity_date desc);
