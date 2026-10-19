-- Allow the live-game sync to deliver in-app game reminders without
-- rolling out the unrelated trust-score / roster-notification feature set.

alter table public.notifications
  drop constraint if exists notifications_notification_type_check;

alter table public.notifications
  add constraint notifications_notification_type_check
  check (notification_type in ('review', 'rating', 'update', 'game_reminder'));

alter table public.notifications
  drop constraint if exists notifications_target_type_check;

alter table public.notifications
  add constraint notifications_target_type_check
  check (target_type in ('team', 'coach', 'league', 'game'));
