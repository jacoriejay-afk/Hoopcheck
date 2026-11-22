import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = filename => readFileSync(filename,"utf8");
const css = read("app/hc-site-rhythm-20261122.css");
const layout = read("app/layout.tsx");
const feed = read("app/feed/page.tsx");
const profile = read("app/profile/page.tsx");
const shell = read("app/hoopcheck-page-shell.css");

assert.ok(layout.indexOf('import "./hc-site-rhythm-20261122.css";') > layout.indexOf('import "./hc-social-density-20261122.css";'),"Unified sheet must follow the existing feed and profile styles");
assert.match(shell, /--hc-shell-gutter/);
for (const selector of [
  "--hc-edge-gutter:8px",
  "--hc-shell-gutter:var(--hc-edge-gutter)",
  "header.site-header-global.hc-template-header",
  "main.hc-feed-page > .page-container",
  "main.hc-member-profile-page > .page-container",
  ".hc-feed-stream .hc-feed-shared-card",
  ".hc-profile-action-hub",
  ".hc-social-profile-nav",
  "env(safe-area-inset-left,0px)",
  "env(safe-area-inset-right,0px)",
  "prefers-reduced-motion",
  "html.theme-light",
  "html.theme-dark",
]) assert.ok(css.includes(selector),"Missing layout contract: "+selector);
assert.ok(!css.includes("nav.hc-lm2f-bottom-nav"),"Do not alter fixed mobile navigation");
assert.match(feed, /<FeedPostCard key=\{p\.id\}/);
assert.match(feed, /HoopFeedCommentsDialog/);
assert.match(feed, /toggleCheck\(p\)/);
assert.match(feed, /toggleSave\(p\)/);
assert.match(feed, /sharePost\(p\)/);
assert.match(profile, /<ProfileLatestPost userId=\{p\.id\}/);
assert.match(profile, /<PlayerJourney playerId=\{p\.id\}/);
assert.match(profile, /<HoopPassport name=\{name\}/);
assert.match(profile, /<details className="hc-profile-nav-more">/);
let opened = 0;
for(const char of css){if(char === "{")opened++;if(char === "}")opened--;assert.ok(opened>=0,"Unmatched brace");}
assert.equal(opened,0,"Unclosed CSS block");
console.log("Unified website edge rhythm contracts passed");
