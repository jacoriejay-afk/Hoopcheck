-- SEASON-1: enforce league calendar inside the database, including direct
-- Supabase inserts, presence heartbeats, and realtime reads. No UI bypass.
-- The recurring month/day comparison mirrors lib/league-season.ts.
create or replace function public.fan_live_chat_room_open(p_game_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1
    from public.fan_live_games g
    join public.leagues l on l.id = g.league_id
    cross join lateral (
      select (now() at time zone coalesce(nullif(l.season_time_zone,''),'UTC'))::date as local_day
    ) clock
    cross join lateral (
      select
        extract(month from clock.local_day)::integer * 100 + extract(day from clock.local_day)::integer as today_key,
        l.season_start_month::integer * 100 +
          case when l.season_start_month = 2 and l.season_start_day = 29
            and not (extract(year from clock.local_day)::integer % 4 = 0
              and (extract(year from clock.local_day)::integer % 100 <> 0
                or extract(year from clock.local_day)::integer % 400 = 0))
            then 28 else l.season_start_day::integer end as start_key,
        l.season_end_month::integer * 100 +
          case when l.season_end_month = 2 and l.season_end_day = 29
            and not (extract(year from clock.local_day)::integer % 4 = 0
              and (extract(year from clock.local_day)::integer % 100 <> 0
                or extract(year from clock.local_day)::integer % 400 = 0))
            then 28 else l.season_end_day::integer end as end_key
    ) bounds
    where g.id = p_game_id
      and l.season_start_month is not null and l.season_end_month is not null
      and (
        (bounds.start_key <= bounds.end_key and bounds.today_key between bounds.start_key and bounds.end_key)
        or (bounds.start_key > bounds.end_key and (bounds.today_key >= bounds.start_key or bounds.today_key <= bounds.end_key))
      )
      and g.status not in ('cancelled','canceled','postponed','abandoned')
      and coalesce(g.scheduled_at,g.started_at) is not null
      and now() >= coalesce(g.scheduled_at,g.started_at) - interval '60 minutes'
      and (
        (g.ends_at is not null and now() < g.ends_at + interval '2 hours')
        or (g.ends_at is null and g.status not in ('final','finished')
            and now() < coalesce(g.scheduled_at,g.started_at) + interval '5 hours')
      )
  );
$$;
revoke all on function public.fan_live_chat_room_open(uuid) from public, anon;
grant execute on function public.fan_live_chat_room_open(uuid) to authenticated;

-- NOTE: Without a recorded ends_at, final games stay closed rather than
-- inventing a final-whistle timestamp. This is intentionally fail-closed.
-- The existing RLS and slow-mode trigger already invoke this function.
-- Consequently the season gate is enforced for inserts and presence, and
-- for message reads under the existing eligible-fans policy.
