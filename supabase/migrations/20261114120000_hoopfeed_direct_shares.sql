-- HOOPFEED-SHARE-1: private references, never copies of post content or media.
-- Production may not have the private helper schema yet.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
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
-- Visibility is limited to the two parties; the recipient sees only a post ID.
-- The original feed_posts RLS still decides whether that post can be opened.
create policy "direct shares own read" on public.hoopfeed_direct_shares
 for select to authenticated
 using (
  (select auth.uid()) in (sender_id,recipient_id)
  and not exists (
    select 1 from public.user_blocks b
    where (b.blocker_id=sender_id and b.blocked_id=recipient_id)
       or (b.blocker_id=recipient_id and b.blocked_id=sender_id)
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
  and exists (
   select 1 from public.follow_relationships f
   join public.profiles p on p.id=f.target_id
   where f.follower_id=sender_id and f.target_id=recipient_id
     and f.target_type in ('player','fan') and f.target_type=p.account_type
  )
  and not exists (
   select 1 from public.user_blocks b
   where (b.blocker_id=sender_id and b.blocked_id=recipient_id)
      or (b.blocker_id=recipient_id and b.blocked_id=sender_id)
  )
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
  if new.sender_id <> (select auth.uid()) then
    raise exception 'Sender does not match authenticated user' using errcode = '42501';
  end if;
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
