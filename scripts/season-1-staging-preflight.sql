-- SEASON-1 staging preflight (read-only). Run before applying migrations.
-- A restored historical test project may lack columns expected by the
-- current production schema. Do not add guessed columns just to pass tests.
WITH required(table_name,column_name) AS (
 VALUES
 ('leagues','id'), ('leagues','name'), ('leagues','country'), ('leagues','season'),
 ('fan_live_games','id'), ('fan_live_games','league_id'),
 ('fan_live_games','provider_source'), ('fan_live_games','provider_game_id'),
 ('fan_live_games','scheduled_at'), ('fan_live_games','started_at'),
 ('fan_live_games','ends_at'), ('fan_live_games','status')
), missing AS (
 SELECT r.table_name,r.column_name
 FROM required r LEFT JOIN information_schema.columns c
   ON c.table_schema='public' AND c.table_name=r.table_name
  AND c.column_name=r.column_name
 WHERE c.column_name IS NULL
)
SELECT table_name,column_name AS missing_required_column
FROM missing ORDER BY table_name,column_name;
-- Empty result is required before staging migrations can be considered valid.
