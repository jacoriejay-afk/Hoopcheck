import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
import ts from "typescript";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const data=s=>"data:text/javascript;base64,"+Buffer.from(ts.transpile(s,{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022})).toString("base64");
const input=data(read("lib/career/claim-input.ts"));
const mod=await import(data(read("lib/career/web-review-season-choices.ts").replace('"./claim-input"',JSON.stringify(input))));
test("only canonical server-verified seasons are accepted",()=>{
 const access={exactSeasonRequired:true,canWrite:true,verifiedSeasons:["2024-2025","2023","2024-2025"]};
 assert.deepEqual(mod.parseVerifiedSeasonAccess(access,2026),["2024-2025","2023"]);
 assert.deepEqual(mod.parseVerifiedSeasonAccess({...access,canWrite:false},2026),[]);
 for(const invalid of [{...access,exactSeasonRequired:false},{...access,verifiedSeasons:["2024-25"]},{...access,verifiedSeasons:["2028"]},{...access,verifiedSeasons:null}]) assert.throws(()=>mod.parseVerifiedSeasonAccess(invalid,2026));
});
test("web review forms use verified team scope and submit selected season",()=>{
 for(const path of ["app/teams/[id]/review/page.tsx","app/womens/[id]/review/page.tsx"]){
  const code=read(path);
  assert.match(code,/readVerifiedSeasonChoices\(session\.access_token,id,/);
  assert.match(code,/webExactSeasonReviewsEnabled/);
  assert.match(code,/verifiedSeasons\.includes\(/);
  assert.match(code,/teamId!==id/);
  assert.match(code,/player_season:/);
  assert.match(code,/session.*user\.id!==.*[sS]cope\?\.userId/);
  assert.match(code,/sessionGuard\.observe\(session\?\.user\.id\)/);
  assert.match(code,/sessionGuard\.observe\(after\.session\?\.user\.id\)/);
 }
});

test("same-user auth events do not invalidate access; switching or signing out permanently invalidates it",()=>{
 let invalidations=0;
 const guard=mod.createReviewSessionGuard(()=>invalidations++);
 assert.equal(guard.observe("player-a"),true);
 assert.equal(guard.observe("player-a"),true);
 assert.equal(invalidations,0);
 assert.equal(guard.observe("player-b"),false);
 assert.equal(guard.observe("player-a"),false);
 assert.equal(invalidations,1);
 const signout=mod.createReviewSessionGuard(()=>invalidations++);
 assert.equal(signout.observe("player-a"),true);
 assert.equal(signout.observe(null),false);
 assert.equal(signout.observe("player-a"),false);
 assert.equal(invalidations,2);
});
