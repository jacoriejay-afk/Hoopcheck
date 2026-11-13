-- HOOPFEED-SHARE-1: private references, never copies of post content or media.
-- Production may not have the private helper schema yet.
create schema if not exists private;
-- Preserve schema USAGE for authenticated users: RLS calls private helper functions.
-- Schema USAGE alone does not expose private tables through the Data API.
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
-- Block checks must see both directions, including blocks hidden by user_blocks RLS.
create or replace function private.hoopfeed_share_not_blocked(p_sender uuid,p_recipient uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() in (p_sender,p_recipient)
    and not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id=p_sender and b.blocked_id=p_recipient)
         or (b.blocker_id=p_recipient and b.blocked_id=p_sender)
    );
$$;
revoke all on function private.hoopfeed_share_not_blocked(uuid,uuid) from public,anon;
grant execute on function private.hoopfeed_share_not_blocked(uuid,uuid) to authenticated;

-- Evaluate the recipient's follow graph without changing auth.uid().
-- This does not grant access: feed_posts RLS still controls actual post reads.
create or replace function private.hoopfeed_share_recipient_can_read(p_post uuid,p_recipient uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.feed_posts post
      where post.id=p_post
        and post.status='approved'
        and (post.expires_at is null or post.expires_at>now())
        and not exists (
          select 1 from public.user_blocks b
          where (b.blocker_id=p_recipient and b.blocked_id=post.author_id)
             or (b.blocker_id=post.author_id and b.blocked_id=p_recipient)
        )
        and (
          post.author_id=p_recipient
          or exists (
            select 1 from public.follow_relationships f
            join public.profiles author on author.id=f.target_id
            where f.follower_id=p_recipient
              and f.target_id=post.author_id
              and f.target_type in ('player','fan')
              and f.target_type=author.account_type
          )
        )
        and post.shared_post_id is null
    );
$$;
revoke all on function private.hoopfeed_share_recipient_can_read(uuid,uuid) from public,anon;
grant execute on function private.hoopfeed_share_recipient_can_read(uuid,uuid) to authenticated;

create table public.hoopfeed_direct_shares (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.feed_posts(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 constraint hoopfeed_direct_shares_no_self check (sender_id <> recipient_id),
 constraint hoopfeed_direct_shares_unique unique (post_id,sender_id,recipient_id)
);
create index hoopfeed_direct_shares_recipient_idx on public.hoopfeed_direct_shares(recipient_id,created_at desc);
alter table public.hoopfeed_direct_shares enable row level security;
revoke all on public.hoopfeed_direct_shares from public,anon,authenticated;
grant select,insert,delete on public.hoopfeed_direct_shares to authenticated;
-- Prevent forged primary keys or sender-controlled timestamps via column grants.
revoke insert on public.hoopfeed_direct_shares from authenticated;
grant insert (post_id,sender_id,recipient_id) on public.hoopfeed_direct_shares to authenticated;
-- Visibility is limited to the two parties; the recipient sees only a post ID.
-- The original feed_posts RLS still decides whether that post can be opened.
create policy "direct shares own read" on public.hoopfeed_direct_shares
 for select to authenticated
 using (
  (select auth.uid()) in (sender_id,recipient_id)
  and private.hoopfeed_share_not_blocked(sender_id,recipient_id)
  and private.hoopfeed_share_recipient_can_read(post_id,recipient_id)
  -- A sender or recipient cannot use the inbox to infer a post that is now
  -- expired, moderated, or inaccessible under feed_posts RLS.
  and exists (
    select 1 from public.feed_posts post
    where post.id = post_id
      and post.status = 'approved'
      and (post.expires_at is null or post.expires_at > now())
  )
);
create policy "direct shares sender insert" on public.hoopfeed_direct_shares
 for insert to authenticated
 with check (
  sender_id=(select auth.uid())
  and recipient_id<>sender_id
  and exists (
   select 1 from public.feed_posts post
   where post.id=post_id and post.status='approved'
     and (post.expires_at is null or post.expires_at>now())
  )
  -- Do not send a post to someone who cannot read the original.
  -- Reuse the existing author/reshare access rules with the recipient as viewer
  -- via a dedicated private helper below.
  and private.hoopfeed_share_recipient_can_read(post_id,recipient_id)
  and exists (
   select 1 from public.follow_relationships f
   join public.profiles p on p.id=f.target_id
   where f.follower_id=sender_id and f.target_id=recipient_id
     and f.target_type in ('player','fan') and f.target_type=p.account_type
  )
  and private.hoopfeed_share_not_blocked(sender_id,recipient_id)
 );
create policy "direct shares sender delete" on public.hoopfeed_direct_shares
 for delete to authenticated using (sender_id=(select auth.uid()));
-- No UPDATE permission or policy: delivery records cannot be reassigned.

-- A server-enforced limit prevents bypassing the UI's ten-recipient cap.
-- The transaction advisory lock serializes sends from one sender across sessions.
create or replace function private.hoopfeed_limit_direct_shares()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare recent_minute integer; recent_hour integer;
begin
  if new.sender_id is distinct from auth.uid() then
    raise exception 'Sender does not match authenticated user' using errcode = '42501';
  end if;
  -- The timestamp is server-controlled; clients cannot backdate sends to evade limits.
  new.created_at := pg_catalog.now();
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.sender_id::text, 60114));
  select count(*) filter (where created_at > pg_catalog.now() - interval '1 minute'),
         count(*) filter (where created_at > pg_catalog.now() - interval '1 hour')
    into recent_minute, recent_hour
    from public.hoopfeed_direct_shares
   where sender_id = new.sender_id
     and created_at > pg_catalog.now() - interval '1 hour';
  if recent_minute >= 10 or recent_hour >= 60 then
    raise exception 'Share rate limit exceeded; please try again later' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.hoopfeed_limit_direct_shares() from public,anon,authenticated;
create trigger hoopfeed_direct_share_rate_limit
 before insert on public.hoopfeed_direct_shares
 for each row execute function private.hoopfeed_limit_direct_shares();
