-- Privacy/account-deletion hardening: allow user deletion without breaking retained audit records.
alter table public.coach_team_requests drop constraint if exists coach_team_requests_reviewer_id_fkey;
alter table public.coach_team_requests
  add constraint coach_team_requests_reviewer_id_fkey
  foreign key (reviewer_id) references auth.users(id) on delete set null;

alter table public.directory_team_requests drop constraint if exists directory_team_requests_reviewer_id_fkey;
alter table public.directory_team_requests
  add constraint directory_team_requests_reviewer_id_fkey
  foreign key (reviewer_id) references auth.users(id) on delete set null;

alter table public.player_verification_requests drop constraint if exists player_verification_requests_reviewer_id_fkey;
alter table public.player_verification_requests
  add constraint player_verification_requests_reviewer_id_fkey
  foreign key (reviewer_id) references auth.users(id) on delete set null;

alter table public.profiles drop constraint if exists profiles_moderation_updated_by_fkey;
alter table public.profiles
  add constraint profiles_moderation_updated_by_fkey
  foreign key (moderation_updated_by) references auth.users(id) on delete set null;

alter table public.rights_registry drop constraint if exists rights_registry_approved_by_fkey;
alter table public.rights_registry
  add constraint rights_registry_approved_by_fkey
  foreign key (approved_by) references auth.users(id) on delete set null;

alter table public.rights_registry_events drop constraint if exists rights_registry_events_actor_id_fkey;
alter table public.rights_registry_events
  add constraint rights_registry_events_actor_id_fkey
  foreign key (actor_id) references auth.users(id) on delete set null;

alter table public.review_moderation_events
  alter column actor_id drop not null;
alter table public.review_moderation_events drop constraint if exists review_moderation_events_actor_id_fkey;
alter table public.review_moderation_events
  add constraint review_moderation_events_actor_id_fkey
  foreign key (actor_id) references auth.users(id) on delete set null;
