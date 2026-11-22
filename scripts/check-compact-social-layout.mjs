import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(path, "utf8");
const css = read("app/hoopcheck-compact-social-20261122.css");
const layout = read("app/layout.tsx");
const profile = read("app/profile/page.tsx");
const feed = read("app/feed/page.tsx");

// The styling must be scoped: the app's entitlement, message, and moderation
// code paths are not replaced by this appearance-only feature.
assert.match(layout, /import "\.\/hoopcheck-compact-social-20261122\.css";/);
assert.match(css, /--hc-social-edge:/);
assert.match(css, /main\.hc-feed-page > \.page-container/);
assert.match(css, /main\.hc-feed-page \.hc-feed-stream/);
assert.match(css, /\.hc-feed-shared-card:not\(\.hc-feed-skeleton\)::before/);
assert.match(css, /\.hc-feed-stream \.hc-feed-action-pill/);
assert.match(css, /\.hc-profile-nav-more__links/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /theme-light/);
assert.match(css, /theme-dark/);
assert.match(profile, /<details className="hc-profile-nav-more">/);
assert.match(profile, /<a href="#profile-about">About<\/a>/);
assert.match(profile, /<a href="#career-passport">Career<\/a>/);
assert.match(profile, /<Link href="\/account#profile-appearance">Customize<\/Link>/);
assert.match(profile, /PlayerJourney playerId=\{p\.id\}/);
assert.match(profile, /<HoopPassport name=\{name\}/);
assert.match(profile, /<ProfileLatestPost userId=\{p\.id\}/);
assert.ok(profile.indexOf('id="profile-about"') < profile.indexOf("<PlayerJourney"), "Profile social overview must precede Career");
assert.ok(profile.indexOf("<ProfileLatestPost") < profile.indexOf("<PlayerJourney"), "Latest approved post should be ahead of Career");
assert.match(feed, /<FeedPostCard key=\{p\.id\}/);
assert.match(feed, /HoopFeedCommentsDialog/);
assert.match(feed, /toggleCheck\(p\)/);
assert.match(feed, /toggleSave\(p\)/);
assert.match(feed, /sharePost\(p\)/);
assert.match(feed, /<FeedMediaArea>/);

console.log("Compact HoopFeed/profile visual contracts passed");
