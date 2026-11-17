-- Apply the same viewer boundary to original posts and every source in a reshare chain.
create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_no_self_block check (blocker_id <> blocked_id)
);
alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from public, anon, authenticated;
grant select, insert, delete on public.user_blocks to authenticated;
create policy "user blocks own select" on public.user_blocks
for select to authenticated using (blocker_id = (select auth.uid()));
create policy "user blocks own insert" on public.user_blocks
for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy "user blocks own delete" on public.user_blocks
for delete to authenticated using (blocker_id = (select auth.uid()));

-- The private helper can check an author's account type and reverse blocks without
-- exposing private profile rows or a list of people who have blocked the viewer.
create or replace function private.hoopfeed_can_read_author(p_author_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null
    and not exists (
      select 1 from public.user_blocks block
      where (block.blocker_id = auth.uid() and block.blocked_id = p_author_id)
         or (block.blocker_id = p_author_id and block.blocked_id = auth.uid())
    )
    and (
      p_author_id = auth.uid()
      or public.is_current_user_admin_or_moderator()
      or exists (
        select 1 from public.follow_relationships follow
        join public.profiles author on author.id = follow.target_id
        where follow.follower_id = auth.uid()
          and follow.target_id = p_author_id
          and follow.target_type in ('player', 'fan')
          and follow.target_type = author.account_type
      )
    );
$$;
revoke all on function private.hoopfeed_can_read_author(uuid) from public, anon;
grant execute on function private.hoopfeed_can_read_author(uuid) to authenticated;

-- Use the underlying rows inside this private helper to avoid recursive feed RLS.
-- UNION terminates on cycles, which fail closed because no original is reached.
create or replace function private.hoopfeed_can_read_reshare_source(p_source_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  with recursive sources as (
    select post.id, post.shared_post_id, post.author_id, post.status, post.expires_at
    from public.feed_posts post where post.id = p_source_id
    union
    select post.id, post.shared_post_id, post.author_id, post.status, post.expires_at
    from public.feed_posts post join sources on sources.shared_post_id = post.id
  )
  select coalesce(bool_or(shared_post_id is null), false)
    and coalesce(bool_and(
      status = 'approved'
      and (expires_at is null or expires_at > now())
      and private.hoopfeed_can_read_author(author_id)
    ), false)
  from sources;
$$;
revoke all on function private.hoopfeed_can_read_reshare_source(uuid) from public, anon;
grant execute on function private.hoopfeed_can_read_reshare_source(uuid) to authenticated;

alter policy "unified hoopfeed approved posts read"
on public.feed_posts to authenticated
using (
  (
    status = 'approved'
    and (expires_at is null or expires_at > now())
    and (select public.can_use_unified_hoopfeed())
    and private.hoopfeed_can_read_author(author_id)
    and (shared_post_id is null or private.hoopfeed_can_read_reshare_source(shared_post_id))
  )
  or (
    status <> 'approved'
    and (
      author_id = (select auth.uid())
      or (select public.is_current_user_admin_or_moderator())
    )
  )
);
