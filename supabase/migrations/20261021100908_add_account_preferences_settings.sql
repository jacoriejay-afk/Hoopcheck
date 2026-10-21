alter table public.profiles
  add column if not exists theme_preference text not null default 'system',
  add column if not exists preferred_language text not null default 'en',
  add column if not exists notification_preferences jsonb not null default '{"game_chat_alerts":true,"new_follower":true,"team_reviews":true,"hoopfeed_activity":true}'::jsonb;

alter table public.profiles
  drop constraint if exists profiles_theme_preference_check,
  drop constraint if exists profiles_preferred_language_check;

alter table public.profiles
  add constraint profiles_theme_preference_check
    check (theme_preference in ('system','light','dark')),
  add constraint profiles_preferred_language_check
    check (preferred_language in ('en','es','fr','de','tr','pt','it','el','ar'));
