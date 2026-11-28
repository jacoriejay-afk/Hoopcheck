-- REVIEW ONLY. DO NOT APPLY TO PRODUCTION.
-- Add structured parent references without copying another author's body.
begin;
alter table public.hoop_group_posts add column reply_to_id uuid,add column was_reply boolean not null default false;
alter table public.hoop_group_posts add constraint hoop_group_posts_channel_id_unique unique(channel_id,id);
alter table public.hoop_group_posts add constraint hoop_group_posts_reply_same_channel
 foreign key(channel_id,reply_to_id) references public.hoop_group_posts(channel_id,id) on delete set null(reply_to_id);
alter table public.hoop_group_posts add constraint hoop_group_posts_reply_not_self check(reply_to_id is null or (reply_to_id<>id and was_reply));
create index hoop_group_posts_reply_idx on public.hoop_group_posts(reply_to_id) where reply_to_id is not null;
create function public.validate_hoop_group_reply() returns trigger
 language plpgsql security invoker set search_path=''
as $$
begin
 new.was_reply:=new.reply_to_id is not null;
 if new.reply_to_id is not null then
  if auth.uid() is null or new.author_id<>auth.uid() or public.confirm_active_account_session() is distinct from true
   or not exists(select 1 from public.hoop_group_posts p where p.id=new.reply_to_id and p.channel_id=new.channel_id
     and p.moderation_status='approved' and not exists(select 1 from public.user_blocks b where b.blocker_id=auth.uid() and b.blocked_id=p.author_id))
  then raise exception 'Reply parent unavailable' using errcode='42501'; end if;
 end if;
 return new;
end $$;
revoke all on function public.validate_hoop_group_reply() from public,anon,authenticated;
create trigger hoop_group_reply_before_insert before insert on public.hoop_group_posts for each row execute function public.validate_hoop_group_reply();
-- Existing post SELECT/INSERT policies, pending moderation and slow mode still apply.
-- No notification trigger until its delivery/visibility contract is independently reviewed.
commit;
