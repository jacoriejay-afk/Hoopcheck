import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assuranceForVerifiedUser, readMfaState, verifyTotp, enrollTotp, cancelTotpEnrollment, removeTotp } from '../../../lib/auth/mfa-core.ts';
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',factor='33333333-3333-4333-8333-333333333333',backup='44444444-4444-4444-8444-444444444444';
const jwt=(sub=owner,aal='aal1',exp=Math.floor(Date.now()/1000)+3600)=>Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub,aal,exp})).toString('base64url')+'.fixture';
const verified=id=>({id,factor_type:'totp',status:'verified',friendly_name:'Authenticator'});
function fixture(initial=[verified(factor)]){
 let factors=initial,level='aal1';const calls=[];
 const user=()=>({id:owner,factors,user_metadata:{aal:'aal2',factors:[]}});
 const client={auth:{getSession:async()=>({data:{session:{user:user(),access_token:jwt(owner,level)}}}),getUser:async token=>{assert.equal(token,jwt(owner,level));calls.push('verified-user');return {data:{user:user()},error:null};},refreshSession:async()=>{calls.push('refresh');level=factors.some(f=>f.status==='verified')?'aal2':'aal1';return {data:{user:user()},error:null};},mfa:{
  challengeAndVerify:async({factorId,code})=>{calls.push('verify');if(code!=='123456')return {error:Error('invalid code')};factors=factors.map(f=>f.id===factorId?{...f,status:'verified'}:f);level='aal2';return {data:{user:user()},error:null};},
  enroll:async()=>{calls.push('enroll');factors=[...factors,{...verified(backup),status:'unverified'}];return {data:{id:backup,type:'totp',totp:{secret:'JBSWY3DPEHPK3PXP',qr_code:'data:image/svg+xml;utf-8,<svg></svg>'}},error:null};},
  unenroll:async({factorId})=>{calls.push('remove:'+factorId);factors=factors.filter(f=>f.id!==factorId);return {error:null};},
 }}};
 client.auth[Symbol.for('hoopcheck.owned-mfa')]=async(expected,name,args)=>{assert.equal(expected,owner);return client.auth.mfa[name](...args);};
 return {client,calls,user,setLevel:value=>{level=value;},factors:()=>factors};
}
test('only verified factors and verified-token assurance determine challenge; metadata cannot bypass it',()=>{
 assert.equal(assuranceForVerifiedUser(jwt(),{id:owner,factors:[verified(factor)],user_metadata:{aal:'aal2'}}).required,true);
 assert.equal(assuranceForVerifiedUser(jwt(owner,'aal2'),{id:owner,factors:[verified(factor)]}).required,false);
 assert.equal(assuranceForVerifiedUser(jwt(),{id:owner,factors:[{...verified(factor),status:'unverified'}]}).required,false);
 for(const token of [jwt(other),jwt(owner,'invented'),jwt(owner,'aal2',1),'invalid'])assert.throws(()=>assuranceForVerifiedUser(token,{id:owner,factors:[]}));
});
test('state reads verify the captured token and reject changed identity',async()=>{
 const f=fixture();assert.equal((await readMfaState(f.client,owner)).required,true);assert.deepEqual(f.calls,['verified-user']);await assert.rejects(readMfaState(f.client,other),/account changed/);
 f.client.auth.getUser=async()=>({data:{user:{id:other}},error:null});await assert.rejects(readMfaState(f.client,owner),/verified/);
});
test('invalid or foreign codes/factors never verify, and failed verification stays at aal1',async()=>{
 const f=fixture();await assert.rejects(verifyTotp(f.client,owner,factor,'12'));await assert.rejects(verifyTotp(f.client,owner,backup,'123456'),/registered/);assert.equal(f.calls.includes('verify'),false);
 await assert.rejects(verifyTotp(f.client,owner,factor,'000000'),/not accepted/);assert.equal((await readMfaState(f.client,owner)).required,true);
 assert.equal((await verifyTotp(f.client,owner,factor,'123456')).level,'aal2');
});
test('existing factor must be verified before adding a backup; incomplete setup may be cancelled',async()=>{
 const f=fixture();await assert.rejects(enrollTotp(f.client,owner,'Backup'),/existing authenticator/);assert.equal(f.calls.includes('enroll'),false);
 f.setLevel('aal2');const pending=await enrollTotp(f.client,owner,'Backup');assert.equal(pending.id,backup);assert.equal(f.factors().find(item=>item.id===backup).status,'unverified');
 await assert.rejects(cancelTotpEnrollment(f.client,owner,factor),/incomplete/);await cancelTotpEnrollment(f.client,owner,backup);assert.equal(f.factors().some(item=>item.id===backup),false);
});
test('last-factor removal requires explicit disable confirmation and a fresh accepted code',async()=>{
 const f=fixture();f.setLevel('aal2');await assert.rejects(removeTotp(f.client,owner,factor,factor,'123456',false),/Confirm/);assert.equal(f.calls.some(call=>call.startsWith('remove:')),false);
 await assert.rejects(removeTotp(f.client,owner,factor,factor,'000000',true),/not accepted/);assert.equal(f.factors().length,1);
 const result=await removeTotp(f.client,owner,factor,factor,'123456',true);assert.equal(result.factors.length,0);assert.equal(result.level,'aal1');assert.ok(f.calls.includes('refresh'));
});
test('a verified backup can remove a lost primary without disabling protection',async()=>{
 const f=fixture([verified(factor),verified(backup)]);const result=await removeTotp(f.client,owner,factor,backup,'123456',false);assert.equal(result.required,false);assert.deepEqual(result.factors.map(f=>f.id),[backup]);assert.equal(result.level,'aal2');
});

test('removing the last supported TOTP cannot strand an unsupported remaining factor',async()=>{
 const f=fixture([verified(factor),{...verified(backup),factor_type:'phone'}]);f.setLevel('aal2');await assert.rejects(removeTotp(f.client,owner,factor,factor,'123456',true),/supported backup/);assert.equal(f.calls.some(call=>call.startsWith('remove:')),false);
});
