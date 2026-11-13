-- SUB-1 Part A (staged only): cross-platform, one-time trial reservation.
-- Do not deploy until webhook synchronization and checkout are integrated.
alter table public.subscriptions
  add column if not exists trial_end timestamptz,
  add column if not exists trial_used boolean not null default false;

create table if not exists public.subscription_trial_history (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_platform text not null check (first_platform in ('web', 'ios', 'android')),
  first_product_id text not null,
  reserved_at timestamptz not null default now()
);

-- Existing subscribers must never become first-time trial eligible merely
-- because this table is introduced after their original purchase.
insert into public.subscription_trial_history (user_id, first_platform, first_product_id)
select s.user_id, 'web', 'legacy-subscription'
from public.subscriptions s
where s.stripe_subscription_id is not null
   or s.trial_used = true
   or s.status in ('active', 'trialing', 'past_due', 'canceled', 'unpaid')
on conflict (user_id) do nothing;

update public.subscriptions s
set trial_used = true
where exists (
  select 1 from public.subscription_trial_history h where h.user_id = s.user_id
)
and s.trial_used = false;

alter table public.subscription_trial_history enable row level security;
revoke all on public.subscription_trial_history from anon, authenticated;
-- Only trusted server-side payment code may reserve a trial.
create or replace function public.reserve_subscription_trial(
  p_user_id uuid, p_platform text, p_product_id text
) returns boolean
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_reserved integer;
begin
  if p_user_id is null
    or p_platform not in ('web', 'ios', 'android')
    or p_product_id not in ('hoopcheck.pro.monthly', 'hoopcheck.premium.monthly') then
    return false;
  end if;
  -- Serialize concurrent reservations for the same account across platforms.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
  -- Refuse existing or previously billed subscriptions.
  if exists (select 1 from public.subscriptions s where s.user_id = p_user_id
    and (s.trial_used or s.stripe_subscription_id is not null
      or s.status in ('active', 'trialing'))) then
    return false;
  end if;
  -- One row per user, permanently; concurrent platform requests serialize
  -- through the unique primary-key constraint.
  insert into public.subscription_trial_history(user_id, first_platform, first_product_id)
  values (p_user_id, p_platform, p_product_id)
  on conflict (user_id) do nothing;
  get diagnostics v_reserved = row_count;
  if v_reserved = 0 then return false; end if;
  insert into public.subscriptions(user_id, status, trial_used)
  values (p_user_id, 'incomplete', true)
  on conflict (user_id) do update set trial_used = true;
  return true;
end;
$$;
revoke all on function public.reserve_subscription_trial(uuid,text,text) from public, anon, authenticated;
grant execute on function public.reserve_subscription_trial(uuid,text,text) to service_role;
