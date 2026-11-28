import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const source=ts.transpileModule(read("../lib/onboarding-boundary.ts"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};new Function("exports",source)(exports);
const {isOnboardingRole,safeOnboardingReturn}=exports;
test("all six profile roles are recognized; arbitrary roles are rejected",()=>{
 for(const role of ["player","coach","scout","agent","fan","manager"])assert.equal(isOnboardingRole(role),true);
 for(const role of ["admin","owner","moderator","",null,{}])assert.equal(isOnboardingRole(role),false);
});
test("return path cannot leave origin or loop to login",()=>{
 const origin="https://fixture.invalid";
 for(const path of ["//evil.invalid","/\\evil.invalid","/\t/evil.invalid","/%2fevil.invalid","/login","/login/extra","/x/../login","https://evil.invalid",null])assert.equal(safeOnboardingReturn(path,origin),"",String(path));
 assert.equal(safeOnboardingReturn("/teams?country=France#results",origin),"/teams?country=France#results");
});
test("onboarding verifies owner and role, pins write session, and requires confirmed row",()=>{
 const page=read("../app/onboarding/page.tsx");
 assert.doesNotMatch(page,/user_metadata/);
 assert.match(page,/manager:"Team Manager"/);
 assert.match(page,/readOwnProfile/);
 assert.match(page,/profile\.account_type!==accountType/);
 assert.match(page,/\.eq\("id",owner\)\.setHeader\("Authorization",/);
 assert.match(page,/data\?\.id!==owner/);
 assert.match(page,/finally\{setSaving\(false\);\}/);
});
