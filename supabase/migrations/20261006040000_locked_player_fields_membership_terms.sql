-- Lockable player profile fields, account types, and membership access state.
alter table public.profiles drop constraint if exists profiles_account_type_check;
alter table public.profiles add constraint profiles_account_type_check check (account_type in ('player','coach','scout','agent','fan'));
alter table public.profiles add column if not exists username text;
create unique index if not exists profiles_username_lower_uidx on public.profiles(lower(username)) where username is not null;
alter table public.profiles drop constraint if exists profiles_position_check;
alter table public.profiles add constraint profiles_position_check check (position is null or position in ('PG','SG','SF','PF','C'));
alter table public.profiles drop constraint if exists profiles_years_pro_check;
alter table public.profiles add constraint profiles_years_pro_check check (years_pro is null or (years_pro >= 0 and years_pro <= 25));
alter table public.subscriptions add column if not exists billing_interval text not null default 'month' check (billing_interval in ('month','6_month','year'));
alter table public.subscriptions add column if not exists access_status text not null default 'free' check (access_status in ('free','pro','premium'));
update public.subscriptions set access_status=case when status in ('active','trialing') then plan else 'free' end;
