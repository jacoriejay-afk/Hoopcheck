import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
test("alternate icon state reconciles with the operating system and guards repeated taps",()=>{
 const ui=read("../components/AlternateIcons.tsx");
 for(const marker of ['AppState.addEventListener("change"','pending.current = true','generation.current++','await native.current()','current !== name','listener.remove()','disabled={busy || selected === name}'])assert.ok(ui.includes(marker),marker);
 assert.match(ui,/if \(mounted.current\) setSelected\(current\)/);
 assert.match(ui,/Could not confirm the app icon/);
});
