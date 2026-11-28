import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const load=(path,requires={})=>{const e={};new Function("exports","require",ts.transpileModule(readFileSync(new URL(path,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(e,k=>{if(Object.hasOwn(requires,k))return requires[k];throw Error("unexpected import "+k);});return e;};
const products=load("../lib/billing/play-products.ts");
const classifier=load("../lib/billing/play-subscription.ts",{"./play-products":products});
const crypto=await import("node:crypto");
const provider=load("../lib/server/play/verification.ts",{"server-only":{},"node:crypto":crypto,"../../billing/play-products":products,"../../billing/play-subscription":classifier});
const {createPlaySessionAuthorizer,createPlayProviderConflictGuard}=load("../lib/server/play/session-adapter.ts",{"server-only":{},"../apple/service":{appleRequest:()=>{throw Error("unregistered");}},"./verification":provider});
const owner="11111111-1111-4111-8111-111111111111",sessionId="22222222-2222-4222-8222-222222222222";
const env={HOOPCHECK_PLAY_VERIFICATION_ENABLED:"true",HOOPCHECK_PLAY_ENVIRONMENT:"test",NEXT_PUBLIC_SUPABASE_URL:"https://fixture.supabase.co",HOOPCHECK_PLAY_ISOLATED_SUPABASE_URL:"https://fixture.supabase.co"};
const req=(claims={sub:owner,role:"authenticated",session_id:sessionId})=>new Request("https://fixture.invalid",{headers:{authorization:"Bearer x."+Buffer.from(JSON.stringify(claims)).toString("base64url")+".x"}});
function fixture(){
 const state={profile:{account_type:"player",moderation_status:null},deletion:null,stripe:null,apple:[],verified:true};
 const table=name=>({select:()=>table(name),eq:()=>table(name),in:()=>table(name),limit:()=>name==="apple_memberships"?Promise.resolve({data:state.apple,error:null}):table(name),maybeSingle:async()=>({data:name==="profiles"?state.profile:name==="account_deletion_requests"?state.deletion:state.stripe,error:null})});
 const verify=async()=>{if(!state.verified)throw Error("MFA denied");return {scoped:{from:table},db:{from:table},user:{id:owner}};};
 return {state,authorize:createPlaySessionAuthorizer(()=>true,verify,env),canStart:createPlayProviderConflictGuard(()=>true,verify,env)};
}
test("shared verified session id, MFA, role and deletion freeze are enforced before authorization",async()=>{
 const f=fixture();assert.deepEqual(await f.authorize(req()),{owner,sessionId,role:"player"});
 assert.equal(await f.authorize(req({sub:owner,role:"authenticated",session_id:"invalid"})),null);
 f.state.verified=false;assert.equal(await f.authorize(req()),null);
 f.state.verified=true;f.state.deletion={status:"pending"};assert.equal(await f.authorize(req()),null);
 f.state.deletion=null;f.state.profile.moderation_status="suspended";assert.equal(await f.authorize(req()),null);
});
test("existing Apple and Stripe sources block new Play billing without altering them",async()=>{
 const f=fixture(),s={owner,sessionId,role:"player"};assert.equal(await f.canStart(req(),s),true);
 f.state.stripe={stripe_subscription_id:"sub_fixture",status:"active"};assert.equal(await f.canStart(req(),s),false);
 f.state.stripe.status="canceled";f.state.apple=[{status:"billing_retry"}];assert.equal(await f.canStart(req(),s),false);
 f.state.apple=[{status:"expired"}];assert.equal(await f.canStart(req(),s),true);
 assert.equal(await f.canStart(req(),{...s,sessionId:owner}),false);
});
const payload=()=>({packageName:products.PLAY_PACKAGE,productId:"hoopcheck.pro",basePlans:products.PLAY_PRODUCTS.filter(p=>p.plan==="pro").map(p=>({basePlanId:p.basePlanId,state:"ACTIVE",autoRenewingBasePlanType:{billingPeriodDuration:({1:"P1M",6:"P6M",12:"P1Y"})[p.months]},regionalConfigs:[{regionCode:"US",newSubscriberAvailability:true,price:{currencyCode:"USD",units:String(Math.floor(p.usdMinor/100)),nanos:(p.usdMinor%100)*10000000}}]}))});
test("regional catalog requires active recurring plans, exact prices and available approved region",()=>{
 assert.deepEqual(provider.parsePlayRegionalCatalog(payload(),"hoopcheck.pro","US",60000).map(v=>v.priceMicros),["4990000","26950000","50900000"]);
 for(const mutate of [v=>v.basePlans[0].state="INACTIVE",v=>v.basePlans[0].regionalConfigs[0].price.nanos=0,v=>v.basePlans[0].regionalConfigs[0].newSubscriberAvailability=false,v=>v.basePlans[0].autoRenewingBasePlanType.billingPeriodDuration="P1Y",v=>v.basePlans.push(v.basePlans[0])]){
  const v=payload();mutate(v);assert.throws(()=>provider.parsePlayRegionalCatalog(v,"hoopcheck.pro","US",60000));
 }
 assert.throws(()=>provider.parsePlayRegionalCatalog(payload(),"hoopcheck.pro","GB",60000));
});
