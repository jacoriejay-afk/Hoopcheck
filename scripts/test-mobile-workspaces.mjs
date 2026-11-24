import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
import ts from "typescript";
function compile(path, imports) {
 const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const m={exports:{}};new Function("require","module","exports",code)(imports,m,m.exports);return m.exports;
}
const uid="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222";
const mfa=compile("../lib/auth/mfa-core.ts",()=>{throw Error("Unexpected import");});
function fixture(opts={}){
 const calls=[],token=Buffer.from("{}").toString("base64url")+"."+Buffer.from(JSON.stringify({sub:uid,exp:Math.floor(Date.now()/1000)+3600,aal:opts.aal||"aal1"})).toString("base64url")+".signature";
 const user={id:uid,email_confirmed_at:opts.unconfirmed?null:"2026-01-01",user_metadata:{role:"owner"},factors:opts.mfa?[{id:other,status:"verified",factor_type:"totp"}]:[]};
 const db={auth:{getUser:async t=>{calls.push(["auth",t]);return {data:{user:opts.invalid?null:user},error:null};},getClaims:async t=>{calls.push(["claims",t]);return {data:{claims:{role:opts.role||"authenticated"}},error:null};}},rpc:async name=>{calls.push(["ownerRPC",name]);return {data:opts.owner===true,error:null};}};
 const access=compile("../lib/ambassador/mobile-access.ts",name=>name==="../auth/mfa-core"?mfa:name==="./server"?{getAmbassadorWorkspace:async id=>{calls.push(["grant",id]);return opts.ambassador===true;}}:(()=>{throw Error(name);})());
 const {GET}=compile("../app/api/mobile/workspaces/route.ts",name=>{
  if(name==="next/server")return {NextResponse:{json:(data,init)=>Response.json(data,init)}};
  if(name==="@supabase/supabase-js")return {createClient:()=>db};
  if(name.endsWith("mobile-access"))return access;
  if(name.endsWith("ambassador/server"))return {ambassadorDb:()=>({rpc:async(name,args)=>{calls.push(["ledger",name,args]);return {data:{code:"FIXTURE",active:true},error:null};}})};
  if(name.endsWith("owner/metrics"))return {getOwnerMetrics:async()=>{calls.push(["metrics"]);return [{label:"Registered profiles",value:"5"}];}};
  if(name.endsWith("owner/stripe-summary"))return {getOwnerStripeSummary:async()=>{calls.push(["stripe"]);return {error:"Unavailable"};}};
  throw Error(name);
 });
 process.env.NEXT_PUBLIC_SUPABASE_URL="https://fixture.example";process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="fixture";
 return {calls,token,get:(kind,auth="Bearer "+token)=>GET(new Request("https://fixture.example/api/mobile/workspaces?kind="+kind+"&user="+other,{headers:{authorization:auth}}))};
}
test("workspace API denies anonymous, invalid, unconfirmed and insufficient-MFA identities before service reads",async()=>{
 for(const options of [{invalid:true},{unconfirmed:true,owner:true,ambassador:true},{mfa:true,owner:true,ambassador:true},{role:"anon",owner:true,ambassador:true},{}]){
  const f=fixture(options);const r=await f.get("owner");assert.ok([401,403].includes(r.status));
  assert.ok(!f.calls.some(c=>["metrics","stripe","ledger"].includes(c[0])));assert.equal(r.headers.get("cache-control"),"private, no-store");
 }
 const f=fixture({owner:true});assert.equal((await f.get("owner","Basic fake")).status,401);assert.deepEqual(f.calls,[]);
});
test("only the approved owner receives aggregate metrics; ambassador access does not grant owner privileges",async()=>{
 const denied=fixture({ambassador:true});assert.equal((await denied.get("owner")).status,403);
 const f=fixture({owner:true,mfa:true,aal:"aal2"});const r=await f.get("owner");assert.equal(r.status,200);
 assert.equal((await r.json()).owner,uid);assert.ok(f.calls.some(c=>c[0]==="metrics"));assert.ok(f.calls.some(c=>c[0]==="stripe"));assert.ok(!f.calls.some(c=>c[0]==="ledger"));
});
test("ambassador grant returns only exact authenticated user's ledger, not URL supplied user",async()=>{
 const f=fixture({ambassador:true});const r=await f.get("ambassador");assert.equal(r.status,200);assert.equal((await r.json()).owner,uid);
 assert.deepEqual(f.calls.find(c=>c[0]==="ledger"),["ledger","ambassador_dashboard",{p_user:uid}]);assert.ok(!f.calls.some(c=>c[0]==="metrics"));
 const denied=fixture({owner:true});assert.equal((await denied.get("ambassador")).status,403);
});
