-- LIVECHAT-1: align database-enforced chat lifecycle with the shared
-- application resolver. Membership and moderation RLS remain unchanged.
-- 60 minutes before tip; until 2 hours after a confirmed final end.
create or replace function public.fan_live_chat_room_open(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.fan_live_games g
    where g.id = p_game_id
      and lower(coalesce(g.status, '')) not in
        ('cancelled', 'canceled', 'postponed', 'abandoned')
      and (
        (
          lower(coalesce(g.status, '')) in ('final', 'finished')
          and g.ends_at is not null
          and now() >= g.ends_at
          and now() < g.ends_at + interval '2 hours'
        )
        or (
          lower(coalesce(g.status, '')) not in ('final', 'finished')
          and (
            -- Provider says live, but no reliable tip timestamp exists.
            (lower(g.status) in ('live', 'in_progress')
              and g.scheduled_at is null and g.started_at is null)
            or (
              coalesce(g.scheduled_at, g.started_at) is not null
              and now() >= coalesce(g.scheduled_at, g.started_at) - interval '60 minutes'
              and now() < coalesce(
                g.ends_at + interval '2 hours',
                coalesce(g.scheduled_at, g.started_at) + interval '4 hours'
              )
            )
          )
        )
      )
  );
$$;
revoke all on function public.fan_live_chat_room_open(uuid) from public, anon;
grant execute on function public.fan_live_chat_room_open(uuid) to authenticated;
