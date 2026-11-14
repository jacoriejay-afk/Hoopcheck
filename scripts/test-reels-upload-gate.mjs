import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../app/api/reels/upload/route.ts", import.meta.url), "utf8");
const rollout = readFileSync(new URL("../lib/reels-rollout.ts", import.meta.url), "utf8");
const auth = readFileSync(new URL("../lib/reels-publisher-auth.ts", import.meta.url), "utf8");

assert.match(route, /authorizeReelPublisher\(token\)/, "upload must reauthorize the caller");
assert.match(route, /if \(!REELS_MEDIA_UPLOAD_ENABLED\)/, "upload must check rollout gate");
assert.match(route, /Upload pipeline not implemented/, "upload must fail closed even if rollout gate changes");
assert.doesNotMatch(route, /createSignedUploadUrl|\.upload\(|\.from\("reels"\)\.insert/, "upload cannot write media or rows before approval");
assert.match(rollout, /REELS_MEDIA_UPLOAD_ENABLED = false/, "uploads stay disabled");
assert.match(auth, /auth\.getUser\(token\)/, "verify JWT server-side");
assert.match(auth, /canWriteHoopFeed/, "reuse paid HoopFeed gate");
assert.match(auth, /moderation_status/, "verify account moderation");
console.log("REELS-1 upload rollout fail-closed checks passed");
