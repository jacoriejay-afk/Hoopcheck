\set ON_ERROR_STOP on
DO $$ BEGIN
  IF current_database() <> 'hoopcheck_hoopdata_budget_test' THEN
    RAISE EXCEPTION 'Use only isolated HOOPDATA test database';
  END IF;
END $$;
-- CI uses disposable roles in a local Postgres service.
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
\ir ../candidates/hoopdata_provider_budget_review_only.sql
INSERT INTO public.hoopdata_quota_pools(pool,enabled,max_per_minute,max_per_day)
VALUES ('balldontlie',true,2,3),('api-sports-basketball',false,1,96);
DO $$ BEGIN
  IF has_function_privilege('authenticated','public.hoopdata_reserve_request(text)','EXECUTE') OR
     has_function_privilege('anon','public.hoopdata_reserve_request(text)','EXECUTE') OR
     has_table_privilege('authenticated','public.hoopdata_request_reservations','SELECT') THEN
    RAISE EXCEPTION 'Client quota access leaked';
  END IF;
END $$;
SET ROLE service_role;
DO $$ BEGIN
  IF public.hoopdata_reserve_request('api-sports-basketball') OR public.hoopdata_reserve_request('unknown') THEN RAISE EXCEPTION 'Unknown or disabled pool accepted'; END IF;
  IF NOT public.hoopdata_reserve_request('balldontlie') OR NOT public.hoopdata_reserve_request('balldontlie') THEN RAISE EXCEPTION 'Within budget rejected'; END IF;
  IF public.hoopdata_reserve_request('balldontlie') THEN RAISE EXCEPTION 'Minute budget exceeded'; END IF;
  UPDATE public.hoopdata_request_reservations SET reserved_at=clock_timestamp()-interval '2 minutes' WHERE pool='balldontlie';
  IF NOT public.hoopdata_reserve_request('balldontlie') THEN RAISE EXCEPTION 'Sliding minute did not reset'; END IF;
  IF public.hoopdata_reserve_request('balldontlie') THEN RAISE EXCEPTION 'Daily budget exceeded'; END IF;
  UPDATE public.hoopdata_request_reservations SET reserved_at=clock_timestamp()-interval '25 hours' WHERE pool='balldontlie';
  UPDATE public.hoopdata_quota_pools SET blocked_until=clock_timestamp()+interval '5 minutes' WHERE pool='balldontlie';
  IF public.hoopdata_reserve_request('balldontlie') THEN RAISE EXCEPTION 'Retry cooldown ignored'; END IF;
  UPDATE public.hoopdata_quota_pools SET blocked_until=NULL WHERE pool='balldontlie';
  IF NOT public.hoopdata_reserve_request('balldontlie') THEN RAISE EXCEPTION 'Rolling daily budget failed to reset'; END IF;
END $$;
RESET ROLE;
