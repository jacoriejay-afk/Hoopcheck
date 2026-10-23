-- Null-safe membership plan checks applied as fan_review_plan_null_guard.
CREATE OR REPLACE FUNCTION public.get_public_review_summary(p_entity_type text, p_entity_id uuid)
RETURNS TABLE(review_count bigint, overall_rating numeric, communication_rating numeric, professionalism_rating numeric, development_rating numeric, payment_rating numeric)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_account_type text;
  v_plan text;
  v_active boolean := false;
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL THEN
    SELECT p.account_type INTO v_account_type
    FROM public.profiles p WHERE p.id = (SELECT auth.uid());

    IF v_account_type = 'fan' THEN
      SELECT s.plan,
        s.status IN ('active', 'trialing')
          AND (s.current_period_end IS NULL OR s.current_period_end > now())
      INTO v_plan, v_active
      FROM public.subscriptions s WHERE s.user_id = (SELECT auth.uid());

      IF NOT COALESCE(v_active, false) OR COALESCE(v_plan, '') NOT IN ('pro', 'premium') THEN
        RETURN QUERY SELECT 0::bigint, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric;
        RETURN;
      ELSIF v_plan = 'pro' THEN
        RETURN QUERY SELECT NULL::bigint, x.overall_rating, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric
          FROM private.get_public_review_summary(p_entity_type, p_entity_id) x;
        RETURN;
      END IF;
    END IF;
  END IF;

  RETURN QUERY SELECT * FROM private.get_public_review_summary(p_entity_type, p_entity_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_womens_review_rating_summary(p_team_id uuid)
RETURNS TABLE(review_count bigint, overall_rating numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_account_type text;
  v_plan text;
  v_active boolean := false;
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL THEN
    SELECT p.account_type INTO v_account_type
    FROM public.profiles p WHERE p.id = (SELECT auth.uid());

    IF v_account_type = 'fan' THEN
      SELECT s.plan,
        s.status IN ('active', 'trialing')
          AND (s.current_period_end IS NULL OR s.current_period_end > now())
      INTO v_plan, v_active
      FROM public.subscriptions s WHERE s.user_id = (SELECT auth.uid());

      IF NOT COALESCE(v_active, false) OR COALESCE(v_plan, '') NOT IN ('pro', 'premium') THEN
        RETURN QUERY SELECT 0::bigint, NULL::numeric;
        RETURN;
      ELSIF v_plan = 'pro' THEN
        RETURN QUERY SELECT NULL::bigint, round(avg(r.overall_rating)::numeric, 2)
          FROM public.womens_team_reviews r
          WHERE r.womens_team_id = p_team_id AND r.status = 'approved';
        RETURN;
      END IF;
    END IF;
  END IF;

  RETURN QUERY
    SELECT count(*)::bigint,
      CASE WHEN private.is_active_subscriber() OR private.is_admin_or_moderator()
        THEN round(avg(r.overall_rating)::numeric, 2)
        ELSE NULL
      END
    FROM public.womens_team_reviews r
    WHERE r.womens_team_id = p_team_id AND r.status = 'approved'
      AND (SELECT auth.uid()) IS NOT NULL;
END;
$function$;
