import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {creatorStudioOwner,createStudioEpoch} from "../../../lib/creator-studio-scope.ts";
test("studio operations are invalidated on identity changes and stale completions cannot bind",()=>{
 const scope=createStudioEpoch(),a=scope.begin();scope.bind(a,"alice");
 assert.ok(scope.current(a,"alice"));assert.equal(scope.current(a,"bob"),false);
 scope.invalidate();const b=scope.begin();scope.bind(b,"bob");scope.bind(a,"alice");
 assert.equal(scope.current(a),false);assert.equal(scope.owner(),"bob");assert.ok(scope.current(b,"bob"));
 assert.equal(creatorStudioOwner("", ""),false);assert.equal(creatorStudioOwner("alice",null),false);
});
test("private creator save verifies both session and user before sending the fixed bearer",()=>{
 const ui=readFileSync(new URL("../../../app/creator-studio/page.tsx",import.meta.url),"utf8");
 const save=ui.slice(ui.indexOf("async function save("),ui.indexOf("return <main"));
 assert.match(save,/creatorStudioOwner\(userId,session.user.id\)/);
 assert.match(save,/supabase.auth.getUser\(session.access_token\)/);
 assert.match(save,/creatorStudioOwner\(userId,verified.data.user\?\.id\)/);
 assert.match(save,/saveLock.current!==null/);
 assert.match(save,/Authorization:"Bearer "\+session.access_token/);
 assert.match(ui,/creatorStudioOwner\(uid,payload.profile\?\.id\)/);
 assert.match(ui,/saveRequest.current\?\.abort\(\)/);
});
