import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const schema = read("supabase/migrations/20261114003000_hoopfeed_post_shares_private_inbox.sql");
const api = read("app/api/hoopfeed/share/route.ts");
const feed = read("app/feed/page.tsx");
const inbox = read("app/feed/inbox/page.tsx");

// These are source-contract checks, not a substitute for authenticated RLS integration tests.
assert.match(schema, /ENABLE ROW LEVEL SECURITY/i);
assert.match(schema, /recipient_id\s*=\s*\(SELECT auth\.uid\(\)\)/i);
assert.match(schema, /hoopfeed_share_sender_unblocked\(sender_id\)/);
assert.match(schema, /GRANT SELECT ON public\.hoopfeed_post_shares TO authenticated/i);
assert.doesNotMatch(schema, /GRANT (?:INSERT|UPDATE|DELETE|ALL) ON public\.hoopfeed_post_shares TO authenticated/i);
assert.match(api, /db\.auth\.getUser\(token\)/);
assert.match(api, /sender === recipientId/);
assert.match(api, /follow_relationships/);
assert.match(api, /user_blocks/);
assert.match(api, /hoopfeed_send_share_atomic/);
assert.match(feed, /fetch\("\/api\/hoopfeed\/share"/);
assert.match(feed, /href="\/feed\/inbox"/);
assert.match(inbox, /\.eq\("recipient_id",session\.user\.id\)/);
assert.match(inbox, /from\("feed_posts"\)/);
assert.match(inbox, /\/feed#post-/);
console.log("HoopFeed share source contracts passed; live role-based tests still required.");
