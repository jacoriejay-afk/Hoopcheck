import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {officialCatalog,reviewedOfficialAsset} from "../native-candidates/picture-in-picture/officialVideoPolicy.ts";
const catalog=Object.freeze({"guide":{asset:123,rights:"hoopcheck-owned-public-pip",evidence:"synthetic test only"}});
test("default-off catalog denies all public and private sources",()=>{
 for(const id of ["guide","https://hoopcheck.online/video.mp4","file:///private.mp4","__proto__","constructor","feed","reels",123,null])assert.equal(reviewedOfficialAsset(officialCatalog,id,true,true,true),null);
 assert.equal(reviewedOfficialAsset(catalog,"guide",true,true,true),123);
 for(const gates of [[false,true,true],[true,false,true],[true,true,false]])assert.equal(reviewedOfficialAsset(catalog,"guide",...gates),null);
});
test("unknown rights, invalid asset and missing evidence cannot be used",()=>{
 for(const value of [{asset:1,rights:"private",evidence:"x"},{asset:0,rights:"hoopcheck-owned-public-pip",evidence:"x"},{asset:"https://example.com",rights:"hoopcheck-owned-public-pip",evidence:"x"},{asset:1,rights:"hoopcheck-owned-public-pip",evidence:" "}]){
  assert.equal(reviewedOfficialAsset({guide:value},"guide",true,true,true),null);
 }
 assert.equal(reviewedOfficialAsset(Object.create(catalog),"guide",true,true,true),null);
});
test("feed remains explicitly ineligible; candidate has no automatic PiP or config capability",()=>{
 const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
 assert.match(read("../components/FeedVideo.tsx"),/allowsPictureInPicture=\{false\}/);
 const component=read("../native-candidates/picture-in-picture/OfficialGuideVideo.tsx");
 assert.match(component,/startsPictureInPictureAutomatically=\{false\}/);
 assert.match(component,/EXPO_PUBLIC_HOOPCHECK_OFFICIAL_VIDEO_PIP_ENABLED === "true"/);
 assert.match(component,/stopPictureInPicture\(\)/);
 assert.doesNotMatch(read("../app.config.js"),/supportsPictureInPicture\s*:\s*true/);
});
