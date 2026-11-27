import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { readPublicShowcase } from "../src/native/publicNetwork.ts";
const id="12345678-1234-4123-8123-123456789abc";
const other="12345678-1234-4123-8123-123456789abd";
const person={id,display_name:"Court Agency",account_type:"agent",country:"Portugal",private_email:"private@example.test"};
test("native detail uses exact published API identity and omits credentials",async()=>{
 const entry=await readPublicShowcase("https://hoopcheck.online","agents",id,undefined,async(url,opts)=>{
  assert.equal(url,"https://hoopcheck.online/api/network/agents?id="+id);
  assert.equal(opts.credentials,"omit");assert.equal(opts.redirect,"error");assert.equal(opts.cache,"no-store");
  return Response.json({person});
 });
 assert.equal(entry.id,id);assert.equal(entry.name,"Court Agency");assert.equal("private_email" in entry,false);
 await assert.rejects(readPublicShowcase("https://hoopcheck.online","agents",id,undefined,async()=>Response.json({person:{...person,id:other}})),/identity/);
 assert.equal(await readPublicShowcase("https://hoopcheck.online","agents",id,undefined,async()=>new Response("",{status:404})),null);
 await assert.rejects(readPublicShowcase("https://hoopcheck.online","agents","bad",undefined,async()=>{throw Error("unexpected request")}),/Invalid showcase/);
});
test("creator details share the public projection and reject invalid categories",async()=>{
 const creator={profile_id:id,category:"podcast",headline:"Basketball stories",profiles:{id,display_name:"Court Talk",private_email:"hidden"}};
 const entry=await readPublicShowcase("https://hoopcheck.online","creators",id,undefined,async()=>Response.json({creator}));
 assert.equal(entry.name,"Court Talk");assert.equal("profiles" in entry,false);
 await assert.rejects(readPublicShowcase("https://hoopcheck.online","creators",id,undefined,async()=>Response.json({creator:{...creator,category:"unknown"}})),/category/);
});
test("native network uses single stack title, fresh detail, and gated role actions",()=>{
 const screen=readFileSync(new URL("../app/account/network.tsx",import.meta.url),"utf8");
 assert.match(screen,/<Stack.Screen options=\{\{ title \}\}/);
 assert.doesNotMatch(screen,/>[\s]*\{title\}<\/Text>/);
 assert.match(screen,/readPublicShowcase\(origin, kind, selectedId, controller.signal\)/);
 assert.match(screen,/focused && !offline && detail\?\.id === selectedId/);
 assert.match(screen,/canBrowsePlayers\(account.user.accountType\)/);
 assert.doesNotMatch(screen,/View public showcase \(website\)/);
});
test("player directory keeps the existing role gate and synchronously locks pagination",()=>{
 const screen=readFileSync(new URL("../app/players.tsx",import.meta.url),"utf8");
 assert.match(screen,/<PlayerAccess>/);
 assert.match(screen,/if \(paging.current \|\| loading/);
 assert.match(screen,/paging.current = true; setLoading\(true\)/);
 assert.match(screen,/finally \{ paging.current = false; \}/);
 assert.match(screen,/new Map\(\[\.\.\.current, \.\.\.page\]/);
 assert.doesNotMatch(screen,/router.back\(\)/);
});
