-- Restrict manual complimentary membership grants to administrators only.
-- Preserves the existing Stripe-owned subscription guard and membership behavior.
create or replace function public.admin_set_membership(p_user_id uuid, p_plan text)
returns boolean
language plpgsql
security definer
set search_path = 'public'
as $function$
begin
  if auth.uid() is null or not exists (
    select 1 from public.admin_roles ar
    where ar.user_id = (select auth.uid())
      and lower(trim(coalesce(ar.role, ''))) = 'admin'
  ) then
    raise exception 'Only admins can manage memberships' using errcode = '42501';
  end if;

  if p_plan not in ('free', 'pro', 'premium') then
    raise exception 'Invalid membership plan';
  end if;

  if exists (
    select 1 from public.subscriptions s
    where s.user_id = p_user_id
      and nullif(btrim(s.stripe_subscription_id), '') is not null
  ) then
    raise exception 'This membership is linked to Stripe. Manage the subscription through the billing workflow first.';
  end if;

  if p_plan = 'free' then
    update public.subscriptions
    set access_status = 'free', plan = null, status = 'inactive',
        stripe_price_id = null, stripe_subscription_id = null,
        current_period_end = null, cancel_at_period_end = false, updated_at = now()
    where user_id = p_user_id;
  else
    insert into public.subscriptions (
      user_id, plan, status, access_status, current_period_end,
      cancel_at_period_end, billing_interval
    )
    values (p_user_id, p_plan, 'active', p_plan, now() + interval '1 year', false, 'year')
    on conflict (user_id) do update set
      plan = excluded.plan, access_status = excluded.access_status,
      status = 'active', current_period_end = excluded.current_period_end,
      cancel_at_period_end = false, billing_interval = 'year', updated_at = now();
  end if;
  return true;
end;
$function$;
revoke all on function public.admin_set_membership(uuid,text) from public, anon;
grant execute on function public.admin_set_membership(uuid,text) to authenticated, service_role;
