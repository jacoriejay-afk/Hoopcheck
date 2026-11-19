import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
const certificates = ["AppleIncRootCertificate.cer", "AppleRootCA-G2.cer", "AppleRootCA-G3.cer"];
const routes = ["mobile/purchases/config", "mobile/purchases/intent", "mobile/purchases/sync", "apple/notifications", "membership", "stripe/webhook/create-checkout"];
for (const route of routes) {
  const manifest = resolve(`.next/server/app/api/${route}/route.js.nft.json`);
  const { files } = JSON.parse(readFileSync(manifest, "utf8"));
  for (const name of certificates) {
    const traced = files.find(path => path.endsWith(`/lib/server/apple/certs/${name}`));
    assert.ok(traced && existsSync(resolve(dirname(manifest), traced)), `${route}: missing deployed Apple trust root ${name}`);
  }
}
console.log(`PASS: all three pinned public Apple trust roots traced into ${routes.length} server routes`);
