import assert from 'node:assert/strict';
import {test} from 'node:test';
import {revokeOtherSessions} from '../../../lib/auth/mfa-core.ts';
const owner='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222';
const factor={id:'33333333-3333-4333-8333-333333333333',factor_type:'totp',status:'verified'};
const jwt=(sub,aal='aal2',expired=false)=>'header.'+Buffer.from(JSON.stringify({sub,aal,exp:Math.floor(Date.now()/1000)+(expired?-100:600)})).toString('base64url')+'.fixture';
const fixture=({token=jwt(owner),user={id:owner,factors:[factor]},switchOwner=false,changeToken=false,authError=false}={})=>{
 let reads=0;
 return {auth:{getSession:async()=>({data:{session:{user:{id:switchOwner&&reads>0?other:owner},access_token:changeToken&&reads++>0?jwt(owner,'aal1'):(reads++,token)}},error:null}),getUser:async received=>{assert.equal(received,token);return {data:{user},error:authError?new Error('denied'):null}},refreshSession:async()=>{throw Error('Unexpected refresh')}}};
};
const origin='https://fixture.supabase.co';
test('remote sign-out pins verified owner token and requests others only',async()=>{
 const token=jwt(owner);let calls=0;
 await revokeOtherSessions(fixture({token}),owner,origin,'public-key',async(url,options)=>{
  calls++;assert.equal(url,origin+'/auth/v1/logout?scope=others');assert.equal(options.method,'POST');assert.deepEqual(options.headers,{Authorization:'Bearer '+token,apikey:'public-key'});assert.equal(options.redirect,'error');return new Response(null,{status:204});
 });
 assert.equal(calls,1);
});
test('remote revocation fails closed for expired, mismatched, unverified and insufficient-MFA sessions',async()=>{
 let writes=0;const request=async()=>{writes++;return new Response(null,{status:204})};
 for(const client of [fixture({token:jwt(owner,'aal1')}),fixture({token:jwt(owner,'aal2',true)}),fixture({token:jwt(other)}),fixture({user:{id:other}}),fixture({authError:true}),fixture({switchOwner:true}),fixture({changeToken:true})]) await assert.rejects(revokeOtherSessions(client,owner,origin,'public-key',request));
 await assert.rejects(revokeOtherSessions(fixture(),owner,'http://fixture.supabase.co','public-key',request));
 assert.equal(writes,0);
});
test('non-MFA accounts can revoke others after verified sign-in, and server failure is not success',async()=>{
 const client=fixture({token:jwt(owner,'aal1'),user:{id:owner,factors:[]}});
 await revokeOtherSessions(client,owner,origin,'public-key',async()=>new Response(null,{status:204}));
 await assert.rejects(revokeOtherSessions(client,owner,origin,'public-key',async()=>new Response(null,{status:403})),/could not be signed out/);
});
