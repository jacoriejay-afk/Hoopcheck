import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const source=readFileSync(new URL("../src/native/careerClaims.ts",import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {careerRequestUrl,requestCareer}=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
test("career endpoint is confined to HTTPS origin and fixed path",()=>{
 assert.equal(careerRequestUrl("https://hoopcheck.online","claims"),"https://hoopcheck.online/api/career/claims");
 for(const origin of ["http://hoopcheck.online","https://a:b@hoopcheck.online","https://hoopcheck.online/path","https://hoopcheck.online/?q=1","https://hoopcheck.online/#hash"])assert.throws(()=>careerRequestUrl(origin,"claims"));
});
test("private claim requests use bearer and pending-only payload",async()=>{
 let call;
 const request=async(url,opts)=>{call={url,opts};return new Response(JSON.stringify({id:"claim",status:"pending"}),{status:201});};
 const body={kind:"claim",id:"club",source:"teams",season:"2023-24"};
 assert.equal((await requestCareer("https://hoopcheck.online","fixture","claims",{body},request)).status,"pending");
 assert.equal(call.opts.headers.Authorization,"Bearer fixture");
 assert.equal(call.opts.cache,"no-store");
 assert.equal(call.opts.redirect,"error");
 assert.deepEqual(JSON.parse(call.opts.body),body);
 await assert.rejects(()=>requestCareer("https://hoopcheck.online","","claims",{},request));
 await assert.rejects(()=>requestCareer("https://hoopcheck.online","fixture","claims",{},async()=>new Response(null,{status:409})),/already exists/);
});
test("native intake is gated and checks session ownership",()=>{
 const screen=readFileSync(new URL("../app/account/career-history.tsx",import.meta.url),"utf8");
 const account=readFileSync(new URL("../app/account.tsx",import.meta.url),"utf8");
 assert.match(source,/EXPO_PUBLIC_HOOPCHECK_CAREER_CLAIMS_ENABLED==="true"/);
 assert.match(screen,/session\?\.user\.id!==userId/);
 assert.match(screen,/after\.data\.session\?\.user\.id!==userId/);
 assert.match(screen,/if\(lock\.current\)return/);
 assert.match(screen,/reviews are not unlocked/);
 assert.match(account,/nativeCareerClaimsEnabled \? <AccountRow/);
});

test("account identity changes permanently hide the private intake and reject further actions on that mount",()=>{
 const screen=readFileSync(new URL("../app/account/career-history.tsx",import.meta.url),"utf8");
 assert.match(screen,/session\?\.user\.id!==userId\)\{active\.current=false;version\.current\+\+;setSessionInvalidated\(true\)/);
 assert.match(screen,/setName\(""\);setSeason\(""\);setCountry\(""\)/);
 assert.match(screen,/if\(sessionInvalidated\)return <Text/);
 assert.match(screen,/if\(!active\.current\)return;lock\.current=true/);
});
