import assert from 'node:assert/strict';import {test}from'node:test';import{readFileSync}from'node:fs';import{createRequire}from'node:module';import vm from'node:vm';import ts from'typescript';import React from'react';import{act,create}from'react-test-renderer';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;const require=createRequire(import.meta.url),owner='11111111-1111-4111-8111-111111111111';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const product={id:'hoopcheck.pro.monthly',title:'Pro',displayPrice:'5,99 €',price:'5.99',currency:'EUR',groupID:'8000',months:1,trialDays:7,appleIntroEligible:true};
const words=tree=>{const text=value=>value==null?"":typeof value==="string"?value:Array.isArray(value)?value.map(text).join(""):text(value.children);return text(tree.toJSON());};
function fixture({theme='light',role='player',eligibility='eligible',restoreError=false,preparePending,purchasePending,catalogResponses}={}){
 let background;const calls=[];const state={security:{owner,phase:'ready'},account:{user:{id:owner,accountType:role},tier:'free',hasPaidMembership:false}};
 const subscription={plan:'pro',status:'active',access_status:'pro',provider:'apple',current_period_end:'2099-01-01T00:00:00Z',cancel_at_period_end:false,billing_interval:'month'};
 const store={supported:true,membership:async()=>subscription,catalog:async()=>catalogResponses?.shift()??({products:role==='fan'?[]:[product],canPurchase:role!=='fan',reason:'No new fan products'}),prepare:async value=>preparePending?.promise??{product:value,hasTrial:eligibility==='eligible',trialEligibility:eligibility,owner},purchase:async value=>{calls.push(['purchase',value]);return purchasePending?.promise??'pending';},restore:async()=>{calls.push(['restore']);if(restoreError)throw Error('Restore could not be verified. Try again.');return{restored:1,foreign:0,failed:0};},manage:async()=>{calls.push(['manage']);}};
 const color=theme==='dark'?'#101010':'#ffffff';const exports={};const code=ts.transpileModule(readFileSync(new URL('../app/membership.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const stubs={'../components/MembershipPreview':{MembershipPreview:'MembershipPreview'},'react-native':{AppState:{addEventListener:(_,fn)=>{background=fn;return{remove(){}};}},Linking:{openURL:async()=>{}},ScrollView:'ScrollView',Text:'Text',View:'View'},'expo-router':{useFocusEffect:callback=>React.useEffect(callback,[callback])},'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},'../src/primitives':{Button:'Button',GlassCard:'GlassCard'},'../src/theme':{useEntryTheme:()=>({background:color,foreground:theme==='dark'?'#ffffff':'#101010',muted:'#777777'})},'../src/native/useNativeAccount':{useNativeAccount:()=>({account:state.account,retry:()=>calls.push(['refresh'])})},'../src/native/mfa':{useMfaSession:()=>state.security},'../src/native/storekit':{useStoreKit:()=>store},'../../../lib/billing/apple-products':{appleProduct:()=>({plan:'pro'})}};
 vm.runInNewContext(code,{exports,Date,Error,require:id=>Object.hasOwn(stubs,id)?stubs[id]:require(id)});
 return{Screen:exports.default,state,calls,background:value=>background(value),color};
}
async function render(f){let tree;await act(async()=>{tree=create(React.createElement(f.Screen));});return tree;}
async function click(tree,name){const button=tree.root.findAllByType('Button').find(v=>typeof v.props.children==='string'&&v.props.children===name);assert.ok(button,'Missing button '+name);await act(async()=>button.props.onPress());}
test('real membership screen renders localized prices, review controls and both themes without another modal',async()=>{
 for(const theme of ['light','dark']){const f=fixture({theme}),tree=await render(f);assert.match(words(tree),/5,99 €/);assert.match(words(tree),/Review Pro/);assert.equal(tree.root.findByType('SafeAreaView').props.style.backgroundColor,f.color);assert.equal(tree.root.findAllByType('Modal').length,0);await click(tree,'Review Pro');assert.match(words(tree),/7 days free, then 5,99 €/);await click(tree,'Start 7-day free trial');assert.match(words(tree),/waiting for approval/);assert.equal(f.calls.filter(c=>c[0]==='purchase').length,1);await act(async()=>tree.unmount());}
});
test('unverified eligibility is an explicit full-price confirmation with no free-trial button',async()=>{
 const f=fixture({eligibility:'unverified'}),tree=await render(f);await click(tree,'Review Pro');assert.match(words(tree),/No free trial/);assert.match(words(tree),/regular price without a free trial/);assert.equal(tree.root.findAllByType('Button').some(b=>b.props.children==='Start 7-day free trial'),false);await click(tree,'Subscribe for 5,99 € / month');assert.equal(f.calls.length,1);await act(async()=>tree.unmount());
});
test('backgrounding clears a prepared quote and returning to the screen requires review again',async()=>{
 const f=fixture(),tree=await render(f);await click(tree,'Review Pro');await act(async()=>f.background('background'));assert.doesNotMatch(words(tree),/Confirm your membership/);assert.match(words(tree),/Review Pro/);await act(async()=>tree.unmount());
});
test('restore errors remain actionable and controls recover without granting access',async()=>{
 const f=fixture({restoreError:true}),tree=await render(f);await click(tree,'Restore purchases');assert.match(words(tree),/Restore could not be verified/);assert.equal(tree.root.findAllByType('Button').find(b=>b.props.children==='Restore purchases').props.disabled,false);assert.equal(f.calls.some(c=>c[0]==='refresh'),false);await act(async()=>tree.unmount());
});
test('fan accounts retain restore/manage controls without priced offers',async()=>{
 const f=fixture({role:'fan'}),tree=await render(f);assert.match(words(tree),/No paid fan products are offered/);assert.doesNotMatch(words(tree),/5,99 €/);await click(tree,'Restore purchases');assert.match(words(tree),/Verified 1 Apple purchase/);assert.ok(f.calls.some(c=>c[0]==='refresh'));await click(tree,'Manage Apple subscription');assert.ok(f.calls.some(c=>c[0]==='manage'));await act(async()=>tree.unmount());
});
test('an old account preparation cannot display a payment confirmation for the next account',async()=>{
 const pending=deferred(),f=fixture({preparePending:pending}),tree=await render(f);await click(tree,'Review Pro');f.state.security={owner:'22222222-2222-4222-8222-222222222222',phase:'ready'};f.state.account={...f.state.account,user:{...f.state.account.user,id:f.state.security.owner}};await act(async()=>tree.update(React.createElement(f.Screen)));await act(async()=>pending.resolve({product,hasTrial:true,trialEligibility:'eligible',owner}));assert.doesNotMatch(words(tree),/Confirm your membership/);await act(async()=>tree.unmount());
});

test('membership refresh clears a stale disabled notice in both themes',async()=>{
 for(const theme of ['light','dark']){
  const f=fixture({theme,catalogResponses:[{products:[],canPurchase:false,reason:'Purchases paused.'},{products:[product],canPurchase:true,reason:''}]}),tree=await render(f);
  assert.match(words(tree),/Purchases paused/);
  await click(tree,'Refresh membership');
  assert.doesNotMatch(words(tree),/Purchases paused/);assert.match(words(tree),/Review Pro/);
  await act(async()=>tree.unmount());
 }
});
