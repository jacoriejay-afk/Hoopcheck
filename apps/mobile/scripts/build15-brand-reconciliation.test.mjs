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

test("shared headers and loading use the approved mark and stop repeating animation on cleanup",()=>{
 const logo=read("../components/BrandLogo.tsx"),loading=read("../components/HoopCheckLoading.tsx");
 assert.match(logo,/<BrandMark size=\{32\} ink=\{ink\} animated=\{animated\}/);
 assert.doesNotMatch(logo,/M50 5 88 27/);
 assert.match(loading,/compact \? <BrandMark size=\{17\}/);
 assert.match(loading,/<BrandLockup size=\{32\}/);
 assert.match(read("../components/BrandLockup.tsx"),/<BrandMark size=\{size\} animated=\{animated\}/);
 assert.match(loading,/return \(\) => cancelAnimation\(phase\)/);
 assert.match(loading,/cancelAnimation\(phase\);\s*phase\.set\(0\);\s*if \(!reduced && foreground\) phase\.set\(withRepeat/);
});
