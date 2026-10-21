-- Optional Game Day matchup and score details for HoopFeed.
alter table public.feed_posts
  add column if not exists game_day_team text,
  add column if not exists game_day_opponent text,
  add column if not exists game_day_score_for integer,
  add column if not exists game_day_score_against integer;

alter table public.feed_posts
  drop constraint if exists feed_posts_game_day_teams_check,
  drop constraint if exists feed_posts_game_day_scores_check;

alter table public.feed_posts
  add constraint feed_posts_game_day_teams_check
    check (
      (game_day_team is null and game_day_opponent is null)
      or
      (length(btrim(game_day_team)) between 1 and 80 and length(btrim(game_day_opponent)) between 1 and 80)
    ),
  add constraint feed_posts_game_day_scores_check
    check (
      (game_day_score_for is null and game_day_score_against is null)
      or
      (game_day_score_for between 0 and 300 and game_day_score_against between 0 and 300
        and game_day_team is not null and game_day_opponent is not null)
    );
