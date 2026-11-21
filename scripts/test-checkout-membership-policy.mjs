import assert from'node:assert/strict';import{test}from'node:test';import{readFileSync}from'node:fs';import ts from'typescript';
const compile=(path,imports)=>{const out={exports:{}};new Function('require','module','exports',ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(imports,out,out.exports);return out.exports;};
const tiers=compile('../lib/membership-tier.ts',()=>{}),mode=compile('../lib/stripe-key-mode.ts',()=>{});
const owner='11111111-1111-4111-8111-111111111111';class AppleBillingError extends Error{}
function fixture(options={}){
 let stripeReads=0,checkouts=0,appleChecks=0;const calls=[];
 const user={id:owner,email:'fixture@example.test',email_confirmed_at:options.unconfirmed?null:'2026-01-01T00:00:00Z'};
 const db={auth:{getUser:async()=>({data:{user:options.anonymous?null:user},error:null})},from:table=>{const query={select:()=>query,eq:(key,value)=>{assert.equal(value,owner);return query;},in:()=>query,limit:()=>query,maybeSingle:async()=>({data:table==='profiles'?{account_type:options.role??'player',moderation_status:options.moderation??'normal'}:table==='account_deletion_requests'?options.deletion??null:options.subscription??null,error:options.lookupError===table?Error('private fixture DB error'):null})};return query;},rpc:async()=>({data:null,error:null})};
 const Stripe=class{constructor(){return{prices:{list:async args=>{stripeReads++;if(options.expectedLookup)assert.deepEqual(args.lookup_keys,[options.expectedLookup]);return{data:[options.price??{id:'price_fixture',currency:'usd',unit_amount:options.premium?999:499,type:'recurring',recurring:{interval:'month',interval_count:1}}]};}},checkout:{sessions:{create:async args=>{checkouts++;calls.push(args);return{url:'https://checkout.stripe.com/c/pay/fixture'};}}}};}};
 const {POST}=compile('../app/api/stripe/webhook/create-checkout/route.ts',name=>{
  if(name==='next/server')return{NextResponse:{json:(body,init)=>Response.json(body,init)}};
  if(name==='stripe')return{default:Stripe};
  if(name==='@supabase/supabase-js')return{createClient:()=>db};
  if(name.endsWith('/stripe-key-mode'))return mode;
  if(name.endsWith('/membership-tier'))return tiers;
  if(name.endsWith('/stripe-trial-eligibility'))return compile('../lib/stripe-trial-eligibility.ts',()=>{});
  if(name.endsWith('/stripe-trial-recovery'))return compile('../lib/stripe-trial-recovery.ts',()=>{});
  if(name.endsWith('/apple/proofs'))return{AppleBillingError};
  if(name.endsWith('/apple/service'))return{applePreventsStripeCheckout:async(_,id)=>{assert.equal(id,owner);appleChecks++;if(options.appleUnavailable)throw Error('Fixture Apple verification unavailable');return options.apple??false;}};
  throw Error(name);
 });
 return{post:()=>POST(new Request('https://isolated.test/api/stripe/webhook/create-checkout',{method:'POST',headers:{Authorization:'Bearer fixture','Content-Type':'application/json'},body:JSON.stringify({plan:options.premium?'premium':'pro',interval:options.interval??'month'})})),counts:()=>({stripeReads,checkouts,appleChecks}),calls};
}
async function configured(work){const previous={...process.env};Object.assign(process.env,{VERCEL_ENV:'preview',STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_CHECKOUT_ENABLED:'true',STRIPE_CHECKOUT_MODE:'test',HOOPCHECK_STRIPE_TEST_SUPABASE_URL:'https://isolated.supabase.co',NEXT_PUBLIC_SUPABASE_URL:'https://isolated.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture',NEXT_PUBLIC_SITE_URL:'https://isolated.test'});try{return await work();}finally{for(const key of Object.keys(process.env))if(!(key in previous))delete process.env[key];Object.assign(process.env,previous);}}
test('unpriced fans, unconfirmed/suspended accounts and pending deletions cannot start Stripe billing',()=>configured(async()=>{
 for(const[options,status]of[[{role:'fan'},403],[{unconfirmed:true},403],[{moderation:'suspended'},403],[{deletion:{status:'pending'}},409],[{lookupError:'account_deletion_requests'},503],[{anonymous:true},401]]){const f=fixture(options);assert.equal((await f.post()).status,status);assert.equal(f.counts().checkouts,0);assert.equal(f.counts().stripeReads,0);}
}));
test('active or unverifiable Apple billing blocks Stripe before price or checkout calls',()=>configured(async()=>{
 for(const[options,status]of[[{apple:true},409],[{appleUnavailable:true},503]]){const f=fixture(options);assert.equal((await f.post()).status,status);assert.deepEqual(f.counts(),{stripeReads:0,checkouts:0,appleChecks:1});}
}));
test('coach/manager Premium-only purchase rules retain eligible paid checkout and verified owner attribution',()=>configured(async()=>{
 for(const role of['coach','manager']){const denied=fixture({role});assert.equal((await denied.post()).status,403);assert.equal(denied.counts().stripeReads,0);const allowed=fixture({role,premium:true});assert.equal((await allowed.post()).status,200);assert.equal(allowed.counts().checkouts,1);assert.equal(allowed.calls[0].client_reference_id,owner);assert.equal(allowed.calls[0].subscription_data.metadata.plan,'premium');}
 const player=fixture();assert.equal((await player.post()).status,200);assert.equal(player.calls[0].metadata.user_id,owner);
}));
test('an active raw Stripe/manual membership is not silently repurchased',()=>configured(async()=>{
 for(const subscription of[{plan:'pro',status:'active',stripe_subscription_id:'sub_fixture'},{plan:'pro',status:'active',stripe_subscription_id:null}]){const f=fixture({subscription});assert.equal((await f.post()).status,409);assert.equal(f.counts().checkouts,0);}
}));

test('approved six-term checkout catalog is enforced and stale amounts cannot start billing',()=>configured(async()=>{
 for(const [tier,term,cents,oldCents] of [['pro','month',499,499],['pro','6_month',2695,2545],['pro','year',5090,5389],['premium','month',999,999],['premium','6_month',5395,5095],['premium','year',10190,10789]]){
  const price={id:'price_fixture',currency:'usd',unit_amount:cents,type:'recurring',recurring:{interval:term==='year'?'year':'month',interval_count:term==='6_month'?6:1}};
  const options={premium:tier==='premium',interval:term,price,expectedLookup:`hoopcheck_${tier}_${term==='month'?'monthly':term}_${cents}_2026`};
  const allowed=fixture(options);assert.equal((await allowed.post()).status,200);assert.equal(allowed.calls[0].line_items[0].price,price.id);assert.equal(allowed.calls[0].subscription_data.trial_period_days,undefined);
  if(oldCents!==cents){const stale=fixture({...options,price:{...price,unit_amount:oldCents}});assert.equal((await stale.post()).status,503);assert.equal(stale.counts().checkouts,0);}
 }
}));
