-- SECURITY-FINAL candidate: admin-only local membership updates.
-- REVIEWED SOURCE: production pg_get_functiondef, 2026-11-12.
-- NOT applied to production. Promote to a migration after isolated verification.
CREATE OR REPLACE FUNCTION public.admin_set_membership(p_user_id uuid, p_plan text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.admin_roles ar
    WHERE ar.user_id = (SELECT auth.uid())
      AND lower(btrim(coalesce(ar.role, ''))) = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin access required' USING errcode = '42501';
  END IF;

  IF p_plan NOT IN ('free', 'pro', 'premium') OR p_plan IS NULL THEN
    RAISE EXCEPTION 'Invalid membership plan' USING errcode = '22023';
  END IF;

  -- Keep Stripe as source of truth for billed subscriptions.
  IF EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = p_user_id
      AND nullif(btrim(s.stripe_subscription_id), '') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'This membership is linked to Stripe. Manage the subscription through the billing workflow first.';
  END IF;

  IF p_plan = 'free' THEN
    UPDATE public.subscriptions
    SET access_status = 'free',
        plan = NULL,
        status = 'inactive',
        stripe_price_id = NULL,
        stripe_subscription_id = NULL,
        current_period_end = NULL,
        cancel_at_period_end = false,
        updated_at = now()
    WHERE user_id = p_user_id;
  ELSE
    INSERT INTO public.subscriptions (
      user_id, plan, status, access_status, current_period_end,
      cancel_at_period_end, billing_interval
    )
    VALUES (
      p_user_id, p_plan, 'active', p_plan, now() + interval '1 year',
      false, 'year'
    )
    ON CONFLICT (user_id) DO UPDATE SET
      plan = excluded.plan,
      access_status = excluded.access_status,
      status = 'active',
      current_period_end = excluded.current_period_end,
      cancel_at_period_end = false,
      billing_interval = 'year',
      updated_at = now();
  END IF;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_membership(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_membership(uuid,text) TO authenticated;

-- Test on isolated database:
-- admin succeeds for local free/pro/premium;
-- moderator/ordinary/anonymous rejected (42501);
-- Stripe-linked accounts rejected without modification;
-- null/invalid plan rejected (22023);
-- no access changes to other users on failure.
