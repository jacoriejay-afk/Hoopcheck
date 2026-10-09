-- Apply the same paid-membership and verified-player rules to women's team reviews.
alter table public.womens_team_reviews enable row level security;

-- Remove older INSERT-only policies so they cannot grant broader insert access.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'womens_team_reviews'
      and cmd = 'INSERT'
  loop
    execute format(
      'drop policy if exists %I on public.womens_team_reviews',
      policy_row.policyname
    );
  end loop;
end;
$$;

create policy "womens reviews paid verified player insert"
on public.womens_team_reviews
for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and status = 'pending'
  and private.is_active_subscriber()
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.account_type = 'player'
      and p.basketball_type = 'womens'
      and p.player_verified = true
      and p.selected_womens_team_id = womens_team_id
  )
);

-- A restrictive policy also clamps any legacy permissive ALL policy.
create policy "womens reviews paid verified player insert guard"
on public.womens_team_reviews
as restrictive
for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and status = 'pending'
  and private.is_active_subscriber()
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.account_type = 'player'
      and p.basketball_type = 'womens'
      and p.player_verified = true
      and p.selected_womens_team_id = womens_team_id
  )
);
