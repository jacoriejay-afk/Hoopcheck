import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const api = readFileSync("app/api/business-inquiries/route.ts", "utf8");
const form = readFileSync("components/PublicBusinessInquiry.tsx", "utf8");
const page = readFileSync("app/partners/page.tsx", "utf8");
const schema = readFileSync("docs/sql/public-business-inquiries.sql", "utf8");
const throttle = readFileSync("docs/sql/business-inquiry-rate-limit.sql", "utf8");
const inbox = readFileSync("app/admin/business-inquiries/page.tsx", "utf8");
const inboxSql = readFileSync("docs/sql/admin-business-inquiry-inbox.sql", "utf8");

test("public endpoint is explicitly server gated", () => {
  assert.match(api, /BUSINESS_INQUIRIES_API_ENABLED/);
  assert.match(api, /!== "true"/);
  assert.match(api, /"Cache-Control": "no-store, private"/);
  assert.match(api, /Number\.isSafeInteger\(Number\(rawLength\)\)/);
  assert.match(api, /total > 12000/);
});
test("guest form is hidden unless explicitly enabled", () => {
  assert.match(page, /NEXT_PUBLIC_BUSINESS_INQUIRIES_ENABLED === "true"/);
  assert.match(page, /guestInquiriesEnabled && !signedIn && <PublicBusinessInquiry \/>/);
  assert.match(page, /\(!guestInquiriesEnabled \|\| signedIn\) && <section/);
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
  assert.match(schema, /^begin;/m);
  assert.match(schema, /^commit;/m);
  assert.match(throttle, /^begin;/m);
  assert.match(throttle, /^commit;/m);
  assert.match(schema, /enable row level security/i);
  assert.match(schema, /revoke all on public.public_business_inquiries from anon, authenticated/i);
  assert.match(throttle, /if v_count >= 3 then return false/i);
  assert.match(throttle, /grant execute on function public.submit_business_inquiry\(text,text,text,text\) to service_role/i);
});

test("CAPTCHA failures are explained to visitors", () => {
  assert.match(form, /Verification expired\. Please complete the security check again\./);
  assert.match(form, /Security verification could not load\. Please retry the check\./);
  assert.match(form, /Security verification is unavailable\. Please refresh and try again\./);
});
test("API rejects non-JSON media types", () => {
  assert.match(api, /JSON content type required\./);
  assert.match(api, /application\\\/json/);
  assert.match(api, /status, headers: responseHeaders/);
});

test("guest inbox relies on admin-gated RPC rather than direct table reads", () => {
  assert.match(inbox, /admin_list_public_business_inquiries/);
  assert.doesNotMatch(inbox, /from\(["']public_business_inquiries["']\)/);
  assert.match(inboxSql, /auth\.uid\(\) is null or not exists/);
  assert.match(inboxSql, /ar\.role/);
  assert.match(inboxSql, /'admin'/);
  assert.match(inboxSql, /revoke all on function public\.admin_list_public_business_inquiries/);
  assert.match(inboxSql, /grant execute on function public\.admin_list_public_business_inquiries\(integer\) to authenticated/);
});
