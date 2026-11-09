import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const api = readFileSync("app/api/business-inquiries/route.ts", "utf8");
const form = readFileSync("components/PublicBusinessInquiry.tsx", "utf8");
const page = readFileSync("app/partners/page.tsx", "utf8");
const schema = readFileSync("docs/sql/public-business-inquiries.sql", "utf8");
const throttle = readFileSync("docs/sql/business-inquiry-rate-limit.sql", "utf8");

test("public endpoint is explicitly server gated", () => {
  assert.match(api, /BUSINESS_INQUIRIES_API_ENABLED/);
  assert.match(api, /!== "true"/);
});
test("guest form is hidden unless explicitly enabled", () => {
  assert.match(page, /NEXT_PUBLIC_BUSINESS_INQUIRIES_ENABLED === "true"/);
});
test("CAPTCHA and origin checks precede privileged database call", () => {
  assert.ok(api.indexOf("TURNSTILE_SECRET_KEY") < api.indexOf('admin.rpc("submit_business_inquiry"'));
  assert.ok(api.indexOf("BUSINESS_INQUIRIES_ALLOWED_ORIGIN") < api.indexOf('admin.rpc("submit_business_inquiry"'));
  assert.match(api, /TURNSTILE_ALLOWED_HOSTNAME/);
});
test("guest form sends actual honeypot and verification token", () => {
  assert.match(form, /honeypot.current\?\.value/);
  assert.match(form, /turnstileToken: token/);
  assert.match(api, /body.website !== ""/);
});
test("database keeps anonymous grants revoked and limits submissions", () => {
  assert.match(schema, /enable row level security/i);
  assert.match(schema, /revoke all on public.public_business_inquiries from anon, authenticated/i);
  assert.match(throttle, /if v_count >= 3 then return false/i);
  assert.match(throttle, /grant execute on function public.submit_business_inquiry\(text,text,text,text\) to service_role/i);
});
