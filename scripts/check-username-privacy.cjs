// Browser regression: exact username search must not expose private location
// or unapproved avatars through its direct profiles-table query.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const source = fs.readFileSync("app/search/page.tsx", "utf8");
const start = source.indexOf("wantsPlayers && username && page === 1");
const end = source.indexOf(".maybeSingle()", start);
assert.ok(start >= 0 && end > start, "Exact username lookup must exist");
const lookup = source.slice(start, end + ".maybeSingle()".length);
const projection = lookup.match(/\.select\("([^"]+)"\)/)?.[1];
assert.ok(projection, "Exact username lookup must have an explicit column projection");
const columns = projection.split(",").map((part) => part.trim());
assert.ok(!columns.includes("current_country"), "Never retrieve raw private current_country for an exact username result");
assert.ok(!columns.includes("*"), "Do not retrieve all profile columns");
assert.ok(columns.includes("avatar_moderation_status"), "Check moderation before showing a profile avatar");
assert.match(source, /avatar_moderation_status === null/);
assert.match(source, /avatar_moderation_status === "approved"\)\s*\?\s*rawUsernameMatch\.avatar_url\s*:\s*null/);
assert.match(source, /current_country:\s*null/);
console.log("PASS exact username search does not fetch raw private location or unapproved avatars");
