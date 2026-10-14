-- Cover the opponent-team foreign key to avoid full scans when a referenced team changes or is deleted.
create index if not exists fan_live_games_opponent_team_id_idx
  on public.fan_live_games (opponent_team_id); 
