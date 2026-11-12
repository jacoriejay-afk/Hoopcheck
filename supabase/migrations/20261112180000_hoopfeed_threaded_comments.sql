-- Threaded HoopFeed replies. Parent must belong to the same post.
alter table public.feed_post_comments
  add column if not exists parent_id uuid references public.feed_post_comments(id) on delete cascade;

create index if not exists feed_post_comments_parent_idx
  on public.feed_post_comments(parent_id, created_at);

create or replace function public.hoopfeed_validate_comment_parent()
returns trigger language plpgsql set search_path = public as $$
declare parent_post uuid;
begin
  if new.parent_id is null then return new; end if;
  if new.parent_id = new.id then raise exception 'A comment cannot reply to itself'; end if;
  select post_id into parent_post from public.feed_post_comments where id = new.parent_id;
  if parent_post is distinct from new.post_id then
    raise exception 'Reply parent must belong to the same post';
  end if;
  return new;
end;
$$;

drop trigger if exists hoopfeed_comment_parent_guard on public.feed_post_comments;
create trigger hoopfeed_comment_parent_guard
before insert or update of parent_id, post_id on public.feed_post_comments
for each row execute function public.hoopfeed_validate_comment_parent();
