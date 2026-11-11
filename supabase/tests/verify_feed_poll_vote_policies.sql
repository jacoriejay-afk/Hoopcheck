-- Read-only staging verification for poll-vote RLS migration.
-- Run after applying 20261111000100_secure_feed_poll_votes.sql in staging.
-- This checks policy definitions, not user-specific API authorization.
do $$
declare
  policy_row record;
  predicate text;
begin
  for policy_row in
    select policyname, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename = 'feed_poll_votes'
      and policyname in (
        'feed poll votes read',
        'feed poll votes insert own',
        'feed poll votes update own'
      )
  loop
    predicate := coalesce(policy_row.qual,'') || ' ' || coalesce(policy_row.with_check,'');
    if position('can_view_player_feed_post' in predicate) = 0
       or position('expires_at' in predicate) = 0 then
      raise exception 'Poll policy % (%) lacks visible/unexpired post checks',
        policy_row.policyname, policy_row.cmd;
    end if;
    if policy_row.cmd in ('INSERT','UPDATE')
       and position('auth.uid()' in predicate) = 0 then
      raise exception 'Poll policy % lacks ownership check', policy_row.policyname;
    end if;
  end loop;

  if (select count(*) from pg_policies
      where schemaname='public' and tablename='feed_poll_votes'
        and policyname in ('feed poll votes read','feed poll votes insert own','feed poll votes update own')) <> 3 then
    raise exception 'Expected three secured poll-vote policies';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='feed_poll_votes'
      and policyname='feed poll votes delete own'
      and cmd='DELETE'
      and qual like '%auth.uid()%'
  ) then
    raise exception 'Own-vote delete policy missing';
  end if;
end $$;
