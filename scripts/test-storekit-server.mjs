import assert from 'node:assert/strict';import test from 'node:test';import {readFileSync}from'node:fs';import{createRequire}from'node:module';import{generateKeyPairSync}from'node:crypto';import ts from'typescript';
const require=createRequire(import.meta.url);
function compile(path,imports=require){const compiled={exports:{}};const source=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','exports','module',source)(imports,compiled.exports,compiled);return compiled.exports;}
const products=compile('../lib/billing/apple-products.ts');const stripeMode=compile('../lib/stripe-key-mode.ts');const core=compile('../lib/auth/mfa-core.ts');
const proofs=compile('../lib/server/apple/proofs.ts',name=>name==='server-only'?{}:name==='../../billing/apple-products'?products:require(name));
const service=compile('../lib/server/apple/service.ts',name=>name==='server-only'?{}:name==='../../auth/mfa-core'?core:name==='../../stripe-key-mode'?stripeMode:name==='../../billing/apple-products'?products:name==='./proofs'?proofs:require(name));
const http=compile('../lib/server/apple/http.ts',name=>name==='./proofs'?proofs:require(name));
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const now=Date.now();
const transaction=(extra={})=>({bundleId:products.APPLE_BUNDLE_ID,environment:'Sandbox',type:'Auto-Renewable Subscription',inAppOwnershipType:'PURCHASED',transactionId:'10001',originalTransactionId:'10000',appAccountToken:owner,appTransactionId:'9001',productId:'hoopcheck.pro.monthly',purchaseDate:now-86400000,expiresDate:now+6*86400000,signedDate:now,price:0,currency:'USD',offerType:1,offerDiscountType:'FREE_TRIAL',...extra});
function fixture(options={}){
 const calls=[];let verified=0,readCurrent=0;
 const tables={apple_billing_config:{enabled:true,environment:'Sandbox'},profiles:{account_type:'player',moderation_status:'normal'},account_deletion_requests:null,subscriptions:null,apple_memberships:[],...options.tables};
 const db={from:table=>{
   const filters=[];const query={select:()=>query,eq:(key,value)=>{filters.push([key,value]);return query;},in:()=>query,limit:()=>query,order:()=>query,
    maybeSingle:async()=>{let data=tables[table];if(Array.isArray(data))data=data.filter(row=>filters.every(([key,value])=>row[key]===value))[0]??null;return{data,error:null};},
    then:(yes,no)=>Promise.resolve({data:tables[table],error:null}).then(yes,no)};return query;
 },rpc:async(name,args)=>{calls.push({name,args});if(options.rpcError===name)return{data:null,error:Error('fixture DB failure')};return{data:name==='apple_take_purchase_intent'?(options.budget??true):name==='apple_reserve_trial'?(options.trial??true):name==='apple_record_membership'?{acknowledged:true,status:'active'}:null,error:null};}};
 const provider={environment:'Sandbox',verifyApp:async()=>{if(options.badApp)throw Error('invalid Apple signature');return{id:'9001',environment:'Sandbox'};},
 verifyTransaction:async(_,user)=>{verified++;if(options.badSignature)throw Error('invalid Apple signature');return proofs.checkedTransaction(transaction(options.observed),'Sandbox',user);},
 currentStatus:async(id,user)=>{readCurrent++;assert.equal(id,'10000');assert.equal(user,owner);return{...proofs.checkedTransaction(transaction({productId:'hoopcheck.premium.monthly',...options.current}),'Sandbox',user),status:1,autoRenewStatus:1};},
 verifyNotification:async()=>{if(options.badSignature)throw Error('invalid Apple signature');return options.notification??{notificationUUID:'33333333-3333-4333-8333-333333333333',data:{signedTransactionInfo:'fixture-proof'}};},
 introductorySignature:(product,allow,id)=>{calls.push({name:'signature',args:{product,allow,id}});return 'fixture-signed-intro';}};
 return{db,provider,calls,counts:()=>({verified,readCurrent})};
}
test('Apple configuration fails closed and Sandbox cannot target production data',()=>{
 assert.throws(()=>proofs.appleConfiguration({}),/not available/);
 const {privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});const key=privateKey.export({format:'pem',type:'pkcs8'}).toString();
 const valid={APPLE_IAP_ENABLED:'true',APPLE_IAP_ENVIRONMENT:'Sandbox',APPLE_IAP_KEY_ID:'TESTKEY001',APPLE_IAP_ISSUER_ID:owner,APPLE_IAP_PRIVATE_KEY:key,NEXT_PUBLIC_SUPABASE_URL:'https://isolated.supabase.co'};
 assert.equal(proofs.appleConfiguration(valid).environment,'Sandbox');
 for(const extra of [{VERCEL_ENV:'production'},{NEXT_PUBLIC_SUPABASE_URL:'https://ucbdceaieyenljcwlhnj.supabase.co'},{APPLE_IAP_ENVIRONMENT:'Xcode'},{APPLE_IAP_PRIVATE_KEY:'invalid'}])assert.throws(()=>proofs.appleConfiguration({...valid,...extra}));
});
test('actual Apple verifier rejects a fabricated proof despite plausible decoded claims',async()=>{
 const {privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});const config={environment:'Sandbox',keyID:'TESTKEY001',issuerID:owner,key:privateKey.export({format:'pem',type:'pkcs8'}).toString()};
 assert.equal(proofs.appleTrustRoots().length,3);const provider=proofs.appleServices(config);const forged=Buffer.from('{"alg":"ES256","x5c":[]}').toString('base64url')+'.'+Buffer.from(JSON.stringify(transaction())).toString('base64url')+'.'+Buffer.alloc(64).toString('base64url');
 await assert.rejects(provider.verifyTransaction(forged,owner));
});
test('verified transaction policy rejects cross-account/bundle/environment/fan/family and invalid trial terms',()=>{
 assert.equal(proofs.checkedTransaction(transaction(),'Sandbox',owner).productId,'hoopcheck.pro.monthly');
 for(const extra of [{appAccountToken:other},{bundleId:'other.app'},{environment:'Production'},{productId:'hoopcheck.fan.monthly'},{inAppOwnershipType:'FAMILY_SHARED'},{signedDate:now+600000},{expiresDate:1},{offerDiscountType:'FREE_TRIAL',productId:'hoopcheck.pro.annual'},{offerDiscountType:'FREE_TRIAL',expiresDate:now+8*86400000},{price:-1}])assert.throws(()=>proofs.checkedTransaction(transaction(extra),'Sandbox',owner));
});
test('purchase synchronization persists the independently verified live Apple status and acknowledges only after DB success',async()=>{
 const f=fixture();const result=await service.synchronizeApple(f.db,owner,'fixture-proof',f.provider);assert.equal(result.acknowledged,true);assert.deepEqual(f.counts(),{verified:1,readCurrent:1});
 const record=f.calls.find(call=>call.name==='apple_record_membership');assert.equal(record.args.p_user,owner);assert.equal(record.args.p_current.productId,'hoopcheck.premium.monthly');assert.equal(record.args.p_observed.productId,'hoopcheck.pro.monthly');
 const failed=fixture({rpcError:'apple_record_membership'});await assert.rejects(service.synchronizeApple(failed.db,owner,'fixture-proof',failed.provider),/could not be confirmed/);
});
test('unverified proofs, disabled billing and foreign ownership never reach a membership write',async()=>{
 for(const options of [{badSignature:true},{tables:{apple_billing_config:{enabled:false,environment:'Sandbox'}}},{observed:{appAccountToken:other}}]){const f=fixture(options);await assert.rejects(service.synchronizeApple(f.db,owner,'fixture-proof',f.provider));assert.equal(f.calls.some(call=>call.name==='apple_record_membership'),false);}
});
test('trial authorization uses the server account, Apple identity and persistent eligibility decision',async()=>{
 for(const allowed of [true,false]){const f=fixture({trial:allowed});const result=await service.purchaseIntent(f.db,f.db,owner,{productId:'hoopcheck.pro.monthly',signedAppTransaction:'fixture-app'},f.provider);assert.equal(result.allowIntroductoryOffer,allowed);assert.equal(result.owner,owner);assert.deepEqual(f.calls.find(c=>c.name==='signature').args,{product:'hoopcheck.pro.monthly',allow:allowed,id:'9001'});}
 const annual=fixture();const result=await service.purchaseIntent(annual.db,annual.db,owner,{productId:'hoopcheck.pro.annual',signedAppTransaction:'fixture-app'},annual.provider);assert.equal(result.introductorySignature,null);assert.equal(annual.calls.some(c=>c.name==='apple_reserve_trial'),false);
});
test('unpriced fans, pending deletion, existing Stripe billing, invalid app proof and rate limits prevent new purchases',async()=>{
 for(const options of [{tables:{profiles:{account_type:'fan'}}},{tables:{account_deletion_requests:{status:'pending'}}},{tables:{subscriptions:{stripe_subscription_id:'sub_fixture',status:'active'}}},{badApp:true},{budget:false}]){const f=fixture(options);await assert.rejects(service.purchaseIntent(f.db,f.db,owner,{productId:'hoopcheck.pro.monthly',signedAppTransaction:'fixture-app'},f.provider));assert.equal(f.calls.some(c=>c.name==='signature'),false);}
});
test('first-time-payer checks use paid invoice history and deny trials when history is unknown',async()=>{
 const customer={stripe_customer_id:'cus_fixture'};
 assert.equal(await service.stripeIntroHistory(null),'clear');
 assert.equal(await service.stripeIntroHistory({stripe_subscription_id:'sub_fixture'}),'unknown');
 assert.equal(await service.stripeIntroHistory(customer,{invoices:{list:async()=>({data:[{amount_paid:499}],has_more:false})}}),'paid');
 assert.equal(await service.stripeIntroHistory(customer,{invoices:{list:async()=>({data:[{amount_paid:0}],has_more:false})},subscriptions:{list:async()=>({data:[],has_more:false})}}),'clear');
 assert.equal(await service.stripeIntroHistory(customer,{invoices:{list:async()=>{throw Error('Stripe unavailable');}}}),'unknown');
});
test('notifications never reassign purchases or silently create unknown-owner entitlements',async()=>{
 const unknown=fixture();assert.equal((await service.appleNotification(unknown.db,'fixture-proof',unknown.provider)).received,true);assert.equal(unknown.calls.some(c=>c.name==='apple_record_membership'),false);
 const foreign=fixture({tables:{apple_memberships:[{environment:'Sandbox',original_transaction_id:'10000',user_id:other}]}});await assert.rejects(service.appleNotification(foreign.db,'fixture-proof',foreign.provider),/ownership conflict/);assert.equal(foreign.calls.some(c=>c.name==='apple_record_membership'),false);
 const owned=fixture({tables:{apple_memberships:[{environment:'Sandbox',original_transaction_id:'10000',user_id:owner}]}});await service.appleNotification(owned.db,'fixture-proof',owned.provider);assert.equal(owned.calls.filter(c=>c.name==='apple_record_membership').length,1);
});
test('bounded JSON parsing rejects oversized chunked input and private replies cannot be cached',async()=>{
 const large=new Request('https://fixture.test',{method:'POST',body:JSON.stringify({value:'x'.repeat(74000)})});await assert.rejects(http.appleJson(large),error=>error.status===413);
 await assert.rejects(http.appleJson(new Request('https://fixture.test',{method:'POST',body:'[]'})),error=>error.status===400);
 assert.deepEqual(await http.appleJson(new Request('https://fixture.test',{method:'POST',body:'{"signedTransaction":"fixture"}'})),{signedTransaction:'fixture'});
 assert.equal(http.appleReply({ok:true}).headers.get('cache-control'),'private, no-store');
});

test('a prior Stripe trial consumes cross-provider eligibility even without a paid invoice',async()=>{
 const history={invoices:{list:async()=>({data:[],has_more:false})},subscriptions:{list:async()=>({data:[{trial_start:Math.floor(now/1000)-3600}],has_more:false})}};
 assert.equal(await service.stripeIntroHistory({stripe_customer_id:'cus_fixture'},history),'trial_used');
 assert.equal(await service.stripeIntroHistory({stripe_customer_id:'cus_fixture'},history,now-7200000),'clear');
});
test('a live trial cannot be acknowledged when first-payer history is unknown',async()=>{
 const previous=process.env.STRIPE_SECRET_KEY;delete process.env.STRIPE_SECRET_KEY;
 try{const f=fixture({tables:{subscriptions:{stripe_customer_id:'cus_fixture'}}});await assert.rejects(service.synchronizeApple(f.db,owner,'fixture-proof',f.provider),error=>error.code==='apple_trial_unverified');assert.equal(f.calls.some(call=>call.name==='apple_record_membership'),false);}
 finally{if(previous===undefined)delete process.env.STRIPE_SECRET_KEY;else process.env.STRIPE_SECRET_KEY=previous;}
});

test('unknown history cannot produce an eligible signature even if a stale RPC reports true',async()=>{
 const previous=process.env.STRIPE_SECRET_KEY;delete process.env.STRIPE_SECRET_KEY;
 try{const f=fixture({tables:{subscriptions:{stripe_customer_id:'cus_fixture'}},trial:true});const intent=await service.purchaseIntent(f.db,f.db,owner,{productId:'hoopcheck.pro.monthly',signedAppTransaction:'fixture-app'},f.provider);assert.equal(intent.allowIntroductoryOffer,false);assert.equal(intent.trialEligibility,'unverified');assert.equal(f.calls.find(c=>c.name==='signature').args.allow,false);}
 finally{if(previous===undefined)delete process.env.STRIPE_SECRET_KEY;else process.env.STRIPE_SECRET_KEY=previous;}
});


test('accelerated Sandbox trials remain isolated from seven-day production receipt rules',()=>{
 const fast=transaction({expiresDate:now-86400000+180000});
 assert.equal(proofs.checkedTransaction(fast,'Sandbox',owner).transactionId,'10001');
 assert.throws(()=>proofs.checkedTransaction({...fast,environment:'Production'},'Production',owner));
 assert.equal(proofs.checkedTransaction({...transaction(),environment:'Production'},'Production',owner).transactionId,'10001');
 const identity={bundleId:products.APPLE_BUNDLE_ID,receiptType:'Sandbox',appTransactionId:'9001',receiptCreationDate:now};
 assert.equal(proofs.checkedAppIdentity(identity,'Sandbox').id,'9001');
 assert.throws(()=>proofs.checkedAppIdentity({...identity,receiptType:'Production'},'Production'));
 assert.equal(proofs.checkedAppIdentity({...identity,receiptType:'Production',appAppleId:products.APPLE_APP_ID},'Production').id,'9001');
});

test('coach and manager purchases retain Premium-only rules while other role entitlements remain unchanged',async()=>{
 for(const role of['coach','manager']){
  const f=fixture({tables:{profiles:{account_type:role}}});const config=await service.appleCatalog(f.db,f.db,owner,f.provider);assert.equal(config.products.length,3);assert.ok(config.products.every(value=>value.plan==='premium'));
  await assert.rejects(service.purchaseIntent(f.db,f.db,owner,{productId:'hoopcheck.pro.monthly',signedAppTransaction:'fixture-app'},f.provider),error=>error.code==='apple_product_restricted');
  assert.equal((await service.purchaseIntent(f.db,f.db,owner,{productId:'hoopcheck.premium.annual',signedAppTransaction:'fixture-app'},f.provider)).productId,'hoopcheck.premium.annual');
 }
});
test('existing Apple billing blocks another native purchase and is freshly checked before a Stripe transition',async()=>{
 const owned={environment:'Sandbox',user_id:owner,original_transaction_id:'10000',verified_at:new Date().toISOString(),status:'active',current_period_end:new Date(Date.now()+86400000).toISOString()};
 const f=fixture({tables:{apple_memberships:[owned]}});assert.equal((await service.appleCatalog(f.db,f.db,owner,f.provider)).canPurchase,false);assert.equal(await service.applePreventsStripeCheckout(f.db,owner,()=>f.provider),true);assert.equal(f.counts().readCurrent,1);
 const empty=fixture();assert.equal(await service.applePreventsStripeCheckout(empty.db,owner,()=>{throw Error('must not load missing Apple credentials');}),false);
 const unavailable=fixture({tables:{apple_memberships:[owned]}});await assert.rejects(service.applePreventsStripeCheckout(unavailable.db,owner,()=>{throw Error('Apple disabled');}));
});


test('a new purchase or refund cannot be acknowledged against an older live Apple API state',async()=>{
 const paid={offerType:undefined,offerDiscountType:undefined,price:4990};
 const f=fixture({observed:{...paid,purchaseDate:now-3600000},current:{...paid,purchaseDate:now-7200000}});
 await assert.rejects(service.synchronizeApple(f.db,owner,'fixture-proof',f.provider),error=>error.code==='apple_status_pending');assert.equal(f.calls.some(value=>value.name==='apple_record_membership'),false);
 const refunded=fixture({observed:{...paid,revocationDate:now},current:paid});
 await assert.rejects(service.synchronizeApple(refunded.db,owner,'fixture-proof',refunded.provider),error=>error.code==='apple_status_pending');
});
