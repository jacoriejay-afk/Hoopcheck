-- Persist a fan's preferred basketball side without altering follows, account type, or membership tier.
alter table public.profiles
  add column if not exists preferred_basketball_side text
  check (preferred_basketball_side in ('mens','womens'));

comment on column public.profiles.preferred_basketball_side is
  'Fan UI scope preference only; does not alter account type, followed teams, or membership tier.';
