\set ON_ERROR_STOP on
-- LOCAL disposable PostgreSQL only, after restoring the read-only catalog export.
-- This script is not a migration. It adds synthetic records and rolls everything back.
BEGIN;
DO $$ BEGIN
 IF current_database()<>'hoop_prod_rehearsal' OR inet_server_addr() IS NOT NULL THEN
  RAISE EXCEPTION 'Only the disposable local socket database hoop_prod_rehearsal is allowed';
 END IF;
END $$;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
INSERT INTO auth.users(id,email) VALUES
 ('b8000000-0000-4000-8000-000000000001','build8-owner@fixture.invalid'),
 ('b8000000-0000-4000-8000-000000000002','build8-other@fixture.invalid'),
 ('b8000000-0000-4000-8000-000000000005','build8-women@fixture.invalid');
INSERT INTO public.profiles(id,account_type,profile_visibility,display_name,username,country,current_country,current_country_public,moderation_status) VALUES
 ('b8000000-0000-4000-8000-000000000001','player','public','Build Eight Owner','build8_owner','France','Rehearsal Private Country',false,'normal'),
 ('b8000000-0000-4000-8000-000000000002','player','public','Build Eight Other','build8_other','France','Rehearsal Public Country',true,'normal');
INSERT INTO public.profiles(id,account_type,profile_visibility,display_name,username,basketball_type,current_country_public)
 VALUES('b8000000-0000-4000-8000-000000000005','player','public','Different Display','build8_woman','womens',true);
INSERT INTO public.subscriptions(user_id,plan,status,access_status,current_period_end,stripe_subscription_id,billing_interval)
 VALUES ('b8000000-0000-4000-8000-000000000001','premium','active','premium',now()+interval '30 days','sub_build8_synthetic','month');
INSERT INTO public.subscriptions(user_id,plan,status,access_status,current_period_end,billing_interval)
 VALUES ('b8000000-0000-4000-8000-000000000005','pro','active','pro',now()+interval '30 days','month');
INSERT INTO public.teams(id,name) VALUES('b8000000-0000-4000-8000-000000000003','Build8 Synthetic Club');
-- Seed an existing approved review, not a new authenticated submission flow.
ALTER TABLE public.reviews DISABLE TRIGGER USER;
INSERT INTO public.reviews(author_id,team_id,overall_rating,body,status)
 VALUES('b8000000-0000-4000-8000-000000000001','b8000000-0000-4000-8000-000000000003',4,'Synthetic review preserved during Build8 rehearsal.','approved');
ALTER TABLE public.reviews ENABLE TRIGGER USER;
CREATE TEMP TABLE stripe_before AS SELECT * FROM public.subscriptions;
CREATE TEMP TABLE teams_before AS SELECT * FROM public.teams;
CREATE TEMP TABLE reviews_before AS SELECT * FROM public.reviews;
CREATE TEMP TABLE commissions_before AS SELECT * FROM public.ambassador_commissions;
\ir ../migrations/20261118162305_player_profile_country_privacy.sql
\ir ../migrations/20261118162456_opted_in_mfa_enforcement.sql
\ir ../migrations/20261119043244_storekit_membership_sources.sql
\ir ../migrations/20261119074537_profile_private_field_boundary.sql
\ir ../migrations/20261119075626_restrict_private_profile_columns.sql
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims','{"role":"anon"}',true);
DO $$ BEGIN
 IF has_column_privilege(current_user,'public.profiles','current_country','SELECT') THEN RAISE EXCEPTION 'raw country still exposed'; END IF;
 IF EXISTS(SELECT FROM public.search_public_players_by_username(p_username=>'build8') WHERE current_country='Rehearsal Private Country') THEN RAISE EXCEPTION 'username RPC leaked private country'; END IF;
 IF EXISTS(SELECT FROM public.search_public_players('Rehearsal Private Country')) THEN RAISE EXCEPTION 'legacy positional search leaked private country'; END IF;
 IF EXISTS(SELECT FROM public.search_public_players_page(p_country=>'Rehearsal Private Country')) THEN RAISE EXCEPTION 'paged search leaked private country'; END IF;
 IF (SELECT count(*) FROM public.search_public_players())<>2 THEN RAISE EXCEPTION 'legacy defaults no longer callable'; END IF;
 IF (SELECT count(*) FROM public.search_public_players('build8_owner'))<>1 THEN RAISE EXCEPTION 'legacy username matching regressed'; END IF;
 IF (SELECT count(*) FROM public.search_public_players(p_query=>'build8_owner',p_limit=>1))<>1 THEN RAISE EXCEPTION 'legacy named/defaulted call regressed'; END IF;
 IF EXISTS(SELECT FROM public.search_public_players('build8_woman')) OR EXISTS(SELECT FROM public.search_public_players_page('build8_woman')) THEN RAISE EXCEPTION 'men/women directories mixed'; END IF;
 IF NOT EXISTS(SELECT FROM public.search_public_players_by_username(p_username=>'build8_woman') WHERE basketball_type='womens') THEN RAISE EXCEPTION 'new username directory lost women'; END IF;
 IF public.is_player_country_public('b8000000-0000-4000-8000-000000000001') OR NOT public.is_player_country_public('b8000000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'country consent boundary changed'; END IF;
 BEGIN PERFORM public.get_own_profile(); RAISE EXCEPTION 'anonymous owner RPC allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','b8000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"b8000000-0000-4000-8000-000000000001","aal":"aal1"}',true);
DO $$ BEGIN
 IF public.get_own_profile()->>'current_country'<>'Rehearsal Private Country' THEN RAISE EXCEPTION 'owner private read lost'; END IF;
 IF NOT EXISTS(SELECT FROM public.membership_entitlements WHERE user_id=auth.uid() AND plan='premium' AND provider='stripe') THEN RAISE EXCEPTION 'existing Stripe access lost'; END IF;
 IF EXISTS(SELECT FROM public.membership_entitlements WHERE user_id<>auth.uid()) THEN RAISE EXCEPTION 'cross-owner entitlement leak'; END IF;
 BEGIN
  UPDATE public.apple_billing_config SET enabled=true,environment='Sandbox';
  IF FOUND THEN RAISE EXCEPTION 'client enabled Apple billing'; END IF;
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 UPDATE public.profiles SET bio='Build8 synthetic owner edit' WHERE id=auth.uid();
 IF public.get_own_profile()->>'bio'<>'Build8 synthetic owner edit' THEN RAISE EXCEPTION 'owner editing failed'; END IF;
 UPDATE public.profiles SET bio='FORGED' WHERE id='b8000000-0000-4000-8000-000000000002';
 IF FOUND THEN RAISE EXCEPTION 'cross-owner update allowed'; END IF;
END $$;
RESET ROLE;
INSERT INTO auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at)
 VALUES('b8000000-0000-4000-8000-000000000004','b8000000-0000-4000-8000-000000000001','totp','verified',now(),now());
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.get_own_profile(); RAISE EXCEPTION 'AAL1 owner RPC bypassed MFA'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF EXISTS(SELECT FROM public.profiles WHERE id=auth.uid()) THEN RAISE EXCEPTION 'AAL1 RLS bypassed MFA'; END IF;
END $$;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"b8000000-0000-4000-8000-000000000001","aal":"aal2"}',true);
DO $$ BEGIN
 IF public.get_own_profile()->>'id'<>auth.uid()::text THEN RAISE EXCEPTION 'AAL2 owner recovery failed'; END IF;
END $$;
RESET ROLE;
-- Existing Stripe rows and application records are preserved byte-for-byte.
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM public.membership_entitlements WHERE user_id='b8000000-0000-4000-8000-000000000005' AND provider='manual' AND plan='pro' AND status='active') THEN RAISE EXCEPTION 'manual membership lost'; END IF;
 IF EXISTS((SELECT * FROM public.subscriptions EXCEPT SELECT * FROM stripe_before) UNION ALL (SELECT * FROM stripe_before EXCEPT SELECT * FROM public.subscriptions)) THEN RAISE EXCEPTION 'raw Stripe records changed'; END IF;
 IF EXISTS((SELECT * FROM public.teams EXCEPT SELECT * FROM teams_before) UNION ALL (SELECT * FROM teams_before EXCEPT SELECT * FROM public.teams)) THEN RAISE EXCEPTION 'teams changed'; END IF;
 IF EXISTS((SELECT * FROM public.reviews EXCEPT SELECT * FROM reviews_before) UNION ALL (SELECT * FROM reviews_before EXCEPT SELECT * FROM public.reviews)) THEN RAISE EXCEPTION 'reviews changed'; END IF;
 IF EXISTS((SELECT * FROM public.ambassador_commissions EXCEPT SELECT * FROM commissions_before) UNION ALL (SELECT * FROM commissions_before EXCEPT SELECT * FROM public.ambassador_commissions)) THEN RAISE EXCEPTION 'commissions changed'; END IF;
 IF EXISTS(SELECT FROM public.apple_billing_config WHERE enabled) THEN RAISE EXCEPTION 'Apple enabled unexpectedly'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS: production application catalog migration sequence, legacy defaults, owner/privacy/RLS/Stripe preservation; synthetic changes rolled back' AS result;
