-- REVIEW ONLY. Do not apply to HoopCheck production or the incompatible PR17 test
-- schema without an owner-authorized rehearsal of the exact current schema.
-- This upgrades the EXISTING game / chat / presence tables, not a second system.
-- The source of truth for fixture status is the provider-backed fan_live_games row.
-- Paid Player/Fan Pro/Premium membership and admin moderation stay enforced.
--
-- Prerequisites: fan_live_games, fan_live_chat_messages, chat controls, and
-- public.current_user_has_live_game_membership() installed and verified.
-- Existing room-write slow-mode trigger intentionally remains enabled.

begin;

create or replace function public.fan_live_chat_room_open(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.fan_live_games g
    where g.id = p_game_id
      and g.status not in ('cancelled', 'canceled', 'postponed', 'abandoned')
      and (g.scheduled_at is not null or g.status in ('live', 'in_progress'))
      and (g.scheduled_at is null or now() >= g.scheduled_at - interval '60 minutes')
      and (
        (g.status in ('final', 'finished') and g.ends_at is not null
          and now() < g.ends_at + interval '2 hours')
        or (g.status not in ('final', 'finished') and g.ends_at is not null
          and now() < g.ends_at + interval '2 hours')
        or (g.status not in ('final', 'finished') and g.ends_at is null
          and (g.scheduled_at is null or now() < g.scheduled_at + interval '4 hours'))
      )
  );
$$;
revoke all on function public.fan_live_chat_room_open(uuid) from public, anon;
grant execute on function public.fan_live_chat_room_open(uuid) to authenticated;

-- Room history remains browseable after the writing window closes; this is
-- important for opening any game from the chat directory. RLS still checks
-- active Pro/Premium entitlements and preserves blocked-user visibility.
-- INSERT remains protected by the existing room-open policy plus slow-mode.
drop policy if exists "eligible members read live chat" on public.fan_live_chat_messages;
create policy "eligible members read live chat"
on public.fan_live_chat_messages for select to authenticated
using (
  public.is_current_user_admin_or_moderator()
  or (
    public.current_user_has_live_game_membership()
    and not exists (
      select 1 from public.fan_live_chat_user_controls c
      where c.user_id = (select auth.uid())
        and c.target_user_id = fan_live_chat_messages.user_id
        and c.is_blocked
    )
  )
);

-- Ensure the existing room state, score updates and messages fan out in
-- realtime with RLS enforced; do not enable anonymous write access.
do $body$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='fan_live_games'
  ) then
    alter publication supabase_realtime add table public.fan_live_games;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='fan_live_chat_messages'
  ) then
    alter publication supabase_realtime add table public.fan_live_chat_messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='fan_live_chat_presence'
  ) then
    alter publication supabase_realtime add table public.fan_live_chat_presence;
  end if;
end $body$;

commit;

-- Acceptance gate:
-- - Validate source status and final ends_at semantics with provider fixtures.
-- - Test signed player/fan Free/Pro/Premium and admin, including AAL1/AAL2.
-- - Test scheduled -60m, in-progress, final +0m/+119m/+121m,
--   cancelled/postponed, unknown final end, stale provider status.
-- - Test read after close, INSERT denial after close and blocked-user RLS.
-- - Verify realtime subscriptions and rollback on production-equivalent clone.
-- No automatic production rollout is authorized by this file.
