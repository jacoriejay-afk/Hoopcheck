import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const profile = read("../app/profile/page.tsx");
const journey = read("../components/PlayerJourney.tsx");
const layout = read("../app/layout.tsx");
const css = read("../app/hoopcheck-passport-mobile-spacing.css");

assert.match(profile, /<PlayerJourney playerId=\{p\.id\}/, "Player owner profile must show real Career Passport");
assert.match(profile, /getHoopCheckEntitlements/);
assert.match(profile, /canUseProPassport/);
assert.match(journey, /from\("player_career_stops"\)/);
assert.match(journey, /isOwnProfile \? stops : stops\.filter\(stop => stop\.is_public\)/);
assert.match(journey, /normalizePassportCountry/);
assert.match(journey, /new Map<string/);
assert.match(journey, /aria-label="Career country stamps"/);
assert.match(journey, /Private entries are visible only to you/);
assert.match(journey, /Career entries are player-reported/);
assert.doesNotMatch(journey, /\["Austria","Portugal","Azerbaijan"\]/, "Do not hardcode personal stamps");
assert.match(layout, /statusBarStyle: "default"/);
assert.match(css, /safe-area-inset-top/);
assert.match(css, /hc-court-actions a span/);
assert.match(css, /scroll-padding-block-end/);
console.log("PASS: Build 9 passport stamps, privacy and mobile safe-area contracts");
