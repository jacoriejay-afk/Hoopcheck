import {readFileSync} from "node:fs";
import {test} from "node:test";
import assert from "node:assert/strict";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
test("video reports and staff moderation share the canonical subject and ticket target",()=>{
 const reporter=read("../src/native/feedReport.ts"),staff=read("../components/StaffReelModeration.tsx"),queue=read("../components/AdminSafetyCenter.tsx");
 assert.match(reporter,/videoReport = !commentId && typeof post\.data\.video_url === "string"/);
 assert.match(reporter,/videoReport \? "Report a HoopFeed Reel" : "Report a HoopFeed post"/);
 assert.ok(reporter.includes("https://hoopcheck.online/feed#post-"));
 assert.match(staff,/ticket\.subject==="Report a HoopFeed Reel"/);
 assert.match(staff,/target\(row\.data\)!==postId/);
 assert.match(staff,/JSON\.stringify\(\{postId,ticketId:ticket\.id,reason:evidence\}\)/);
 assert.match(queue,/\.eq\("category","security"\)/);
 assert.match(queue,/<StaffReelModeration key=\{ticket\.id\}/);
});
test("conversation history uses the verified peer-block bearer and clears stale data on failure",()=>{
 const screen=read("../app/messages.tsx");
 assert.match(screen,/const verifiedHeader=await verifyChatPeer/);
 assert.match(screen,/readConversationPage\(supabase,requestId,signal,older,verifiedHeader,structuredReplies\)/);
 assert.match(screen,/if\(active\(\)\)\{setThreadPage\(null\);setThreadError/);
});
