-- Ensure the production profile role constraint accepts the dedicated manager account type.
-- The original manager-role migration updated signup/admin functions but omitted this table check.

alter table public.profiles
  drop constraint if exists profiles_account_type_check;

alter table public.profiles
  add constraint profiles_account_type_check
  check (
    account_type = any (
      array['player'::text, 'coach'::text, 'manager'::text, 'scout'::text, 'agent'::text, 'fan'::text]
    )
  );
