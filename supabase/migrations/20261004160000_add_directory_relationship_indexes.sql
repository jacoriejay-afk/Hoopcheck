-- Relationship indexes for the worldwide directory.
-- Teams belong to leagues; coaches can be associated with their current team.
-- These indexes keep team/coach lookups fast as the directory grows.

create index if not exists teams_league_id_idx
  on public.teams(league_id);

create index if not exists coaches_current_team_id_idx
  on public.coaches(current_team_id);
