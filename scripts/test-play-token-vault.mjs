import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import * as crypto from "node:crypto";
import ts from "typescript";
const exports={};
new Function("exports","require",ts.transpileModule(readFileSync(new URL("../lib/server/play/token-vault.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,key=>{if(key==="server-only")return {};if(key==="node:crypto")return crypto;if(key==="../../billing/play-products")return {PLAY_PACKAGE:"online.hoopcheck.app"};throw Error("Unexpected import");});
const {createPlayTokenVault}=exports;
const a="11111111-1111-4111-8111-111111111111",b="22222222-2222-4222-8222-222222222222",token="synthetic-fixture-purchase-token",key="ab".repeat(32),index="cd".repeat(32);
const vault=createPlayTokenVault(key,index);
test("authenticated encryption round trips with random nonces and stable unique index",()=>{
 const first=vault.seal(token,a,"test"),second=vault.seal(token,a,"test");
 assert.equal(first.fingerprint,second.fingerprint);assert.notEqual(first.envelope,second.envelope);
 assert.equal(vault.open(first,a,"test"),token);assert.equal(vault.open(second,a,"test"),token);
 assert.equal(vault.seal(token,b,"test").fingerprint,first.fingerprint);
 assert.notEqual(vault.fingerprint(token,"production"),first.fingerprint);
 assert.doesNotMatch(JSON.stringify(first),/synthetic-fixture-purchase-token/);
});
test("cross-account, cross-environment, key and fingerprint substitution rejected",()=>{
 const record=vault.seal(token,a,"test");
 for(const fn of [()=>vault.open(record,b,"test"),()=>vault.open(record,a,"production"),()=>createPlayTokenVault("ef".repeat(32),index).open(record,a,"test"),()=>createPlayTokenVault(key,"ef".repeat(32)).open(record,a,"test"),()=>vault.open({...record,fingerprint:"12".repeat(32)},a,"test")])assert.throws(fn,{message:"Google Play purchase credential is unavailable."});
});
test("tampering with nonce, tag, ciphertext, version and encodings fails closed",()=>{
 const record=vault.seal(token,a,"test");
 for(const i of [1,2,3]){const parts=record.envelope.split(".");parts[i]=(parts[i][0]==="A"?"B":"A")+parts[i].slice(1);assert.throws(()=>vault.open({...record,envelope:parts.join(".")},a,"test"));}
 for(const bad of [{...record,version:2},{...record,envelope:record.envelope+"="},{...record,envelope:"x".repeat(5601)},{...record,fingerprint:""}])assert.throws(()=>vault.open(bad,a,"test"));
});
test("invalid inputs and key reuse rejected; maximum token length round trips",()=>{
 for(const k of ["", "zz".repeat(32), "ab".repeat(31),index])assert.throws(()=>createPlayTokenVault(k,index));
 for(const t of ["a/b/c","short","x".repeat(4097)])assert.throws(()=>vault.seal(t,a,"test"));
 assert.throws(()=>vault.seal(token,"bad","test"));assert.throws(()=>vault.seal(token,a,"unknown"));
 const long="x".repeat(4096);assert.equal(vault.open(vault.seal(long,a,"test"),a,"test"),long);
});
