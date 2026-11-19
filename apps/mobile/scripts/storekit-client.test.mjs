import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
function compile(path, imports=()=>{throw Error('Unexpected dependency');}) {
 const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const out={exports:{}};new Function('require','exports','module',code)(imports,out.exports,out);return out.exports;
}
const catalog=compile('../../../lib/billing/apple-products.ts'), membership=compile('../../../lib/billing/membership.ts'), deadlines=compile('../src/native/readDeadline.ts');
const {createStoreKitClient,storeProducts,storeRequest}=compile('../src/native/storekitClient.ts',name=>({'../../../../lib/billing/apple-products':catalog,'../../../../lib/billing/membership':membership,'./readDeadline':deadlines}[name]??(()=>{throw Error(name);})()));
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const signed='a'.repeat(40)+'.'+'b'.repeat(40)+'.'+'c'.repeat(80);
const products=catalog.APPLE_PRODUCTS.map(p=>({id:p.id,title:p.plan,displayPrice:'$'+(p.usdMinor/100).toFixed(2),price:(p.usdMinor/100).toString(),currency:'USD',groupID:'8000',months:p.months,trialDays:p.trialDays,appleIntroEligible:true}));
const transaction=(extra={})=>({id:'10001',originalID:'10000',productID:products[0].id,accountToken:owner,signedJWS:signed,...extra});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
function fixture(options={}) {
 let user=owner,available=true,synced=0;
 const calls=[];const native={identity:async()=>({id:'9001',environment:'Sandbox',signedJWS:signed}),products:async()=>products,purchase:async(...args)=>{calls.push(['purchase',...args]);return options.purchase?options.purchase(...args):{state:'purchased',transaction:transaction()};},transactions:async()=>options.transactions??[transaction()],restore:async()=>{calls.push(['restore']);return options.transactions??[transaction()];},finish:async id=>{calls.push(['finish',id]);if(options.finish)await options.finish(id);},manage:async()=>{calls.push(['manage']);}};
 const client=createStoreKitClient({native:options.unsupported?null:native,available:()=>available,session:async()=>({id:user,token:'captured-'+user}),onSynced:()=>synced++,request:async(path,token,body)=>{
  calls.push(['request',path,token,body]);if(options.request)return options.request(path,token,body);
  if(path.endsWith('/config'))return{owner:user,environment:'Sandbox',canPurchase:options.canPurchase??true,reason:'fixture denied'};
  if(path.endsWith('/intent'))return{owner:user,productId:body.productId,environment:'Sandbox',appTransactionID:'9001',allowIntroductoryOffer:options.intro??true,introductorySignature:signed,trialEligibility:options.eligibility??'eligible'};
  if(path.endsWith('/sync'))return{owner,acknowledged:true,transactionId:'10001'};
  if(path==='/api/membership')return{owner:user,subscription:options.membership??null};
  throw Error('Unexpected request');
 }});client.setOwner(owner);
 return{client,native,calls,session:value=>{user=value;client.setOwner(value);},available:value=>available=value,synced:()=>synced};
}
test('six owner-confirmed products use localized prices and one group; fan/changed terms are rejected',()=>{
 assert.equal(storeProducts(products).length,6);assert.equal(storeProducts([{...products[0],currency:'EUR',price:'5.99',displayPrice:'5,99 €'}])[0].displayPrice,'5,99 €');
 for(const value of [[...products,products[0]],[{...products[0],id:'hoopcheck.fan.monthly'}],[{...products[0],trialDays:14}],[{...products[0],months:3}],[products[0],{...products[1],groupID:'9000'}],[{...products[0],price:'NaN'}]])assert.throws(()=>storeProducts(value));
});
test('purchase passes signed intent, immutable owner and quoted price; only server acknowledgement finishes it',async()=>{
 const f=fixture();const prepared=await f.client.prepare(products[0]);assert.equal(prepared.hasTrial,true);assert.equal(await f.client.purchase(prepared),'purchased');
 assert.deepEqual(f.calls.find(c=>c[0]==='purchase').slice(1),[products[0].id,owner,'9001',signed,'4.99','USD']);
 const syncIndex=f.calls.findIndex(c=>c[1]==='/api/mobile/purchases/sync'),finishIndex=f.calls.findIndex(c=>c[0]==='finish');assert.ok(finishIndex>syncIndex);assert.equal(f.synced(),1);
});
test('unknown or ineligible first-payer history never advertises a trial',async()=>{
 for(const eligibility of ['unverified','ineligible']){const f=fixture({intro:false,eligibility});assert.equal((await f.client.prepare(products[0])).hasTrial,false);}
 const f=fixture();assert.equal((await f.client.prepare({...products[0],appleIntroEligible:false})).hasTrial,false);
});
test('pending approval and cancellation never synchronize, finish or optimistically grant access',async()=>{
 for(const state of ['pending','cancelled']){const f=fixture({purchase:async()=>({state})});assert.equal(await f.client.purchase(await f.client.prepare(products[0])),state);assert.equal(f.synced(),0);assert.equal(f.calls.some(c=>c[1]==='/api/mobile/purchases/sync'||c[0]==='finish'),false);}
});
test('an uncertain server write remains unfinished for a later restore',async()=>{
 const f=fixture({request:async path=>{if(path.endsWith('/sync'))throw Error('response lost');throw Error('unused');}});
 await assert.rejects(f.client.receive(transaction()),/response lost/);assert.equal(f.calls.some(c=>c[0]==='finish'),false);assert.equal(f.synced(),0);
});
test('malformed or wrong-owner acknowledgements cannot finish a purchase',async()=>{
 for(const reply of [{owner,acknowledged:false,transactionId:'10001'},{owner:other,acknowledged:true,transactionId:'10001'},{owner,acknowledged:true,transactionId:'999'}]){const f=fixture({request:async()=>reply});await assert.rejects(f.client.receive(transaction()));assert.equal(f.calls.some(c=>c[0]==='finish'),false);}
});
test('switching accounts while a server acknowledgement is pending cannot finish or refresh the next account',async()=>{
 const pending=deferred();const f=fixture({request:async()=>pending.promise});const work=f.client.receive(transaction());await new Promise(resolve=>setImmediate(resolve));f.session(other);pending.resolve({owner,acknowledged:true,transactionId:'10001'});await assert.rejects(work,/account changed/);assert.equal(f.calls.some(c=>c[0]==='finish'),false);assert.equal(f.synced(),0);
});
test('switching away and back invalidates a prepared purchase before the native payment sheet',async()=>{
 const f=fixture(),prepared=await f.client.prepare(products[0]);f.session(other);f.session(owner);await assert.rejects(f.client.purchase(prepared),/account changed/);assert.equal(f.calls.some(c=>c[0]==='purchase'),false);
});
test('a purchase completing after sign-out remains unfinished and cannot activate another account',async()=>{
 const pending=deferred(),f=fixture({purchase:async()=>pending.promise});const work=f.client.purchase(await f.client.prepare(products[0]));await new Promise(resolve=>setImmediate(resolve));f.session(null);pending.resolve({state:'purchased',transaction:transaction()});await assert.rejects(work,/account changed/);assert.equal(f.calls.some(c=>c[1]==='/api/mobile/purchases/sync'||c[0]==='finish'),false);
});
test('foreign-owned receipts are never transmitted, finished or reassigned',async()=>{
 const f=fixture({transactions:[transaction({accountToken:other})]});const result=await f.client.restore();assert.equal(result.foreign,1);assert.equal(result.restored,0);assert.equal(f.calls.some(c=>c[0]==='finish'||c[0]==='request'),false);
});
test('duplicate observer and restore callbacks share one acknowledgement and finish',async()=>{
 const pending=deferred(),f=fixture({request:async()=>pending.promise});const a=f.client.receive(transaction()),b=f.client.receive(transaction());await new Promise(resolve=>setImmediate(resolve));pending.resolve({owner,acknowledged:true,transactionId:'10001'});assert.deepEqual(await Promise.all([a,b]),[true,true]);assert.equal(f.calls.filter(c=>c[0]==='finish').length,1);await f.client.receive(transaction());assert.equal(f.calls.filter(c=>c[0]==='finish').length,1);
});
test('native finish failure is retried without claiming membership synchronization succeeded',async()=>{
 let attempts=0;const f=fixture({finish:async()=>{if(++attempts===1)throw Error('native finish failed');}});await assert.rejects(f.client.receive(transaction()));assert.equal(f.synced(),0);assert.equal(await f.client.receive(transaction()),true);assert.equal(attempts,2);assert.equal(f.synced(),1);
});
test('background/security gates defer automatic scans and callbacks until foreground recovery',async()=>{
 const f=fixture();f.available(false);assert.equal((await f.client.scan()).restored,0);assert.equal(await f.client.receive(transaction()),false);assert.equal(f.calls.length,0);f.available(true);assert.equal((await f.client.scan()).restored,1);
});
test('restoration is user-initiated; automatic scans never invoke AppStore.sync',async()=>{
 const f=fixture();await f.client.scan();assert.equal(f.calls.some(c=>c[0]==='restore'),false);await f.client.restore();assert.equal(f.calls.filter(c=>c[0]==='restore').length,1);
});
test('unsupported native billing and invalid optional API configuration do not prevent client initialization',async()=>{
 const f=fixture({unsupported:true});assert.equal(f.client.supported,false);assert.equal((await f.client.scan()).restored,0);await assert.rejects(f.client.restore(),/next iPhone/);
 let calls=0;for(const origin of ['http://unsafe.test','https://user:pass@unsafe.test','https://api.test/path','bad-url']){const request=storeRequest(origin,async()=>{calls++;});await assert.rejects(request('/api/membership','secret'));}assert.equal(calls,0);
});
test('membership reads validate provider/expiry and cannot consume another account response',async()=>{
 const subscription={plan:'premium',status:'active',access_status:'premium',current_period_end:'2099-01-01T00:00:00Z',cancel_at_period_end:false,billing_interval:'year',provider:'apple'};assert.equal((await fixture({membership:subscription}).client.membership()).provider,'apple');
 for(const value of [{...subscription,provider:'owner'},{...subscription,current_period_end:'invalid'}])await assert.rejects(fixture({membership:value}).client.membership());
 await assert.rejects(fixture({request:async()=>({owner:other,subscription})}).client.membership());
});
test('billing controls serialize native presentations and stale quotes require review again',async()=>{
 const pending=deferred(),f=fixture({purchase:async()=>pending.promise}),prepared=await f.client.prepare(products[0]);const work=f.client.purchase(prepared);await new Promise(resolve=>setImmediate(resolve));await assert.rejects(f.client.restore(),/already in progress/);await assert.rejects(f.client.manage(),/already in progress/);pending.resolve({state:'cancelled'});await work;await assert.rejects(f.client.purchase({...prepared,createdAt:Date.now()-600000}),/expired/);
});
test('membership HTTP requests capture the JWT, refuse redirects and never cache receipts',async()=>{
 let call;const request=storeRequest('https://isolated.test',async(...args)=>{call=args;return Response.json({owner});});await request('/api/mobile/purchases/sync','captured-token',{signedTransaction:signed});assert.equal(call[0],'https://isolated.test/api/mobile/purchases/sync');assert.equal(call[1].headers.Authorization,'Bearer captured-token');assert.equal(call[1].cache,'no-store');assert.equal(call[1].redirect,'error');assert.deepEqual(JSON.parse(call[1].body),{signedTransaction:signed});await assert.rejects(request('/external','token'));
});
