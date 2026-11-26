-- REVIEW ONLY. Do not deploy or register as a migration until the complete
-- target schema, existing moderation paths, and authenticated HTTP tests pass.
-- The new RESTRICTIVE policies intersect existing permissions; they never
-- grant access, membership, role privileges, or room availability.
set local statement_timeout='15s';
set local lock_timeout='4s';
do $guard$
declare rel text;
begin
  foreach rel in array array['user_blocks','player_contact_requests','player_contact_messages','feed_post_comments','hoop_group_posts','fan_live_chat_messages'] loop
    if to_regclass('public.'||rel) is null or not exists (
      select 1 from pg_catalog.pg_class c where c.oid=to_regclass('public.'||rel) and c.relrowsecurity
    ) then raise exception 'POST16 block boundary schema drift: %', rel; end if;
  end loop;
  if to_regnamespace('private') is null then raise exception 'Missing private schema'; end if;
end $guard$;

-- Only the authenticated viewer is ever compared with the supplied peer.
-- A narrowly scoped SECURITY DEFINER lookup is needed for reverse blocks;
-- user_blocks SELECT deliberately exposes only blocks made BY the viewer.
create function private.post16_account_interaction_allowed(p_other_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and p_other_id is not null
    and (p_other_id = auth.uid() or not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id=auth.uid() and b.blocked_id=p_other_id)
         or (b.blocker_id=p_other_id and b.blocked_id=auth.uid())
    ));
$$;
revoke all on function private.post16_account_interaction_allowed(uuid) from public,anon,authenticated;
grant execute on function private.post16_account_interaction_allowed(uuid) to authenticated;

-- Existing contact participant and entitlement policies remain in force.
create policy post16_contact_pair_block_guard on public.player_contact_requests
as restrictive for all to authenticated
using (private.post16_account_interaction_allowed(
  case when requester_id=(select auth.uid()) then player_id when player_id=(select auth.uid()) then requester_id else null end))
with check (private.post16_account_interaction_allowed(
  case when requester_id=(select auth.uid()) then player_id when player_id=(select auth.uid()) then requester_id else null end));

-- Request visibility is itself bilateral and viewer-scoped.
create policy post16_contact_message_block_guard on public.player_contact_messages
as restrictive for all to authenticated
using (exists (select 1 from public.player_contact_requests r
  where r.id=request_id and (r.requester_id=(select auth.uid()) or r.player_id=(select auth.uid()))))
with check (exists (select 1 from public.player_contact_requests r
  where r.id=request_id and (r.requester_id=(select auth.uid()) or r.player_id=(select auth.uid()))));

-- Community reads: keep existing channel membership, approval, room time,
-- and local block/mute rules. These do not authorize access to any post.
create policy post16_feed_comment_block_guard on public.feed_post_comments
as restrictive for select to authenticated
using (private.post16_account_interaction_allowed(author_id));
create policy post16_group_post_block_guard on public.hoop_group_posts
as restrictive for select to authenticated
using (private.post16_account_interaction_allowed(author_id));
create policy post16_live_chat_block_guard on public.fan_live_chat_messages
as restrictive for select to authenticated
using (private.post16_account_interaction_allowed(user_id));
-- Staff review paths must be verified separately before migrating this
-- candidate. Never weaken block rules merely to restore a moderation screen.
