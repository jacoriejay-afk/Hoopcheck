-- LIVECHAT-1: align the server-enforced message window with the game chat UI.
-- Important: ends_at must represent a VERIFIED actual final whistle, not an
-- estimated/scheduled end. The provider ingestion does not yet populate it.
-- Therefore final games without a verified ends_at remain closed to writes.
-- No existing fixture or chat records are modified by this migration.

create or replace function public.fan_live_chat_room_open(p_game_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.fan_live_games g
    where g.id = p_game_id
      and (
        (
          lower(g.status) in ('live', 'in_progress')
          and (
            g.scheduled_at is null
            or now() >= g.scheduled_at - interval '60 minutes'
          )
        )
        or (
          lower(g.status) in ('scheduled', 'upcoming')
          and g.scheduled_at is not null
          and now() >= g.scheduled_at - interval '60 minutes'
          and now() < g.scheduled_at + interval '4 hours'
        )
        or (
          lower(g.status) in ('final', 'finished')
          and g.ends_at is not null
          and now() >= g.ends_at
          and now() < g.ends_at + interval '2 hours'
        )
      )
  );
$$;
revoke all on function public.fan_live_chat_room_open(uuid) from public, anon;
grant execute on function public.fan_live_chat_room_open(uuid) to authenticated;

-- Reading historical chat does not imply permission to send. Preserve TIER-1
-- membership and per-user block filters for both live and archived messages.
drop policy if exists "eligible members read live chat" on public.fan_live_chat_messages;
create policy "eligible members read live chat"
on public.fan_live_chat_messages for select to authenticated
using (
  public.is_current_user_admin_or_moderator()
  or (
    public.current_user_has_live_game_membership()
    and not exists (
      select 1
      from public.fan_live_chat_user_controls c
      where c.user_id = (select auth.uid())
        and c.target_user_id = fan_live_chat_messages.user_id
        and c.is_blocked
    )
  )
);

-- Existing insert and presence policies, and the slow-mode trigger, continue
-- calling fan_live_chat_room_open. They therefore inherit the new boundaries.
