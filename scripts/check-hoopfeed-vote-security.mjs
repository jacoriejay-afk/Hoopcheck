// Security regression guard: vote endpoint must authorize with caller-scoped RLS.
// Static checks complement, but do not replace, authenticated integration tests.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const source = readFileSync(new URL("../app/api/hoopfeed/moderate/route.ts", import.meta.url), "utf8");
const start = source.indexOf('if (kind === "vote")');
const end = source.indexOf('if (kind === "bookmark")', start);
assert(start >= 0 && end > start, "Expected vote endpoint block");
const vote = source.slice(start, end);
assert.match(vote, /getHoopCheckEntitlements|canWriteHoopFeed|const viewerDb/);
// Caller-scoped client must perform the post lookup; service-role lookup is unsafe.
assert.match(vote, /global:\s*\{\s*headers:\s*\{\s*Authorization:\s*`Bearer \$\{token\}`/);
assert.match(vote, /viewerDb\s*\.from\("feed_posts"\)/);
assert.doesNotMatch(vote, /db\.from\("feed_posts"\)/);
assert.match(vote, /poll\.expires_at/);
assert.match(vote, /poll\.status\s*!==\s*"approved"/);
assert.match(vote, /poll\.post_kind\s*!==\s*"poll"/);
assert.match(vote, /optionIndex\s*>=\s*options\.length/);
console.log("HoopFeed vote endpoint authorization guard passed");
