-- REVIEW ONLY. DO NOT APPLY TO PRODUCTION.
-- Per-message receipts avoid losing unread messages approved after a cursor.
-- Existing post RLS remains authoritative; no publication or moderator grant.
begin;
create table public.hoop_group_post_reads (
 user_id uuid not null references auth.users(id) on delete cascade,
 post_id uuid not null references public.hoop_group_posts(id) on delete cascade,
 read_at timestamptz not null default now(),
 primary key(user_id,post_id)
);
alter table public.hoop_group_post_reads enable row level security;
revoke all on public.hoop_group_post_reads from public,anon,authenticated;
grant select,insert(user_id,post_id) on public.hoop_group_post_reads to authenticated;
create policy group_reads_select_self on public.hoop_group_post_reads for select to authenticated
 using(user_id=(select auth.uid()) and exists(select 1 from public.hoop_group_posts p where p.id=post_id and p.moderation_status='approved'));
create policy group_reads_insert_self on public.hoop_group_post_reads for insert to authenticated
 with check(user_id=(select auth.uid()) and public.confirm_active_account_session() and exists(
 select 1 from public.hoop_group_posts p where p.id=post_id and p.moderation_status='approved'
 and p.author_id<>(select auth.uid()) and not exists(select 1 from public.user_blocks b where b.blocker_id=(select auth.uid()) and b.blocked_id=p.author_id)));
create index hoop_group_post_reads_post_idx on public.hoop_group_post_reads(post_id);
create or replace function public.hoop_group_unread_counts(p_space uuid)
returns table(channel_id uuid, unread_count bigint)
language plpgsql security invoker set search_path=''
as $$
begin
 if auth.uid() is null or not public.confirm_active_account_session() or not exists(
 select 1 from public.hoop_group_members m where m.space_id=p_space and m.user_id=auth.uid()) then
 raise exception 'Group unavailable' using errcode='42501'; end if;
 return query select c.id,count(p.id) from public.hoop_group_channels c
 left join public.hoop_group_posts p on p.channel_id=c.id and p.moderation_status='approved'
 and p.author_id<>auth.uid()
 and not exists(select 1 from public.user_blocks b where b.blocker_id=auth.uid() and b.blocked_id=p.author_id)
 and not exists(select 1 from public.hoop_group_post_reads r where r.user_id=auth.uid() and r.post_id=p.id)
 where c.space_id=p_space group by c.id;
end $$;
revoke all on function public.hoop_group_unread_counts(uuid) from public,anon,authenticated;
grant execute on function public.hoop_group_unread_counts(uuid) to authenticated;
create or replace function public.mark_hoop_group_posts_read(p_channel uuid,p_posts uuid[])
returns integer language plpgsql security invoker set search_path=''
as $$
declare matched integer;
begin
 if auth.uid() is null or not public.confirm_active_account_session() or p_posts is null or cardinality(p_posts)>100
 or not exists(select 1 from public.hoop_group_channels c join public.hoop_group_members m on m.space_id=c.space_id where c.id=p_channel and m.user_id=auth.uid()) then
 raise exception 'Group unavailable' using errcode='42501'; end if;
 insert into public.hoop_group_post_reads(user_id,post_id)
 select auth.uid(),p.id from public.hoop_group_posts p
 where p.channel_id=p_channel and p.id=any(p_posts) and p.moderation_status='approved' and p.author_id<>auth.uid()
 and not exists(select 1 from public.user_blocks b where b.blocker_id=auth.uid() and b.blocked_id=p.author_id)
 on conflict(user_id,post_id) do nothing;
 get diagnostics matched=row_count;
 return matched;
end $$;
revoke all on function public.mark_hoop_group_posts_read(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.mark_hoop_group_posts_read(uuid,uuid[]) to authenticated;
-- No data or publication activation. Use disposable PostgreSQL 17 verification
-- of both users, RLS, revocation, late moderation and concurrent receipt writes.
commit;
