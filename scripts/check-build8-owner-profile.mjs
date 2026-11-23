import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
const source=readFileSync("supabase/candidates/build8_scoped_owner_profile_rpc.sql","utf8");
const start="-- BEGIN ISOLATABLE OWNER RPC CONTRACT";
const end="-- END ISOLATABLE OWNER RPC CONTRACT";
assert.equal(source.split(start).length,2,"Missing exact-body start marker");
assert.equal(source.split(end).length,2,"Missing exact-body end marker");
let body=source.split(start)[1].split(end)[0];
assert.equal((body.match(/CREATE FUNCTION /g)||[]).length,2,"Only two owner access functions allowed");
assert.match(body,/SECURITY INVOKER/);
assert.match(body,/SECURITY DEFINER/);
assert.match(body,/WHERE p.id = auth.uid\(\)/);
assert.match(body,/auth\.mfa_factors/);
assert.doesNotMatch(body,/GRANT SELECT ON public\.profiles|REVOKE SELECT|ALTER ROLE|DISABLE ROW LEVEL SECURITY/);
// Extract ONLY the actual JSONB projection, never unrelated SQL strings.
// The previous whole-function regex also captured 'authenticated', creating
// a synthetic column that does not exist in the installed profiles table.
const projection=body.match(/SELECT jsonb_build_object\(([\s\S]*?)\) INTO result/);
assert.ok(projection,"Missing scoped owner profile projection");
const fields=[...projection[1].matchAll(/'([a-z_]+)',p\.([a-z_]+)/g)].map(m=>{assert.equal(m[1],m[2]);return m[1];});
assert.equal(fields.length,31,"Owner projection field count drifted");
assert.equal(new Set(fields).size,31,"Duplicate owner projection field");
const guard=source.match(/SELECT 1 FROM \(VALUES ([^\n]+)\) AS required\(column_name\)/);
assert.ok(guard,"Missing fail-closed owner SELECT ACL preflight");
const guardedFields=[...guard[1].matchAll(/\('([a-z_]+)'\)/g)].map(m=>m[1]);
assert.deepEqual(guardedFields.slice().sort(),fields.slice().sort(),"Every owner output must be protected by exact column/ACL preflight");
assert.match(source,/pol\.permissive='PERMISSIVE' AND pol\.cmd IN \('SELECT','ALL'\)/);
assert.match(source,/pol\.qual ILIKE '%auth\.uid%'/);
assert.match(source,/has_column_privilege\('authenticated','public\.profiles',a\.attname,'SELECT'\)/);
assert.doesNotMatch(source,/GRANT SELECT ON public\.profiles|DISABLE ROW LEVEL SECURITY|ALTER ROLE/);
// Exercise the unmodified migration preflight under synthetic ACL/RLS drift
// instead of merely asserting that its SQL text contains guard keywords.
const guardStart=source.indexOf(" IF NOT EXISTS (\\n   SELECT 1 FROM pg_policies pol");
const guardEnd=source.indexOf(" SELECT count(*) INTO n",guardStart);
assert.ok(guardStart>0 && guardEnd>guardStart,"Cannot isolate owner RPC installation preflight");
const syntheticGuard=source.slice(guardStart,guardEnd)
 .replaceAll("pol.schemaname='public'","pol.schemaname='hc_b8owner'")
 .replaceAll("'public.profiles'::regclass","'hc_b8owner.profiles'::regclass")
 .replaceAll("'public.profiles'","'hc_b8owner.profiles'")
 .replaceAll("'%auth.uid%'","'%hc_b8owner.uid%'");
assert.match(syntheticGuard,/hc_b8owner\.profiles/);
const failedGuard=(mutation,restore,expected,caseName)=>`${mutation}\nDO $drift_rejected$\nDECLARE caught boolean:=false;\nBEGIN\n BEGIN\n${syntheticGuard}\n EXCEPTION WHEN raise_exception THEN\n  IF SQLERRM = '${expected}' THEN caught:=true; ELSE RAISE; END IF;\n END;\n IF NOT caught THEN RAISE EXCEPTION 'Preflight silently accepted ${caseName}'; END IF;\nEND $drift_rejected$;\n${restore}\n`;
const preflightFixture=`DO $baseline_preflight$ BEGIN\n${syntheticGuard}\nEND $baseline_preflight$;\n`+
 failedGuard('REVOKE SELECT (current_country) ON hc_b8owner.profiles FROM authenticated;',
  'GRANT SELECT (current_country) ON hc_b8owner.profiles TO authenticated;',
  'Owner RPC projected column or SELECT grant drifted','missing-column-SELECT')+
 failedGuard('DROP POLICY synthetic_owner ON hc_b8owner.profiles;',
  'CREATE POLICY synthetic_owner ON hc_b8owner.profiles FOR SELECT TO authenticated USING (id=hc_b8owner.uid());',
  'Authenticated owner SELECT policy drifted; abort owner RPC','missing-owner-policy');
assert.ok(fields.length>=25,"Owner profile projection fields missing");
const types={id:"uuid",years_pro:"integer",current_country_public:"boolean",free_agent:"boolean",player_verified:"boolean",is_adult:"boolean",agreed_to_terms:"boolean",created_at:"timestamptz",updated_at:"timestamptz",player_verified_at:"timestamptz",notification_preferences:"jsonb"};
for(const [a,b] of [["hoopcheck_security.owner_profile_factor_satisfied","hc_b8owner.owner_profile_factor_satisfied"],["public.get_own_profile","hc_b8owner.get_own_profile"],["public.profiles","hc_b8owner.profiles"],["auth.mfa_factors","hc_b8owner.mfa_factors"],["auth.uid()","hc_b8owner.uid()"],["auth.jwt()","hc_b8owner.jwt()"],["hoopcheck_security","hc_b8owner"]]) body=body.replaceAll(a,b);
assert.ok(!body.includes("public.profiles")&&!body.includes("auth.mfa_factors"),"Fixture touches production tables");
const prefix="BEGIN;\nDO $roles$ BEGIN\n IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;\n IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;\nEND $roles$;\nCREATE SCHEMA hc_b8owner;\nGRANT USAGE ON SCHEMA hc_b8owner TO authenticated;\nCREATE FUNCTION hc_b8owner.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $jwt$\n SELECT coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $jwt$;\nCREATE FUNCTION hc_b8owner.uid() RETURNS uuid LANGUAGE sql STABLE AS $uid$\n SELECT nullif(hc_b8owner.jwt()->>'sub','')::uuid $uid$;\nGRANT EXECUTE ON FUNCTION hc_b8owner.jwt(),hc_b8owner.uid() TO authenticated;\nCREATE TABLE hc_b8owner.mfa_factors(user_id uuid NOT NULL,status text NOT NULL);\nCREATE TABLE hc_b8owner.profiles(__COLUMNS__);\nALTER TABLE hc_b8owner.profiles ENABLE ROW LEVEL SECURITY;\nCREATE POLICY synthetic_owner ON hc_b8owner.profiles FOR SELECT TO authenticated\n USING (id=hc_b8owner.uid());\nGRANT SELECT (__SELECT_COLUMNS__) ON hc_b8owner.profiles TO authenticated;\nINSERT INTO hc_b8owner.profiles(id,account_type,username,display_name,current_country,current_country_public,profile_visibility,moderation_status,years_pro)\nVALUES\n ('11111111-1111-4111-8111-111111111111','player','testowner','Synthetic Owner','SecretOwnerCountry',false,'private','normal',4),\n ('22222222-2222-4222-8222-222222222222','fan','testnonowner','Synthetic Nonowner','OtherPrivateCountry',false,'private','normal',1);\nINSERT INTO hc_b8owner.mfa_factors(user_id,status)\nVALUES('11111111-1111-4111-8111-111111111111','verified');\n";
const suffix="SET LOCAL ROLE anon;\nDO $negative$\nBEGIN\n BEGIN\n   PERFORM hc_b8owner.get_own_profile();\n   RAISE EXCEPTION 'anonymous function callable';\n EXCEPTION WHEN insufficient_privilege THEN NULL; END;\nEND $negative$;\nRESET ROLE;\nSET LOCAL ROLE authenticated;\nSELECT set_config('request.jwt.claims','{}',true);\nDO $negative$\nBEGIN\n BEGIN PERFORM hc_b8owner.get_own_profile(); RAISE EXCEPTION 'no JWT accepted';\n EXCEPTION WHEN insufficient_privilege THEN NULL; END;\nEND $negative$;\n-- Enrolled AAL1 must reject even when user metadata claims AAL2.\nSELECT set_config('request.jwt.claims','{\"role\":\"authenticated\",\"sub\":\"11111111-1111-4111-8111-111111111111\",\"aal\":\"aal1\",\"user_metadata\":{\"aal\":\"aal2\"}}',true);\nDO $negative$\nBEGIN\n BEGIN PERFORM hc_b8owner.get_own_profile(); RAISE EXCEPTION 'enrolled AAL1 accepted';\n EXCEPTION WHEN insufficient_privilege THEN NULL; END;\nEND $negative$;\nSELECT set_config('request.jwt.claims','{\"role\":\"authenticated\",\"sub\":\"11111111-1111-4111-8111-111111111111\",\"aal\":\"aal2\"}',true);\nDO $positive$\nDECLARE data jsonb;\nBEGIN\n SELECT hc_b8owner.get_own_profile() INTO data;\n IF data->>'id' IS DISTINCT FROM '11111111-1111-4111-8111-111111111111'\n OR data->>'current_country' IS DISTINCT FROM 'SecretOwnerCountry'\n OR data->>'account_type' IS DISTINCT FROM 'player'\n OR data ? 'moderation_note' OR data ? 'stripe_identity_verification_session_id'\n OR data ? 'birthdate'\n THEN RAISE EXCEPTION 'owner projection leaked/failed'; END IF;\nEND $positive$;\n-- Unenrolled AAL1 must see own, never another person's private country.\nSELECT set_config('request.jwt.claims','{\"role\":\"authenticated\",\"sub\":\"22222222-2222-4222-8222-222222222222\",\"aal\":\"aal1\"}',true);\nDO $positive$\nDECLARE data jsonb;\nBEGIN\n SELECT hc_b8owner.get_own_profile() INTO data;\n IF data->>'id' IS DISTINCT FROM '22222222-2222-4222-8222-222222222222'\n OR data->>'current_country' IS DISTINCT FROM 'OtherPrivateCountry'\n OR data->>'username' IS DISTINCT FROM 'testnonowner'\n THEN RAISE EXCEPTION 'nonowner projection compromised'; END IF;\nEND $positive$;\nSELECT set_config('request.jwt.claims','{\"role\":\"authenticated\",\"sub\":\"22222222-2222-4222-8222-222222222222\",\"aal\":\"aal2\",\"is_anonymous\":true}',true);\nDO $negative$\nBEGIN\n BEGIN PERFORM hc_b8owner.get_own_profile(); RAISE EXCEPTION 'anonymous auth claim accepted';\n EXCEPTION WHEN insufficient_privilege THEN NULL; END;\nEND $negative$;\nSELECT set_config('request.jwt.claims','{\"role\":\"service_role\",\"sub\":\"22222222-2222-4222-8222-222222222222\",\"aal\":\"aal2\"}',true);\nDO $negative$\nBEGIN\n BEGIN PERFORM hc_b8owner.get_own_profile(); RAISE EXCEPTION 'forged role claim accepted';\n EXCEPTION WHEN insufficient_privilege THEN NULL; END;\nEND $negative$;\nSELECT set_config('request.jwt.claims','{\"role\":\"authenticated\",\"sub\":\"11111111-1111-4111-8111-111111111111\",\"aal\":\"aal3\"}',true);\nDO $negative$\nBEGIN\n BEGIN PERFORM hc_b8owner.get_own_profile(); RAISE EXCEPTION 'unknown AAL accepted';\n EXCEPTION WHEN insufficient_privilege THEN NULL; END;\nEND $negative$;\nRESET ROLE;\nDO $acl$\nBEGIN\n IF EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a\n   WHERE p.oid IN ('hc_b8owner.get_own_profile()'::regprocedure,'hc_b8owner.owner_profile_factor_satisfied()'::regprocedure)\n   AND a.grantee=0 AND a.privilege_type='EXECUTE')\n THEN RAISE EXCEPTION 'PUBLIC EXECUTE granted on privileged function'; END IF;\n IF EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid='hc_b8owner.get_own_profile()'::regprocedure AND p.prosecdef)\n THEN RAISE EXCEPTION 'owner projection must not bypass RLS'; END IF;\nEND $acl$;\nSELECT 'PASS: JWT AAL1 vs AAL2, owner/nonowner isolation, anonymous, forged claims, ACL and RLS synthetic fixture' AS result;\nROLLBACK;\n";
process.stdout.write(prefix.replace("__COLUMNS__",fields.map(f=>f+" "+(types[f]||"text")).join(",")).replace("__SELECT_COLUMNS__",fields.join(","))+body+preflightFixture+suffix);
