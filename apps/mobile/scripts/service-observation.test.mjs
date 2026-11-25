import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readServiceObservation} from '../src/native/serviceObservation.ts';
const origin='https://fixture.hoopcheck.test';
const payload=(status='reachable',observedAt=new Date().toISOString())=>({version:1,status,observedAt});
test('on-demand service check reports only verified reachable or announced maintenance',async()=>{
 for(const status of ['reachable','maintenance_announced']){
  const value=payload(status);
  const seen=await readServiceObservation(origin,async(url,opts)=>{
   assert.equal(url,origin+'/api/service-status');
   assert.equal(opts.method,'GET');assert.deepEqual(opts.headers,{Accept:'application/json'});assert.equal(opts.redirect,'error');assert.equal(opts.cache,'no-store');
   return Response.json(value);
  });
  assert.deepEqual(seen,{status,observedAt:value.observedAt});
 }
});
test('invalid, stale, failed and unconfigured observations cannot report a healthy service',async()=>{
 for(const value of [null,{},payload('healthy'),payload('reachable','bad'),payload('reachable',new Date(Date.now()-180000).toISOString()),{...payload(),version:2}]){
  await assert.rejects(readServiceObservation(origin,async()=>Response.json(value)));
 }
 await assert.rejects(readServiceObservation(origin,async()=>new Response(null,{status:503})));
 let writes=0;await assert.rejects(readServiceObservation('http://fixture.hoopcheck.test',async()=>{writes++;return Response.json(payload())}));assert.equal(writes,0);
});
test('a cancelled or unmounted request cannot deliver an observation even if fetch ignores abort',async()=>{
 const controller=new AbortController();
 const pending=readServiceObservation(origin,()=>new Promise(()=>{}),controller.signal);
 controller.abort();await assert.rejects(pending,/cancelled/);
 await assert.rejects(readServiceObservation(origin,async()=>Response.json(payload()),controller.signal),/cancelled/);
});
