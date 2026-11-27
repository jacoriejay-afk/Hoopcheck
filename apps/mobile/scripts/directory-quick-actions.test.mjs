import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { publicDirectoryShare } from "../src/native/directoryQuickActions.ts";
const id="A1111111-1111-4111-8111-111111111111";
test("only canonical public directory links are shared",()=>{
 for(const kind of ["teams","womens","leagues","womens/leagues"])assert.deepEqual(publicDirectoryShare(kind,id,"Club"),{title:"Club",message:"Club\nhttps://hoopcheck.online/"+kind+"/"+id.toLowerCase()});
 for(const kind of ["profile","feed","https://evil.invalid","../account"])assert.equal(publicDirectoryShare(kind,id,"Club"),null);
 assert.equal(publicDirectoryShare("teams","../account","Club"),null);
 assert.equal(publicDirectoryShare("teams",id," "),null);
 assert.equal(publicDirectoryShare("teams",id,"Club\nName").title,"Club Name");
});
test("team and league actions retain tap navigation and accessible equivalents",()=>{
 for(const path of ["../components/TeamDirectoryScreen.tsx","../components/LeagueDirectoryScreen.tsx"]){
  const src=readFileSync(new URL(path,import.meta.url),"utf8");
  for(const marker of ["onLongPress","onAccessibilityAction","accessibilityActions","publicDirectoryShare","Share.share(payload)","router.push"])assert.ok(src.includes(marker),path+" "+marker);
 }
});
