import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../app/api/apple-iap/account-token/route.ts", import.meta.url),
  "utf8",
);

// Static security contract only; this does not contact Supabase or execute the route.
assert.match(source, /export const runtime = ["']nodejs["']/);
assert.match(source, /export const dynamic = ["']force-dynamic["']/);
assert.match(source, /Cache-Control["']?\s*:\s*["']private, no-store, max-age=0["']/);
assert.match(source, /function jsonNoStore\(/);
assert.match(source, /return NextResponse\.json\(body,/);
assert.doesNotMatch(source, /return NextResponse\.json\(/g, "all route responses should go through the no-store helper");
assert.match(source, /auth\.getUser\(accessToken\)/, "the bearer token must be verified with Supabase Auth");
assert.match(source, /\.insert\(\{ user_id: userId \}\)/, "the server derives user_id from the verified session");
assert.doesNotMatch(source, /request\.json\(|request\.formData\(/, "clients must not submit a user ID or appAccountToken");
assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/, "server-side privileged key must be configured");
assert.match(source, /catch \(error\)/, "unexpected database errors should fail closed");
console.log("Apple IAP account-token route static security contract passed.");
