import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { signupLink } from "../app/links/campaign.mjs";
test("bio campaign tags are allowlisted and do not forward arbitrary input", () => {
  assert.equal(signupLink("instagram"), "/signup?utm_source=instagram&utm_medium=link_in_bio&utm_campaign=hoopcheck_links");
  assert.equal(signupLink("tiktok").includes("utm_source=tiktok"), true);
  for (const input of [undefined, ["instagram"], "https://example.org", "instagram&referral=secret"]) {
    assert.equal(signupLink(input), "/signup?utm_source=hoopcheck&utm_medium=link_in_bio&utm_campaign=hoopcheck_links");
  }
});
test("bio destinations exist and use native logo/fonts and guest-only nav", () => {
  const page = readFileSync(new URL("../app/links/page.tsx", import.meta.url), "utf8");
  const controls = readFileSync(new URL("../app/links/BioLinkControls.tsx", import.meta.url), "utf8");
  for (const route of [...page.matchAll(/href: "(\/[^"]*)"/g), ...controls.matchAll(/href: "(\/[^"]*)"/g)].map(m=>m[1])) {
    assert.ok(existsSync(new URL("../app"+(route === "/" ? "" : route)+"/page.tsx", import.meta.url)), route);
  }
  assert.match(page, /<Logo variant="full"/);
  assert.match(controls, /if \(signedIn\) return null/);
  const css = readFileSync(new URL("../app/links/links.module.css", import.meta.url), "utf8");
  assert.match(css, /var\(--font-display\)/);
  assert.match(css, /var\(--font-sans\)/);
});
