import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/candidates/ambassador_resume_signed_term.sql", "utf8");
const action = readFileSync("app/admin/ambassadors/actions.ts", "utf8");
const admin = readFileSync("app/admin/ambassadors/page.tsx", "utf8");

test("resuming is restricted to the original signed CHRISLYKES term", () => {
  assert.match(sql, /p_code is distinct from 'CHRISLYKES'/);
  assert.match(sql, /g\.status <> 'suspended'/);
  assert.match(sql, /original_end is distinct from g\.activated_at \+ interval '90 days'/);
  assert.match(sql, /original_end::date is distinct from p_confirmed_original_end_date/);
  assert.match(sql, /g\.first_rate_bps is distinct from 5000/);
  assert.match(sql, /g\.commission_rate_bps is distinct from 1000/);
  assert.match(sql, /and a\.action = 'pause'/);
  assert.match(sql, /values\(p_actor, g\.id, 'resume_signed_term'/);
});

test("new privileged RPC grants service-role only and keeps empty search path", () => {
  assert.match(sql, /security definer set search_path = ''/);
  assert.match(sql, /revoke all on function public\.ambassador_resume_signed_term\(uuid,text,date,text\)\s+from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.ambassador_resume_signed_term\(uuid,text,date,text\)\s+to service_role/);
  assert.doesNotMatch(sql, /\b(drop|truncate|delete)\s+(?:table\s+)?(?:public\.)?(?:ambassador_attributions|ambassador_commissions|ambassador_payouts)/i);
});

test("server action requires approved owner, AAL2 and separate feature flag", () => {
  assert.match(action, /await requireAmbassadorSession\(path, true\)/);
  assert.match(action, /process\.env\.AMBASSADOR_RESUME_ENABLED !== "true"/);
  assert.match(action, /auth\.auth\.mfa\.getAuthenticatorAssuranceLevel\(\)/);
  assert.match(action, /assurance\?\.currentLevel !== "aal2"/);
  assert.match(action, /rpc\("ambassador_resume_signed_term"/);
  assert.match(admin, /process\.env\.AMBASSADOR_RESUME_ENABLED === "true"/);
  assert.match(admin, /Suspended — new referrals disabled/);
});
