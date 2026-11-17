-- Read-only policy definition verification. Run after applying bookmark migration.
-- Does not replace authenticated positive/negative authorization tests.
do $$
declare p record;
begin
  select cmd, roles, with_check into p
  from pg_policies
  where schemaname='public' and tablename='feed_post_bookmarks'
    and policyname='feed bookmarks insert own';
  if not found or p.cmd <> 'INSERT'
     or not ('authenticated' = any(p.roles))
     or position('auth.uid()' in coalesce(p.with_check,'')) = 0
     or position('can_view_player_feed_post' in coalesce(p.with_check,'')) > 0
     or position('expires_at' in coalesce(p.with_check,'')) > 0
     or position('approved' in coalesce(p.with_check,'')) = 0
  then
    raise exception 'Bookmark insert policy must enforce ownership and visible approved permanent post';
  end if;
  if (select count(*) from pg_policies
      where schemaname='public' and tablename='feed_post_bookmarks'
        and cmd='INSERT') <> 1 then
    raise exception 'Unexpected additional bookmark INSERT policies';
  end if;
  if not exists (
    select 1 from pg_class
    where oid = 'public.feed_post_bookmarks'::regclass and relrowsecurity
  ) then
    raise exception 'Bookmarks RLS must be enabled';
  end if;
  if (select count(*) from pg_policies
      where schemaname='public' and tablename='feed_post_bookmarks') <> 3 then
    raise exception 'Unexpected bookmark policies; inspect permissive policy overlap';
  end if;
end $$;
