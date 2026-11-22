import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const header = readFileSync("components/SiteHeader.tsx", "utf8");
const css = readFileSync("app/hc-site-rhythm-20261122.css", "utf8");
const layout = readFileSync("app/layout.tsx", "utf8");

// Guests must be able to return to the public landing page, not a login wall.
assert.match(header, /const roleHome=!signedIn\?\{href:"\/",label:"Home"\}/);
assert.match(header, /const feedHome=pathname==="\/fan-feed"/);
assert.match(header, /href=\{onHoopFeed \? feedHome : signedIn \? roleHome\.href : "\/"\}/);
assert.match(header, /<details key=\{pathname\} className="hc-header-more">/);
assert.match(header, /aria-current=\{pathname === item\.href \? "page" : undefined\}/);

// The edge-to-edge page shell must not widen reading-focused desktop pages.
// The final scoped override stays after the broad rhythm rules, without changing mobile.
assert.ok(layout.includes('import "./hc-social-density-20261122.css";'));
assert.ok(layout.indexOf('import "./hc-site-rhythm-20261122.css";') >
  layout.indexOf('import "./hc-social-density-20261122.css";'));
assert.match(css, /@media \(min-width: 1024px\)/);
assert.match(css, /main\.hc-feed-page > \.page-container\s*\{\s*width: min\(100%, 780px\) !important;/);
assert.match(css, /main\.hc-member-profile-page > \.page-container\s*\{\s*width: min\(100%, 1080px\) !important;/);
assert.match(css, /margin-inline: auto !important;/);
assert.ok(css.lastIndexOf("Desktop readability: keep the overall site") >
  css.lastIndexOf("width:100%!important;"), "Desktop override must follow broad full-width rules");
assert.match(css, /env\(safe-area-inset-left,0px\)/);
assert.match(css, /env\(safe-area-inset-right,0px\)/);

let depth=0;
for(const char of css){if(char==="{")depth++;if(char==="}")depth--;assert.ok(depth>=0);}
assert.equal(depth,0,"CSS braces must be balanced");
console.log("PASS: desktop landing navigation and compact reading columns");
