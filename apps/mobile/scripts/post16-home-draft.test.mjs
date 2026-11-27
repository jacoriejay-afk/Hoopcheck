import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createDraftStore } from "../src/native/draftStore.ts";
const owner="11111111-1111-4111-8111-111111111111", other="22222222-2222-4222-8222-222222222222";
test("HoopFeed draft survives screen navigation but never owner transition",()=>{
 const store=createDraftStore(),key="feed:post:"+owner;
 store.switchUser(owner);
 assert.equal(store.write(owner,key,"Unfinished text"),true);
 assert.equal(store.read(owner,key),"Unfinished text");
 assert.equal(store.write(owner,"feed:post:"+other,"wrong target"),false);
 store.switchUser(owner);
 assert.equal(store.read(owner,key),"Unfinished text");
 store.switchUser(other);
 assert.equal(store.write(owner,key,"late write"),false);
 assert.equal(store.read(other,key),"");
 store.switchUser(owner);
 assert.equal(store.read(owner,key),"");
});
test("HoopFeed draft uses provider and only clears confirmed submitted text",()=>{
 const feed=readFileSync(new URL("../app/feed.tsx",import.meta.url),"utf8");
 assert.match(feed,/useNativeDraft\(\x60feed:post:\$\{uid \?\? ""\}\x60, uid\)/);
 assert.match(feed,/setDraft\(current => current === text \? "" : current\)/);
 assert.match(feed,/onChangeText=\{setDraft\}/);
 assert.doesNotMatch(feed,/draft\.owner|draft\.text/);
});
test("Dashboard group entry is honest about availability and uses verified account identity",()=>{
 const home=readFileSync(new URL("../app/dashboard.tsx",import.meta.url),"utf8");
 assert.match(home,/const identityLabel = currentAccount\?\.user\.displayName/);
 assert.doesNotMatch(home,/supabase\.auth\.getUser\(/);
 assert.match(home,/testID="home-hoopgroups"/);
 assert.match(home,/EXPO_PUBLIC_HOOPGROUPS_CHANNELS_ENABLED === "true"/);
 assert.match(home,/groupsEnabled\?"Browse groups and channels":"Group creation and channels are preparing for launch\."/);
 assert.match(home,/router\.push\("\/hoopgroups"\)/);
});
