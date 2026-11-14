-- Keep all current profile projections available except private identity data.
-- Table-wide SELECT overrides per-column privileges, so replace it explicitly.
revoke select on public.profiles from public, anon, authenticated;
revoke select (birthdate, stripe_identity_verification_session_id)
  on public.profiles from public, anon, authenticated;

do $$
declare
  visible_columns text;
begin
  select string_agg(quote_ident(attname), ', ' order by attnum)
    into visible_columns
  from pg_attribute
  where attrelid = 'public.profiles'::regclass
    and attnum > 0 and not attisdropped
    and attname not in ('birthdate', 'stripe_identity_verification_session_id');

  execute format('grant select (%s) on public.profiles to anon, authenticated', visible_columns);
end $$;

-- The existing HoopFeed API authenticates and moderates every comment and reply.
-- Direct Data API writes must not bypass that path.
drop policy if exists "unified hoopfeed comments insert" on public.feed_post_comments;
revoke insert on public.feed_post_comments from public, anon, authenticated;
