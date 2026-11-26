import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const js=ts.transpileModule(read("src/native/careerSignup.ts"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {rememberCareerSignup,consumeCareerSignup}=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
const store=()=>{const m=new Map();return {async getItem(k){return m.get(k)??null},async setItem(k,v){m.set(k,v)},async removeItem(k){m.delete(k)}}};
const a="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",b="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
test("signup navigation marker is scoped to account, single use, and expires",async()=>{
 const s=store();await rememberCareerSignup(s,a,1000);
 assert.equal(await consumeCareerSignup(s,b,2000),false);
 assert.equal(await consumeCareerSignup(s,a,2000),true);
 assert.equal(await consumeCareerSignup(s,a,2000),false);
 await rememberCareerSignup(s,a,1000);
 assert.equal(await consumeCareerSignup(s,a,1000+8*86400000),false);
 await rememberCareerSignup(s,"bad",1000);
 assert.equal(await consumeCareerSignup(s,"bad",1000),false);
});
test("storage failure is non-fatal",async()=>{
 const s={async getItem(){throw Error()},async setItem(){throw Error()},async removeItem(){throw Error()}};
 await rememberCareerSignup(s,a);
 assert.equal(await consumeCareerSignup(s,a),false);
});
test("signup handoff is flag gated and subsequent sign in uses server account role",()=>{
 assert.match(read("app/sign-up.tsx"),/nativeCareerClaimsEnabled && accountType === "player"/);
 assert.match(read("app/sign-in.tsx"),/profile\?\.data\?\.account_type === "player"/);
 assert.match(read("app/sign-in.tsx"),/session\?\.user\.id !== data\.user\.id/);
});
