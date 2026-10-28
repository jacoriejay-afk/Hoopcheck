import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import process from "node:process";

const checker = new URL("./check-apple-iap-release-readiness.mjs", import.meta.url);
const cleanEnv = { ...process.env };
delete cleanEnv.APPLE_IAP_BUNDLE_ID;
delete cleanEnv.APPLE_IAP_PRO_PRODUCT_ID;
delete cleanEnv.APPLE_IAP_PREMIUM_PRODUCT_ID;

const missingConfig = spawnSync(process.execPath, [checker.pathname], {
  cwd: process.cwd(),
  env: cleanEnv,
  encoding: "utf8",
});
assert.equal(missingConfig.status, 1, "preflight must block when Apple identifiers are missing");
assert.match(missingConfig.stderr, /Apple IAP release-readiness check: BLOCKED/);
assert.match(missingConfig.stderr, /permanent, registered iOS bundle identifier/);
assert.match(missingConfig.stderr, /APPLE_IAP_PRO_PRODUCT_ID/);
assert.match(missingConfig.stderr, /APPLE_IAP_PREMIUM_PRODUCT_ID/);

const placeholderConfig = spawnSync(process.execPath, [checker.pathname], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    APPLE_IAP_BUNDLE_ID: "com.example.hoopcheck",
    APPLE_IAP_PRO_PRODUCT_ID: "hoopcheck.pro.monthly",
    APPLE_IAP_PREMIUM_PRODUCT_ID: "hoopcheck.premium.monthly",
  },
  encoding: "utf8",
});
assert.equal(placeholderConfig.status, 1, "preflight must reject placeholder bundle identifiers");
assert.match(placeholderConfig.stderr, /APPLE_IAP_BUNDLE_ID to the registered iOS bundle identifier/);

console.log("Apple IAP release-readiness fail-closed tests passed.");
