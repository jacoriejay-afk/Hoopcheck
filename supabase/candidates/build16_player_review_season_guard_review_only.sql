-- REVIEW ONLY: depends on build16_player_team_season_claims_review_only.sql.
-- Never apply to a hosted database. Coordinate API/UI cutover and legacy duplicate
-- preflight before activation. Existing reviews are not retroactively verified.
begin;
alter table public.womens_team_reviews add column if not exists player_season text;

-- Canonical season: YYYY for calendar seasons, YYYY-YYYY for spanning seasons.
-- Inline, caller-visible RLS lookup: no privileged RPC and no self-approval.
create policy "team reviews exact verified season guard"
on public.reviews as restrictive for insert to authenticated
with check (
 author_id = (select auth.uid()) and status = 'pending'
 and private.is_active_subscriber()
 and exists (select 1 from public.profiles p where p.id = (select auth.uid())
   and p.account_type = 'player' and p.player_verified is true)
 and (team_id is null or exists (
   select 1 from public.player_team_season_claims c
   where c.player_id = (select auth.uid()) and c.team_id = reviews.team_id
     and c.verification_status = 'verified'
     and reviews.player_season = case when c.season_start_year = c.season_end_year
       then c.season_start_year::text else c.season_start_year::text || '-' || c.season_end_year::text end
 ))
);
-- Replace both known selected-team policies atomically. Other restrictive policies
-- remain in place; reconcile any additional legacy policy in the full-schema rehearsal.
drop policy "womens reviews paid verified player insert" on public.womens_team_reviews;
drop policy "womens reviews paid verified player insert guard" on public.womens_team_reviews;
create policy "womens reviews paid player insert" on public.womens_team_reviews
for insert to authenticated with check (author_id = (select auth.uid()) and status = 'pending');
create policy "womens reviews verified season guard" on public.womens_team_reviews
as restrictive for insert to authenticated with check (
 author_id = (select auth.uid()) and status = 'pending'
 and private.is_active_subscriber()
 and exists (select 1 from public.profiles p where p.id = (select auth.uid())
   and p.account_type = 'player' and p.basketball_type = 'womens' and p.player_verified is true)
 and exists (
   select 1 from public.player_team_season_claims c
   where c.player_id = (select auth.uid()) and c.womens_team_id = womens_team_reviews.womens_team_id
     and c.verification_status = 'verified'
     and womens_team_reviews.player_season = case when c.season_start_year = c.season_end_year
       then c.season_start_year::text else c.season_start_year::text || '-' || c.season_end_year::text end
 )
);
-- Transaction fails rather than silently deleting or rewriting historical duplicates.
-- Resolve pre-existing collisions and noncanonical historical seasons explicitly.
create unique index reviews_one_active_team_season on public.reviews(author_id,team_id,player_season)
 where team_id is not null and status in ('pending','approved');
create unique index womens_reviews_one_active_team_season on public.womens_team_reviews(author_id,womens_team_id,player_season)
 where player_season is not null and status in ('pending','approved');

-- Existing pending-author update policy must not allow rewriting a review target or season.
create function public.guard_review_scope_immutable() returns trigger
language plpgsql security invoker set search_path = pg_catalog as $$
begin
 if new.author_id is distinct from old.author_id or new.player_season is distinct from old.player_season
   or (tg_table_name = 'reviews' and (
     to_jsonb(new)->'team_id' is distinct from to_jsonb(old)->'team_id'
     or to_jsonb(new)->'coach_id' is distinct from to_jsonb(old)->'coach_id'
     or to_jsonb(new)->'league_id' is distinct from to_jsonb(old)->'league_id'))
   or (tg_table_name = 'womens_team_reviews' and
     to_jsonb(new)->'womens_team_id' is distinct from to_jsonb(old)->'womens_team_id')
 then raise exception 'Review author, target and season are immutable' using errcode = '42501'; end if;
 return new;
end $$;
revoke all on function public.guard_review_scope_immutable() from public, anon, authenticated;
create trigger guard_review_scope_immutable before update on public.reviews
for each row execute function public.guard_review_scope_immutable();
create trigger guard_womens_review_scope_immutable before update on public.womens_team_reviews
for each row execute function public.guard_review_scope_immutable();
commit;
