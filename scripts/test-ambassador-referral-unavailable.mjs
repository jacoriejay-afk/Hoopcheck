import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("app/referral/[code]/route.ts", "utf8");
const page = readFileSync("app/signup/page.tsx", "utf8");
const form = readFileSync("app/signup/SignupForm.tsx", "utf8");

test("an unavailable referral is not silently treated as attributed signup", () => {
  assert.match(route, /new URL\("\/signup\?referral=unavailable"/);
  assert.match(route, /if \(error \|\| typeof data !== "string"\) return unavailable\(\);/);
  assert.match(route, /response\.cookies\.delete\(referralCookie\)/);
  assert.match(route, /!process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
});

test("success still mints a fresh short-lived secure referral cookie", () => {
  assert.match(route, /response\.cookies\.set\(referralCookie, data/);
  assert.match(route, /maxAge: 30 \* 60, httpOnly: true/);
  assert.match(route, /sameSite: "lax"/);
  assert.match(route, /Cache-Control", "private, no-store"/);
});

test("signup explains a regular signup will not be attributed", () => {
  assert.match(page, /referralUnavailable=\{params\.referral === "unavailable"\}/);
  assert.match(form, /referralUnavailable && <p className="hc-auth-feedback" role="alert">/);
  assert.match(form, /it will not be credited to the ambassador/);
});
