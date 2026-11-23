#!/usr/bin/env node
/**
 * Real signed-HTTP privacy acceptance. ALLOWLIST: HoopCheck-PR17-Test ONLY.
 * No SQL, billing, mutations, credential minting, token printing or redirects.
 * Prerequisites: approved isolated migrations and disposable test JWT sessions.
 */
import assert from "node:assert/strict";

const TARGET = "https://vcprqpjkyubzzcjatdpx.supabase.co";
const UUID = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const envNames = [
  "BUILD9_ACCEPTANCE_URL", "BUILD9_ACCEPTANCE_ANON_KEY",
  "BUILD9_ACCEPTANCE_OWNER_AAL1_TOKEN", "BUILD9_ACCEPTANCE_OWNER_AAL2_TOKEN", "BUILD9_ACCEPTANCE_ANON_AUTH_TOKEN",
  "BUILD9_ACCEPTANCE_NONOWNER_TOKEN", "BUILD9_ACCEPTANCE_PUBLIC_PLAYER_ID",
  "BUILD9_ACCEPTANCE_PRIVATE_PLAYER_ID", "BUILD9_ACCEPTANCE_OPTOUT_PLAYER_ID"
];
function safeOrigin(raw) {
  const u = new URL(raw);
  assert.equal(u.origin, TARGET, "Only the exact isolated PR17 test project is allowed");
  assert.equal(u.pathname, "/", "Use only the project origin");
  assert.equal(u.search, "", "No query allowed in project origin");
  assert.equal(u.hash, "", "No fragment allowed in project origin");
  assert.equal(u.username, "", "No credentials in project origin");
  assert.equal(u.password, "", "No credentials in project origin");
  assert.equal(u.protocol, "https:");
  return u.origin;
}
function claim(token, field) {
  const parts = token.split(".");
  assert.equal(parts.length, 3, "Auth session JWT required");
  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"))[field];
}
function config(env) {
  const missing = envNames.filter(n => !env[n]);
  assert.equal(missing.length, 0, "Missing test-only env vars: " + missing.join(", "));
  const base = safeOrigin(env.BUILD9_ACCEPTANCE_URL);
  const ids = ["PUBLIC_PLAYER_ID", "PRIVATE_PLAYER_ID", "OPTOUT_PLAYER_ID"];
  for(const suffix of ids) assert.match(env["BUILD9_ACCEPTANCE_"+suffix], UUID, suffix+" must be a UUID");
  const a1=env.BUILD9_ACCEPTANCE_OWNER_AAL1_TOKEN;
  const a2=env.BUILD9_ACCEPTANCE_OWNER_AAL2_TOKEN;
  const other=env.BUILD9_ACCEPTANCE_NONOWNER_TOKEN;
  const anonAuth=env.BUILD9_ACCEPTANCE_ANON_AUTH_TOKEN;
  const owner=claim(a1,"sub");
  assert.match(owner, UUID, "Owner must be an Auth user");
  assert.equal(claim(a1,"role"), "authenticated");
  assert.equal(claim(a1,"aal"), "aal1", "Enrolled owner's AAL1 token required");
  assert.equal(claim(a2,"aal"), "aal2", "Verified AAL2 token required");
  assert.equal(claim(a2,"role"), "authenticated", "AAL2 owner must be authenticated");
  assert.equal(claim(a2,"sub"), owner, "Owner AAL1/AAL2 must be same user");
  for(const token of [a1,a2,other]) {
    assert.notEqual(claim(token,"is_anonymous"),true,"Ordinary test users must not be anonymous Auth");
  }
  assert.equal(claim(anonAuth,"role"),"authenticated","Anonymous Auth carries authenticated DB role");
  assert.equal(claim(anonAuth,"is_anonymous"),true,"Real anonymous Auth session required");
  assert.match(claim(anonAuth,"sub"),UUID,"Anonymous Auth subject must be a UUID");
  assert.notEqual(claim(anonAuth,"sub"),owner,"Anonymous Auth must differ from owner");
  assert.notEqual(claim(other,"sub"), owner, "Nonowner must be a different user");
  assert.match(claim(other,"sub"),UUID,"Nonowner must have a user ID");
  assert.notEqual(claim(other,"sub"),claim(anonAuth,"sub"),"Nonowner and anonymous Auth must differ");
  assert.equal(claim(other,"role"), "authenticated");
  assert.notEqual(env.BUILD9_ACCEPTANCE_PUBLIC_PLAYER_ID, env.BUILD9_ACCEPTANCE_PRIVATE_PLAYER_ID);
  return {base,key:env.BUILD9_ACCEPTANCE_ANON_KEY,a1,a2,other,anonAuth,owner,
    publicPlayer:env.BUILD9_ACCEPTANCE_PUBLIC_PLAYER_ID,
    privatePlayer:env.BUILD9_ACCEPTANCE_PRIVATE_PLAYER_ID,
    optoutPlayer:env.BUILD9_ACCEPTANCE_OPTOUT_PLAYER_ID};
}
async function call(c,route,token,body) {
  const allowed = /^\/(auth\/v1\/user|rest\/v1\/profiles\?|rest\/v1\/rpc\/(get_public_player_profile|get_own_profile|get_public_follow_list)$)/;
  assert.match(route, allowed, "Unreviewed request endpoint is forbidden");
  const headers = {"apikey":c.key,"Accept":"application/json","Cache-Control":"no-store"};
  if(token) headers.Authorization="Bearer "+token;
  if(body!==undefined) headers["Content-Type"]="application/json";
  const response=await fetch(c.base+route,{
    method:body===undefined?"GET":"POST",headers,
    body:body===undefined?undefined:JSON.stringify(body),
    redirect:"error",cache:"no-store",signal:AbortSignal.timeout(15000)
  });
  return {status:response.status,data:await response.json().catch(()=>null)};
}
function denied(r) {
  return r.status===401 || r.status===403 ||
    (r.status===400 && (r.data?.code==="42501" || r.data?.hint==="mfa_required"));
}
function rows(r,desc) {
  assert.equal(r.status,200,desc+" must return HTTP 200");
  assert.ok(Array.isArray(r.data),desc+" must return a JSON array");
  return r.data;
}
async function check(label,run) {
  await run();
  console.log("PASS "+label);
}
async function accept(env) {
  const c=config(env);
  console.log("HoopCheck Build 9: PR17-only signed HTTP test; no test data or JWTs printed");
  for(const [name,token] of [["owner AAL1",c.a1],["owner AAL2",c.a2],["nonowner",c.other],["anonymous Auth",c.anonAuth]]) {
    await check("Auth verified "+name,async()=>{
      const r=await call(c,"/auth/v1/user",token);
      assert.equal(r.status,200,"Auth /user must validate session");
      assert.equal(r.data?.id,claim(token,"sub"),"Authenticated user must match token");
    });
  }
  for(const [name,token] of [["anonymous",undefined],["anonymous Auth",c.anonAuth],["nonowner",c.other],["owner AAL2",c.a2]]) {
    await check(name+" raw protected columns denied",async()=>{
      const r=await call(c,"/rest/v1/profiles?select=id%2Ccurrent_country%2Cmoderation_note&limit=1",token);
      assert.ok(denied(r),"Raw protected column access must fail, not return zero rows");
    });
  }
  await check("public player discoverable anonymously",async()=>{
    const r=await call(c,"/rest/v1/rpc/get_public_player_profile",undefined,{p_user_id:c.publicPlayer});
    const a=rows(r,"public detail");
    assert.equal(a.length,1,"Fixture must be a public player");
    assert.equal(a[0].id,c.publicPlayer);
  });
  await check("private player hidden from unrelated user",async()=>{
    const a=rows(await call(c,"/rest/v1/rpc/get_public_player_profile",c.other,{p_user_id:c.privatePlayer}),"private detail");
    assert.equal(a.length,0,"Unrelated user must not see private player detail");
  });
  await check("current-country opt-out masked",async()=>{
    const a=rows(await call(c,"/rest/v1/rpc/get_public_player_profile",c.other,{p_user_id:c.optoutPlayer}),"country detail");
    assert.equal(a.length,1,"Opt-out fixture must be publicly visible");
    assert.equal(a[0].current_country,null,"Private country must not be returned");
  });
  await check("enrolled AAL1 owner projection blocked",async()=>{
    const r=await call(c,"/rest/v1/rpc/get_own_profile",c.a1,{});
    assert.ok(denied(r),"Enrolled AAL1 must be denied by MFA policy");
  });
  await check("verified AAL2 owner projection works",async()=>{
    const r=await call(c,"/rest/v1/rpc/get_own_profile",c.a2,{});
    assert.equal(r.status,200,"AAL2 projection must succeed");
    assert.ok(r.data && !Array.isArray(r.data),"Owner RPC must return jsonb object");
    assert.equal(r.data.id,c.owner,"Owner RPC must return caller's profile");
  });
  await check("public follower RPC is installed",async()=>{
    rows(await call(c,"/rest/v1/rpc/get_public_follow_list",undefined,{
      p_mode:"followers",p_target_type:"player",p_target_id:c.publicPlayer,p_user_id:null
    }),"public follow list");
  });
  console.log("PASS all isolated signed-HTTP acceptance checks");
}
if(process.argv.includes("--self-test")) {
  assert.equal(safeOrigin(TARGET),TARGET);
  for(const wrong of ["https://ucbdceaieyenljcwlhnj.supabase.co",
    "http://vcprqpjkyubzzcjatdpx.supabase.co",
    "https://vcprqpjkyubzzcjatdpx.supabase.co.evil.test",
    "https://vcprqpjkyubzzcjatdpx.supabase.co/rest/v1"]) assert.throws(()=>safeOrigin(wrong));
  assert.equal(denied({status:403}),true);
  assert.equal(denied({status:200}),false);
  assert.throws(()=>config({}),/Missing test-only/);
  console.log("PASS test-only URL guard, MFA denial expectations and credential preflight");
} else {
  try {await accept(process.env);}
  catch (e) {
    // Never include raw responses, headers, JWTs, or sensitive profile fields.
    console.error("FAIL Build 9 signed HTTP acceptance: "+(e instanceof Error?e.message:"test failed"));
    process.exitCode=1;
  }
}
