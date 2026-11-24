import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { confirmedMessageMotion } from "../src/native/chatMotion.ts";
const row=(id,day)=>({id,created_at:`2026-11-${day}T00:00:00Z`});
test("chat animation starts static and only acknowledges strictly newer verified messages",()=>{
 const a=confirmedMessageMotion(null,"user:room",[row("old",20)],true);
 assert.deepEqual([...a.fresh],[]);
 const b=confirmedMessageMotion(a,"user:room",[row("old",20),row("new",21),row("unhidden",19)],true);
 assert.deepEqual([...b.fresh],["new"]);
 assert.deepEqual([...confirmedMessageMotion(b,"user:room",[row("new",21)],true).fresh],[]);
 assert.deepEqual([...confirmedMessageMotion(b,"other:room",[row("other",22)],true).fresh],[]);
 assert.equal(confirmedMessageMotion(b,"user:room",[],false),null);
});
test("chat motion preserves verified room reads and local-only draft state",()=>{
 const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
 const game=read("../components/GameChat.tsx"),dm=read("../app/messages.tsx"),motion=read("../components/chat/ChatMotion.tsx");
 assert.match(game,/readGameRoom\(supabase, gameId, userId\)/);
 assert.match(game,/current\.current\.scope !== scope/);
 assert.match(dm,/revision !== generation\.current/);
 assert.match(dm,/hoopChatAuthAction/);
 assert.match(motion,/active && !reduced/);
 assert.match(motion,/LOCAL draft/);
});
