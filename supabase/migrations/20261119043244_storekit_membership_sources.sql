-- UNAPPLIED candidate. Stripe records stay authoritative for Stripe billing.
-- Apple records are independent sources; no invoice/commission/ledger is rewritten.
CREATE SCHEMA IF NOT EXISTS hoopcheck_billing;
REVOKE ALL ON SCHEMA hoopcheck_billing FROM PUBLIC;
GRANT USAGE ON SCHEMA hoopcheck_billing TO service_role;
CREATE TABLE public.apple_billing_config (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  enabled boolean NOT NULL DEFAULT false,
  environment text CHECK(environment IN ('Production','Sandbox')),
  CHECK(NOT enabled OR environment IS NOT NULL)
);
INSERT INTO public.apple_billing_config(singleton) VALUES(true);
ALTER TABLE public.apple_billing_config ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.apple_billing_config TO anon,authenticated;
GRANT ALL ON public.apple_billing_config TO service_role;
CREATE POLICY apple_config_read ON public.apple_billing_config FOR SELECT TO authenticated USING(true);
CREATE POLICY hoopcheck_opted_in_mfa ON public.apple_billing_config AS RESTRICTIVE FOR ALL TO authenticated
  USING((SELECT hoopcheck_security.mfa_satisfied())) WITH CHECK((SELECT hoopcheck_security.mfa_satisfied()));

CREATE TABLE hoopcheck_billing.apple_owners (
  environment text NOT NULL CHECK(environment IN ('Production','Sandbox')),
  original_transaction_id text NOT NULL CHECK(original_transaction_id ~ '^[0-9]{1,64}$'),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(environment,original_transaction_id)
);
CREATE TABLE hoopcheck_billing.apple_transactions (
  environment text NOT NULL,
  transaction_id text NOT NULL CHECK(transaction_id ~ '^[0-9]{1,64}$'),
  original_transaction_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  product_id text NOT NULL,
  purchased_at timestamptz NOT NULL,
  signed_at timestamptz NOT NULL,
  revoked_at timestamptz,
  is_trial boolean NOT NULL,
  price_milli bigint CHECK(price_milli>=0),
  currency text CHECK(currency ~ '^[A-Z]{3}$'),
  PRIMARY KEY(environment,transaction_id),
  FOREIGN KEY(environment,original_transaction_id) REFERENCES hoopcheck_billing.apple_owners
);
CREATE INDEX apple_transactions_user ON hoopcheck_billing.apple_transactions(user_id);
CREATE TABLE hoopcheck_billing.trial_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  app_transaction_id text UNIQUE NOT NULL CHECK(app_transaction_id ~ '^[0-9]{1,64}$'),
  consumed_at timestamptz,
  original_transaction_id text CHECK(original_transaction_id ~ '^[0-9]{1,64}$'),
  trial_transaction_id text CHECK(trial_transaction_id ~ '^[0-9]{1,64}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE hoopcheck_billing.payment_history (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_paid_at timestamptz NOT NULL
);
CREATE TABLE hoopcheck_billing.purchase_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX apple_intents_rate ON hoopcheck_billing.purchase_intents(user_id,created_at);
ALTER TABLE hoopcheck_billing.purchase_intents ENABLE ROW LEVEL SECURITY;
CREATE TABLE hoopcheck_billing.apple_notifications (
  notification_id uuid PRIMARY KEY,
  payload_hash text NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'),
  processed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE hoopcheck_billing.apple_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE hoopcheck_billing.apple_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hoopcheck_billing.trial_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE hoopcheck_billing.payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE hoopcheck_billing.apple_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA hoopcheck_billing FROM PUBLIC,anon,authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA hoopcheck_billing TO service_role;

CREATE TABLE public.apple_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment text NOT NULL CHECK(environment IN ('Production','Sandbox')),
  original_transaction_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  plan text NOT NULL CHECK(plan IN ('pro','premium')),
  status text NOT NULL CHECK(status IN ('active','trialing','expired','billing_retry','revoked')),
  current_period_end timestamptz NOT NULL,
  cancel_at_period_end boolean NOT NULL,
  billing_interval text NOT NULL CHECK(billing_interval IN ('month','6_month','year')),
  signed_at timestamptz NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(environment,original_transaction_id),
  FOREIGN KEY(environment,original_transaction_id) REFERENCES hoopcheck_billing.apple_owners
);
CREATE INDEX apple_memberships_owner ON public.apple_memberships(user_id);
ALTER TABLE public.apple_memberships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.apple_memberships FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.apple_memberships TO anon,authenticated;
GRANT ALL ON public.apple_memberships TO service_role;
CREATE POLICY apple_memberships_owner_read ON public.apple_memberships FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY hoopcheck_opted_in_mfa ON public.apple_memberships AS RESTRICTIVE FOR ALL TO authenticated
 USING((SELECT hoopcheck_security.mfa_satisfied())) WITH CHECK((SELECT hoopcheck_security.mfa_satisfied()));

-- Preserve the two established contracts: JS entitlements use billing status,
-- while SQL predicates that explicitly check legacy access_status still do so.
-- Separate winners avoid an ineligible Stripe row masking a valid Apple source.
CREATE VIEW public.membership_sources WITH (security_invoker=true) AS
 SELECT s.id,s.user_id,s.plan,s.status,s.access_status,s.current_period_end,s.cancel_at_period_end,s.billing_interval,
   CASE WHEN s.stripe_subscription_id IS NULL THEN 'manual' ELSE 'stripe' END AS provider
 FROM public.subscriptions s
 UNION ALL
 SELECT a.id,a.user_id,a.plan,
   CASE WHEN a.status IN ('active','trialing') AND a.current_period_end>now() AND a.verified_at>now()-interval '36 hours' AND c.enabled THEN a.status ELSE 'expired' END,
   CASE WHEN a.status IN ('active','trialing') AND a.current_period_end>now() AND a.verified_at>now()-interval '36 hours' AND c.enabled THEN a.plan ELSE 'free' END,
   a.current_period_end,a.cancel_at_period_end,a.billing_interval,'apple'
 FROM public.apple_memberships a JOIN public.apple_billing_config c ON c.singleton AND c.environment=a.environment;

CREATE VIEW public.membership_entitlements WITH (security_invoker=true) AS
WITH ranked AS (
 SELECT *,row_number() OVER(PARTITION BY user_id ORDER BY
   (coalesce(plan IN ('pro','premium') AND status IN ('active','trialing') AND (current_period_end IS NULL OR current_period_end>now()),false)) DESC,
   CASE plan WHEN 'premium' THEN 2 WHEN 'pro' THEN 1 ELSE 0 END DESC,
   current_period_end DESC NULLS FIRST,provider,id) AS position
 FROM public.membership_sources
)
SELECT id,user_id,plan,status,access_status,current_period_end,cancel_at_period_end,billing_interval,provider FROM ranked WHERE position=1;

CREATE VIEW public.membership_authorizations WITH (security_invoker=true) AS
WITH guarded AS (
 SELECT id,user_id,plan,
   CASE WHEN provider IN ('stripe','manual') AND coalesce(access_status,'active') NOT IN ('active','trialing','pro','premium') THEN 'expired' ELSE status END AS status,
   access_status,current_period_end,cancel_at_period_end,billing_interval,provider
 FROM public.membership_sources
), ranked AS (
 SELECT *,row_number() OVER(PARTITION BY user_id ORDER BY
   (coalesce(plan IN ('pro','premium') AND status IN ('active','trialing') AND (current_period_end IS NULL OR current_period_end>now()),false)) DESC,
   CASE plan WHEN 'premium' THEN 2 WHEN 'pro' THEN 1 ELSE 0 END DESC,
   current_period_end DESC NULLS FIRST,provider,id) AS position
 FROM guarded
)
SELECT id,user_id,plan,status,access_status,current_period_end,cancel_at_period_end,billing_interval,provider FROM ranked WHERE position=1;
REVOKE ALL ON public.membership_sources,public.membership_entitlements,public.membership_authorizations FROM PUBLIC;
GRANT SELECT ON public.membership_sources,public.membership_entitlements,public.membership_authorizations TO anon,authenticated,service_role;

CREATE FUNCTION public.apple_take_purchase_intent(p_user uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN RAISE EXCEPTION 'Server access required' USING ERRCODE='42501'; END IF;
 IF p_user IS NULL THEN RETURN false; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('apple_intent:'||p_user::text,0));
 DELETE FROM hoopcheck_billing.purchase_intents WHERE user_id=p_user AND created_at<now()-interval '1 day';
 IF (SELECT count(*) FROM hoopcheck_billing.purchase_intents WHERE user_id=p_user AND created_at>now()-interval '10 minutes')>=5 THEN RETURN false; END IF;
 INSERT INTO hoopcheck_billing.purchase_intents(user_id) VALUES(p_user);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.apple_take_purchase_intent(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apple_take_purchase_intent(uuid) TO service_role;

-- Rare trial authorizations serialize for one account/one Apple identity binding.
-- Retries on the same Apple identity stay eligible until the trial is consumed.
CREATE FUNCTION public.apple_reserve_trial(p_user uuid,p_app_transaction text,p_prior_ineligible boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE claim hoopcheck_billing.trial_claims; BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN RAISE EXCEPTION 'Server access required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.apple_billing_config WHERE singleton AND enabled AND environment IS NOT NULL) THEN RAISE EXCEPTION 'Apple billing is not configured'; END IF;
 IF p_user IS NULL OR p_app_transaction !~ '^[0-9]{1,64}$' THEN RAISE EXCEPTION 'Invalid trial identity'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hoopcheck_membership_trials',0));
 IF coalesce(p_prior_ineligible,true) OR EXISTS(SELECT 1 FROM hoopcheck_billing.payment_history WHERE user_id=p_user)
    OR EXISTS(SELECT 1 FROM hoopcheck_billing.apple_transactions WHERE user_id=p_user AND (is_trial OR coalesce(price_milli,1)>0)) THEN RETURN false; END IF;
 SELECT * INTO claim FROM hoopcheck_billing.trial_claims WHERE user_id=p_user OR app_transaction_id=p_app_transaction LIMIT 1;
 IF FOUND THEN RETURN coalesce(claim.user_id=p_user AND claim.app_transaction_id=p_app_transaction AND claim.consumed_at IS NULL,false); END IF;
 INSERT INTO hoopcheck_billing.trial_claims(user_id,app_transaction_id) VALUES(p_user,p_app_transaction);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.apple_reserve_trial(uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apple_reserve_trial(uuid,text,boolean) TO service_role;

CREATE FUNCTION public.apple_record_membership(p_user uuid,p_environment text,p_original text,p_current jsonb,p_observed jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE config public.apple_billing_config; owner_id uuid; existing public.apple_memberships;
 product text; tier text; cadence text; state text; expires timestamptz; signed timestamptz;
 observed_trial boolean; observed_purchase timestamptz; app_transaction text; event jsonb; trial hoopcheck_billing.trial_claims; trial_authorized boolean; BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN RAISE EXCEPTION 'Server access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO config FROM public.apple_billing_config WHERE singleton;
 IF NOT FOUND OR config.enabled IS NOT TRUE OR config.environment IS DISTINCT FROM p_environment THEN RAISE EXCEPTION 'Apple billing is not configured'; END IF;
 IF p_user IS NULL OR p_original !~ '^[0-9]{1,64}$' OR p_current->>'originalTransactionId' IS DISTINCT FROM p_original
   OR p_observed->>'originalTransactionId' IS DISTINCT FROM p_original OR p_current->>'transactionId' !~ '^[0-9]{1,64}$'
   OR p_observed->>'transactionId' !~ '^[0-9]{1,64}$' OR lower(p_current->>'appAccountToken') IS DISTINCT FROM p_user::text
   OR lower(p_observed->>'appAccountToken') IS DISTINCT FROM p_user::text OR p_current->>'environment' IS DISTINCT FROM p_environment
   OR p_observed->>'environment' IS DISTINCT FROM p_environment OR p_current->>'bundleId' IS DISTINCT FROM 'online.hoopcheck.app'
   OR p_observed->>'bundleId' IS DISTINCT FROM 'online.hoopcheck.app' THEN RAISE EXCEPTION 'Apple identity mismatch'; END IF;
 product:=p_current->>'productId';
 IF product NOT IN ('hoopcheck.pro.monthly','hoopcheck.pro.6month','hoopcheck.pro.annual','hoopcheck.premium.monthly','hoopcheck.premium.6month','hoopcheck.premium.annual')
   OR p_observed->>'productId' NOT IN ('hoopcheck.pro.monthly','hoopcheck.pro.6month','hoopcheck.pro.annual','hoopcheck.premium.monthly','hoopcheck.premium.6month','hoopcheck.premium.annual') THEN RAISE EXCEPTION 'Unknown Apple product'; END IF;
 tier:=CASE WHEN product LIKE 'hoopcheck.premium.%' THEN 'premium' ELSE 'pro' END;
 cadence:=CASE WHEN product LIKE '%.monthly' THEN 'month' WHEN product LIKE '%.6month' THEN '6_month' ELSE 'year' END;
 signed:=to_timestamp((p_current->>'signedDate')::double precision/1000);
 expires:=to_timestamp((p_current->>'expiresDate')::double precision/1000);
 observed_purchase:=to_timestamp((p_observed->>'purchaseDate')::double precision/1000);
 IF signed IS NULL OR expires IS NULL OR observed_purchase IS NULL OR signed>now()+interval '5 minutes' OR observed_purchase>now()+interval '5 minutes' THEN RAISE EXCEPTION 'Invalid Apple dates'; END IF;
 IF p_current->>'revocationDate' IS NOT NULL OR p_current->>'status'='5' THEN state:='revoked';
 ELSIF p_current->>'status'='4' AND p_current->>'offerDiscountType' IS DISTINCT FROM 'FREE_TRIAL' AND (p_current->>'gracePeriodExpiresDate')::double precision>extract(epoch FROM now())*1000 THEN state:='active'; expires:=greatest(expires,to_timestamp((p_current->>'gracePeriodExpiresDate')::double precision/1000));
 ELSIF p_current->>'status'='1' AND expires>now() THEN state:=CASE WHEN p_current->>'offerDiscountType'='FREE_TRIAL' THEN 'trialing' ELSE 'active' END;
 ELSIF p_current->>'status'='3' THEN state:='billing_retry';
 ELSIF p_current->>'status' IN ('1','2','4') THEN state:='expired'; ELSE RAISE EXCEPTION 'Unknown Apple state'; END IF;
 INSERT INTO hoopcheck_billing.apple_owners(environment,original_transaction_id,user_id) VALUES(p_environment,p_original,p_user) ON CONFLICT DO NOTHING;
 SELECT user_id INTO owner_id FROM hoopcheck_billing.apple_owners WHERE environment=p_environment AND original_transaction_id=p_original FOR UPDATE;
 IF owner_id IS DISTINCT FROM p_user THEN RAISE EXCEPTION 'This purchase belongs to another HoopCheck account' USING ERRCODE='42501'; END IF;
 -- Record both a restored older receipt and the independently fetched latest
 -- transaction. Neither a replay nor an out-of-order callback duplicates income.
 FOR event IN SELECT value FROM jsonb_array_elements(jsonb_build_array(p_observed,p_current)) LOOP
   observed_purchase:=to_timestamp((event->>'purchaseDate')::double precision/1000);
   observed_trial:=coalesce(event->>'offerDiscountType'='FREE_TRIAL',false);
   IF observed_purchase IS NULL OR observed_purchase>now()+interval '5 minutes' THEN RAISE EXCEPTION 'Invalid Apple purchase date'; END IF;
   IF observed_trial AND (event->>'productId' NOT LIKE '%.monthly' OR event->>'offerType' IS DISTINCT FROM '1' OR coalesce((event->>'price')::bigint,-1)<>0
     OR (event->>'expiresDate')::double precision<=(event->>'purchaseDate')::double precision
     OR CASE WHEN p_environment='Sandbox' THEN (event->>'expiresDate')::double precision-(event->>'purchaseDate')::double precision>605100000
        ELSE abs((event->>'expiresDate')::double precision-(event->>'purchaseDate')::double precision-604800000)>300000 END) THEN RAISE EXCEPTION 'Invalid monthly trial'; END IF;
   IF EXISTS(SELECT 1 FROM hoopcheck_billing.apple_transactions WHERE environment=p_environment AND transaction_id=event->>'transactionId' AND (user_id IS DISTINCT FROM p_user OR original_transaction_id<>p_original)) THEN RAISE EXCEPTION 'Transaction ownership conflict'; END IF;
   INSERT INTO hoopcheck_billing.apple_transactions(environment,transaction_id,original_transaction_id,user_id,product_id,purchased_at,signed_at,revoked_at,is_trial,price_milli,currency)
   VALUES(p_environment,event->>'transactionId',p_original,p_user,event->>'productId',observed_purchase,to_timestamp((event->>'signedDate')::double precision/1000),to_timestamp((event->>'revocationDate')::double precision/1000),observed_trial,(event->>'price')::bigint,event->>'currency')
   ON CONFLICT(environment,transaction_id) DO UPDATE SET revoked_at=coalesce(excluded.revoked_at,hoopcheck_billing.apple_transactions.revoked_at),signed_at=greatest(excluded.signed_at,hoopcheck_billing.apple_transactions.signed_at);
   app_transaction:=coalesce(event->>'appTransactionId',p_current->>'appTransactionId');
   IF observed_trial THEN
     SELECT * INTO trial FROM hoopcheck_billing.trial_claims WHERE user_id=p_user FOR UPDATE;
     trial_authorized:=FOUND AND trial.app_transaction_id=app_transaction
       AND ((trial.trial_transaction_id=event->>'transactionId' AND trial.original_transaction_id=p_original)
         OR (trial.consumed_at IS NULL AND trial.original_transaction_id IS NULL AND trial.trial_transaction_id IS NULL
             AND trial.created_at<=observed_purchase+interval '5 minutes'
             AND NOT EXISTS(SELECT 1 FROM hoopcheck_billing.payment_history WHERE user_id=p_user AND first_paid_at<=observed_purchase)));
     -- Apple signatures prove a purchase, not HoopCheck's first-payer/trial quota.
     -- Historical inactive receipts can be acknowledged without licensing another
     -- free period; a live trial must match the one server-authorized transaction.
     IF NOT coalesce(trial_authorized,false) AND state IN ('active','trialing') AND p_current->>'offerDiscountType'='FREE_TRIAL' THEN RAISE EXCEPTION 'This trial was not authorized for this HoopCheck account' USING ERRCODE='42501'; END IF;
     IF coalesce(trial_authorized,false) THEN
       UPDATE hoopcheck_billing.trial_claims SET consumed_at=coalesce(consumed_at,now()),original_transaction_id=p_original,trial_transaction_id=event->>'transactionId' WHERE id=trial.id;
     END IF;
   ELSIF coalesce((event->>'price')::bigint,1)>0 THEN
     INSERT INTO hoopcheck_billing.payment_history VALUES(p_user,observed_purchase) ON CONFLICT(user_id) DO UPDATE SET first_paid_at=least(excluded.first_paid_at,hoopcheck_billing.payment_history.first_paid_at);
   END IF;
 END LOOP;
 SELECT * INTO existing FROM public.apple_memberships WHERE environment=p_environment AND original_transaction_id=p_original FOR UPDATE;
 IF FOUND AND (signed<existing.signed_at OR (signed=existing.signed_at AND existing.status='revoked' AND state<>'revoked')) THEN RETURN jsonb_build_object('acknowledged',true,'status',existing.status,'stale',true); END IF;
 INSERT INTO public.apple_memberships(environment,original_transaction_id,user_id,product_id,plan,status,current_period_end,cancel_at_period_end,billing_interval,signed_at)
 VALUES(p_environment,p_original,p_user,product,tier,state,expires,coalesce(p_current->>'autoRenewStatus','1')='0',cadence,signed)
 ON CONFLICT(environment,original_transaction_id) DO UPDATE SET product_id=excluded.product_id,plan=excluded.plan,status=excluded.status,current_period_end=excluded.current_period_end,cancel_at_period_end=excluded.cancel_at_period_end,billing_interval=excluded.billing_interval,signed_at=excluded.signed_at,verified_at=now(),updated_at=now();
 RETURN jsonb_build_object('acknowledged',true,'status',state,'stale',false);
END $$;
REVOKE ALL ON FUNCTION public.apple_record_membership(uuid,text,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apple_record_membership(uuid,text,text,jsonb,jsonb) TO service_role;

CREATE FUNCTION public.apple_note_notification(p_id uuid,p_hash text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN RAISE EXCEPTION 'Server access required' USING ERRCODE='42501'; END IF;
 INSERT INTO hoopcheck_billing.apple_notifications(notification_id,payload_hash) VALUES(p_id,p_hash) ON CONFLICT DO NOTHING;
 IF EXISTS(SELECT 1 FROM hoopcheck_billing.apple_notifications WHERE notification_id=p_id AND payload_hash<>p_hash) THEN RAISE EXCEPTION 'Conflicting Apple notification'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.apple_note_notification(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apple_note_notification(uuid,text) TO service_role;

-- Change only the membership source inside these authorization functions.
-- Preserve each function's role/moderation predicates, signature and privileges.
DO $$ DECLARE f record; body text; target text; BEGIN
 FOR f IN SELECT p.oid,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE p.prokind='f' AND ((n.nspname='public' AND p.proname IN ('can_use_unified_hoopfeed','can_view_fan_feed_post','can_view_player_feed_post','current_user_has_live_game_membership','get_fan_team_hub_posts','get_public_review_summary','get_womens_review_rating_summary')) OR (n.nspname='private' AND p.proname='is_active_subscriber'))
 LOOP
   target:=CASE WHEN f.definition ILIKE '%access_status%' THEN 'public.membership_authorizations' ELSE 'public.membership_entitlements' END;
   body:=regexp_replace(f.definition,'\m(public\.)?subscriptions\M',target,'g');
   IF body<>f.definition THEN EXECUTE body; END IF;
 END LOOP;
END $$;
-- ALTER keeps the policy's command, roles and permissive/restrictive semantics.
DO $$ DECLARE p record; statement text; target text; BEGIN
 FOR p IN SELECT * FROM pg_policies WHERE schemaname='public' AND (tablename,policyname) IN (
   ('coach_team_requests','coach team requests eligible insert'),('fan_connection_requests','pro premium fans create requests'),
   ('fan_feed_posts','fan feed posts visible to fans'),('player_contact_requests','eligible subscribers can request players'),
   ('reviews','reviews_subscriber_read'),('team_fanfeed_posts','fans read followed official team updates'),('womens_team_reviews','womens review paid read guard'))
 LOOP
   target:=CASE WHEN coalesce(p.qual,'')||coalesce(p.with_check,'') ILIKE '%access_status%' THEN 'public.membership_authorizations' ELSE 'public.membership_entitlements' END;
   statement:=format('ALTER POLICY %I ON public.%I',p.policyname,p.tablename);
   IF p.qual IS NOT NULL THEN statement:=statement||' USING ('||regexp_replace(p.qual,'\m(public\.)?subscriptions\M',target,'g')||')'; END IF;
   IF p.with_check IS NOT NULL THEN statement:=statement||' WITH CHECK ('||regexp_replace(p.with_check,'\m(public\.)?subscriptions\M',target,'g')||')'; END IF;
   EXECUTE statement;
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
