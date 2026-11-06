import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const appConfigPath = path.resolve(process.cwd(), "app.json");
let config;
try {
  config = JSON.parse(await readFile(appConfigPath, "utf8"));
} catch (error) {
  console.error(`Unable to read apps/mobile/app.json: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}

const expo = config.expo ?? {};
const iosBundleId = expo.ios?.bundleIdentifier;
const androidPackage = expo.android?.package;
const appleBundleId = process.env.APPLE_IAP_BUNDLE_ID?.trim();
const proProductId = process.env.APPLE_IAP_PRO_PRODUCT_ID?.trim();
const premiumProductId = process.env.APPLE_IAP_PREMIUM_PRODUCT_ID?.trim();
const blockers = [];

if (!iosBundleId || iosBundleId === "com.example.hoopcheck") {
  blockers.push("Set a permanent, registered iOS bundle identifier in app.json.");
}
if (!androidPackage || androidPackage === "com.example.hoopcheck") {
  blockers.push("Set a permanent Android application ID in app.json.");
}
if (!appleBundleId || appleBundleId === "com.example.hoopcheck") {
  blockers.push("Set APPLE_IAP_BUNDLE_ID to the registered iOS bundle identifier.");
} else if (appleBundleId !== iosBundleId) {
  blockers.push("APPLE_IAP_BUNDLE_ID must exactly match expo.ios.bundleIdentifier.");
}
if (!proProductId) blockers.push("Set APPLE_IAP_PRO_PRODUCT_ID to the App Store Connect product ID.");
if (!premiumProductId) blockers.push("Set APPLE_IAP_PREMIUM_PRODUCT_ID to the App Store Connect product ID.");
if (proProductId && premiumProductId && proProductId === premiumProductId) {
  blockers.push("Pro and Premium must use distinct App Store Connect product IDs.");
}

if (blockers.length) {
  console.error("Apple IAP release-readiness check: BLOCKED");
  for (const blocker of blockers) console.error(`- ${blocker}`);
  console.error("No build, purchase, database, or billing action was performed.");
  process.exit(1);
}

console.log("Apple IAP identifier preflight passed. This does not validate StoreKit, signatures, server reconciliation, or App Store approval.");
