-- Keep moderation states server-controlled and prevent chat timestamp evasion.
alter policy "profile_reports_insert_own" on public.profile_reports
  with check ((select auth.uid())=reporter_id and profile_id<>reporter_id and status='open');
alter policy "review comments own insert" on public.review_comments
  with check ((select auth.uid())=author_id and status='pending');

create or replace function public.enforce_fan_live_chat_slow_mode()
returns trigger language plpgsql security definer set search_path='' as $$
declare prior timestamptz; v_now timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.game_id::text || ':' || new.user_id::text,0));
  if not public.fan_live_chat_room_open(new.game_id) then
    raise exception 'CHAT_CLOSED: Chat is closed for this game.';
  end if;
  v_now := pg_catalog.clock_timestamp();
  new.created_at := v_now;
  select max(created_at) into prior from public.fan_live_chat_messages where game_id=new.game_id and user_id=new.user_id;
  if prior is not null and prior > v_now - interval '2 seconds' then
    raise exception 'SLOW_MODE: Wait two seconds between messages.';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_fan_live_chat_slow_mode() from public,anon,authenticated;
