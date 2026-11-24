import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
test("approved brand is used inside existing arena and community surfaces",()=>{
 const arena=read("../components/ArenaBrand.tsx"),feed=read("../app/feed.tsx"),mark=read("../components/BrandLockup.tsx");
 assert.match(arena,/<BrandMark size=\{size\} ink=\{ink\}/);
 assert.match(arena,/markOnly/);
 assert.match(feed,/<CommunityWordmark size=\{24\}/);
 assert.match(feed,/<CommunityWordmark reels size=\{22\}/);
 assert.match(mark,/useMotionSetting/);assert.match(mark,/cancelAnimation/);
 assert.match(mark,/if \(animated && !reduced\)/);
 assert.match(feed,/canReadHoopFeed/);assert.match(feed,/canWriteHoopFeed/);
});
