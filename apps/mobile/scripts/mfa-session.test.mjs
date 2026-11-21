import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{test}from'node:test';import{createRequire}from'node:module';import vm from'node:vm';import ts from'typescript';import React from'react';import{act,create}from'react-test-renderer';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;const require=createRequire(import.meta.url);const owner='11111111-1111-4111-8111-111111111111';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
async function fixture(){let onState,onAuth,current;const requests=[];const network={offline:false};const exports={};const source=readFileSync(new URL('../src/native/mfa.tsx',import.meta.url),'utf8');const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const stubs={'react-native':{AppState:{addEventListener:(_,callback)=>{onState=callback;return{remove(){}};}}},'../../../../lib/auth/mfa-core':{readMfaState:async()=>{const request=deferred();requests.push(request);return request.promise;}},'../lib/supabase':{supabase:{auth:{onAuthStateChange:callback=>{onAuth=callback;return{data:{subscription:{unsubscribe(){}}}};}}}},'./lockPolicy':{recordFreshSignIn(){}},'./network':{useNetwork:()=>network}};
 vm.runInNewContext(code,{exports,Date,require:id=>Object.hasOwn(stubs,id)?stubs[id]:require(id)});
 function Probe(){current=exports.useMfaSession();return null;}
 let tree;await act(async()=>{tree=create(React.createElement(exports.MfaSessionProvider,{userId:owner},React.createElement(Probe)));});
 const verified={owner,required:false,level:'aal2',expiresAt:Date.now()+3600000,factors:[]};
 return{tree,requests,network,verified,current:()=>current,state:value=>onState(value),auth:(event,session)=>onAuth(event,session),rerender:async userId=>act(async()=>tree.update(React.createElement(exports.MfaSessionProvider,{userId},React.createElement(Probe))))};
}
test('foreground retains an unexpired verified identity without opening a new lock presentation',async()=>{
 const f=await fixture();assert.equal(f.current().phase,'loading');await act(async()=>f.requests[0].resolve(f.verified));assert.equal(f.current().phase,'ready');
 await act(async()=>f.state('active'));assert.equal(f.requests.length,2);assert.equal(f.current().phase,'ready');
 await act(async()=>f.requests[1].resolve({...f.verified,required:true,level:'aal1'}));assert.equal(f.current().phase,'challenge');await act(async()=>f.tree.unmount());
});
test('auth changes conceal immediately and a stale foreground read cannot restore old proof',async()=>{
 const f=await fixture();await act(async()=>f.requests[0].resolve(f.verified));await act(async()=>f.state('active'));await act(async()=>f.auth('TOKEN_REFRESHED',{user:{id:owner}}));assert.equal(f.current().phase,'loading');
 await act(async()=>f.requests[1].resolve(f.verified));assert.equal(f.current().phase,'loading');await act(async()=>f.requests[2].resolve(f.verified));assert.equal(f.current().phase,'ready');await act(async()=>f.tree.unmount());
});
test('failed revalidation clears proof so going offline cannot recover a rejected session',async()=>{
 const f=await fixture();await act(async()=>f.requests[0].resolve(f.verified));await act(async()=>f.state('active'));await act(async()=>f.requests[1].reject(Error('Auth unavailable')));assert.equal(f.current().phase,'error');
 f.network.offline=true;await f.rerender(owner);assert.equal(f.current().phase,'error');assert.equal(f.current().state,null);await act(async()=>f.tree.unmount());
});
test('expired proof and account changes require fresh verification before revealing content',async()=>{
 const f=await fixture();await act(async()=>f.requests[0].resolve({...f.verified,expiresAt:Date.now()-1}));await act(async()=>f.state('active'));assert.equal(f.current().phase,'loading');
 await f.rerender('22222222-2222-4222-8222-222222222222');assert.equal(f.current().phase,'loading');assert.equal(f.current().owner,'22222222-2222-4222-8222-222222222222');await act(async()=>f.tree.unmount());
});
