"""Generate a LOCAL-ONLY committed-state rehearsal from the catalog fixture.

Restore approved schema-only metadata first, exactly as BUILD8-CATALOG-REHEARSAL.md.
Run generated output from supabase/tests so fixture-relative migration paths resolve.
No hosted connection, metadata export or production approval is performed here.
"""
from pathlib import Path
import argparse

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('output', type=Path)
parser.add_argument('--sql-root', type=Path, default=root, help='Repository path inside the SQL execution container')
args = parser.parse_args()
source = (root / 'supabase/tests/build8_production_catalog_rehearsal.sql').read_text()
if source.count('ROLLBACK;') != 1:
    raise SystemExit('Review changed catalog fixture transaction boundaries first')
fixture = source.split('ROLLBACK;')[0]
checks = r"""
-- Fixture checks have passed; seed a genuine committed local Apple source too.
UPDATE public.apple_billing_config SET enabled=true,environment='Sandbox';
INSERT INTO hoopcheck_billing.apple_owners(environment,original_transaction_id,user_id)
 VALUES('Sandbox','99000','b8000000-0000-4000-8000-000000000001');
INSERT INTO public.apple_memberships(environment,original_transaction_id,user_id,product_id,plan,status,current_period_end,cancel_at_period_end,billing_interval,signed_at)
 VALUES('Sandbox','99000','b8000000-0000-4000-8000-000000000001','hoopcheck.premium.monthly','premium','active',now()+interval '1 month',false,'month',now());
CREATE TEMP TABLE compensation_rows(schema_name text,table_name text,rows jsonb);
DO $$ DECLARE t record; value jsonb; BEGIN
 FOR t IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','hoopcheck_billing') LOOP
  EXECUTE format('SELECT coalesce(jsonb_agg(v ORDER BY v::text), ''[]''::jsonb) FROM (SELECT to_jsonb(r) v FROM %I.%I r) x',t.schemaname,t.tablename) INTO value;
  INSERT INTO compensation_rows VALUES(t.schemaname,t.tablename,value);
 END LOOP;
 IF NOT has_function_privilege('service_role','public.apple_take_purchase_intent(uuid)','EXECUTE') THEN RAISE EXCEPTION 'missing baseline intent privilege'; END IF;
END $$;
CREATE TEMP TABLE compensation_entitlements AS SELECT * FROM public.membership_entitlements;
CREATE TEMP TABLE compensation_functions AS SELECT oid,pg_get_functiondef(oid) definition FROM pg_proc WHERE pronamespace IN ('public'::regnamespace,'hoopcheck_security'::regnamespace);
COMMIT;
-- Compensation is a separate committed transaction, not transaction rollback.
BEGIN;
\ir ../../scripts/sql/build9-pause-new-apple-intents-local.sql
COMMIT;
BEGIN;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
DO $$ BEGIN
 BEGIN
  PERFORM public.apple_take_purchase_intent('b8000000-0000-4000-8000-000000000001');
  RAISE EXCEPTION 'new purchase intent still allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 IF NOT has_function_privilege(current_user,'public.apple_record_membership(uuid,text,text,jsonb,jsonb)','EXECUTE') OR NOT has_function_privilege(current_user,'public.apple_note_notification(uuid,text)','EXECUTE') THEN RAISE EXCEPTION 'sync/notifications disabled'; END IF;
END $$;
RESET ROLE;
DO $$ DECLARE t record; value jsonb; BEGIN
 FOR t IN SELECT * FROM compensation_rows LOOP
  EXECUTE format('SELECT coalesce(jsonb_agg(v ORDER BY v::text), ''[]''::jsonb) FROM (SELECT to_jsonb(r) v FROM %I.%I r) x',t.schema_name,t.table_name) INTO value;
  IF value IS DISTINCT FROM t.rows THEN RAISE EXCEPTION 'compensation changed rows in %.%',t.schema_name,t.table_name; END IF;
 END LOOP;
 IF EXISTS((SELECT * FROM public.membership_entitlements EXCEPT SELECT * FROM compensation_entitlements) UNION ALL (SELECT * FROM compensation_entitlements EXCEPT SELECT * FROM public.membership_entitlements)) THEN RAISE EXCEPTION 'effective entitlements changed'; END IF;
 IF EXISTS(SELECT FROM compensation_functions f WHERE pg_get_functiondef(f.oid) IS DISTINCT FROM f.definition) THEN RAISE EXCEPTION 'released function definitions changed'; END IF;
 IF has_column_privilege('anon','public.profiles','current_country','SELECT') OR has_column_privilege('authenticated','public.profiles','current_country','SELECT') THEN RAISE EXCEPTION 'privacy weakened'; END IF;
 IF (SELECT count(*) FROM public.membership_sources WHERE provider='apple' AND status='active')<>1 THEN RAISE EXCEPTION 'existing Apple access lost'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS: committed purchase-intent pause preserves every application/billing row, entitlements, RPC definitions, privacy and sync privileges' result;
"""
output = args.output
sql = (fixture + checks).replace(r'\ir ../migrations/', f'\\ir {args.sql_root}/supabase/migrations/').replace(r'\ir ../../scripts/', f'\\ir {args.sql_root}/scripts/')
output.write_text(sql)
output.chmod(0o600)
print('Generated local committed compensation rehearsal:', output)
