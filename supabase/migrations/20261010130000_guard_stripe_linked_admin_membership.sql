-- Prevent admin membership overrides from desynchronizing Stripe-managed subscriptions.
-- This migration must be applied to the Supabase project before the safeguard is active.
CREATE OR REPLACE FUNCTION public.admin_set_membership(p_user_id uuid, p_plan text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_allowed boolean;
begin
  select public.is_current_user_admin_or_moderator() into v_allowed;
  if not coalesce(v_allowed, false) then
    raise exception 'Admin access required';
  end if;

  if p_plan not in ('free', 'pro', 'premium') then
    raise exception 'Invalid membership plan';
  end if;

  -- Stripe owns billing state whenever a Stripe subscription ID is recorded.
  -- Fail closed rather than changing local access or deleting the Stripe ID.
  if exists (
    select 1
    from public.subscriptions s
    where s.user_id = p_user_id
      and nullif(btrim(s.stripe_subscription_id), '') is not null
  ) then
    raise exception 'This membership is linked to Stripe. Manage the subscription through the billing workflow first.';
  end if;

  if p_plan = 'free' then
    update public.subscriptions
    set access_status = 'free',
        plan = null,
        status = 'inactive',
        stripe_price_id = null,
        stripe_subscription_id = null,
        current_period_end = null,
        cancel_at_period_end = false,
        updated_at = now()
    where user_id = p_user_id;
  else
    insert into public.subscriptions (
      user_id, plan, status, access_status, current_period_end,
      cancel_at_period_end, billing_interval
    )
    values (
      p_user_id, p_plan, 'active', p_plan, now() + interval '1 year',
      false, 'year'
    )
    on conflict (user_id) do update set
      plan = excluded.plan,
      access_status = excluded.access_status,
      status = 'active',
      current_period_end = excluded.current_period_end,
      cancel_at_period_end = false,
      billing_interval = 'year',
      updated_at = now();
  end if;

  return true;
end;
$function$;
