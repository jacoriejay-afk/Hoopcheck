import test from 'node:test';
import assert from 'node:assert/strict';
import { sharePlayerPassport } from '../src/native/passportSharing.ts';
const pass={name:'Player',position:'PG',team:null,years:2,verified:false};
function fixture(overrides={}) {
 const calls=[];
 return {calls,io:{platform:'ios',current:()=>true,identity:async()=>({id:'owner',accountType:'player'}),available:async()=>true,print:async html=>{calls.push(['print',html]);return 'file:///cache/passport.pdf';},share:async uri=>{calls.push(['share',uri]);},remove:async uri=>{calls.push(['remove',uri]);},...overrides}};
}
test('native Passport shares a locally rendered PDF and removes it after dismissal, without permission requests',async()=>{
 let identities=0;const {io,calls}=fixture({identity:async()=>{identities++;return {id:'owner',accountType:'player'};}});
 await sharePlayerPassport(pass,'owner',io);
 assert.equal(identities,2);assert.deepEqual(calls.map(x=>x[0]),['print','share','remove']);assert.ok(calls[0][1].includes('Player'));
});
test('web, missing share capability and wrong roles fail before printing',async()=>{
 for(const change of [{platform:'web'},{available:async()=>false},{identity:async()=>({id:'owner',accountType:'fan'})},{identity:async()=>null}]){
  const {io,calls}=fixture(change);await assert.rejects(sharePlayerPassport(pass,'owner',io));assert.deepEqual(calls,[]);
 }
});
test('an account switch while rendering prevents share and removes the PDF',async()=>{
 let count=0;const {io,calls}=fixture({identity:async()=>({id:++count===1?'owner':'other',accountType:'player'})});
 await assert.rejects(sharePlayerPassport(pass,'owner',io),/Verify/);assert.deepEqual(calls.map(x=>x[0]),['print','remove']);
});
test('background, navigation or unmount during preparation prevents the share sheet',async()=>{
 let active=true;const {io,calls}=fixture({current:()=>active,print:async()=>{active=false;return 'file:///cache/passport.pdf';}});
 await assert.rejects(sharePlayerPassport(pass,'owner',io),/cancelled/);assert.deepEqual(calls.map(x=>x[0]),['remove']);
});
test('a failed share still removes the file and does not expose native error details',async()=>{
 const {io,calls}=fixture({share:async()=>{throw Error('SECRET file:///private/owner.pdf');}});
 await assert.rejects(sharePlayerPassport(pass,'owner',io),error=>!error.message.includes('SECRET')&&/Sharing/.test(error.message));assert.equal(calls.at(-1)[0],'remove');
});
test('non-local printer results are never shared or passed to file deletion',async()=>{
 const {io,calls}=fixture({print:async()=> 'https://private.test/file.pdf'});
 await assert.rejects(sharePlayerPassport(pass,'owner',io),/safely/);assert.deepEqual(calls,[]);
});
test('cleanup errors are surfaced rather than silently leaving a sensitive file',async()=>{
 const {io}=fixture({remove:async()=>{throw Error('SECRET');}});await assert.rejects(sharePlayerPassport(pass,'owner',io),/temporary Passport could not be removed/);
});
test('a timed-out render releases the caller and removes a PDF that finishes late',async()=>{
 let finish;const {io,calls}=fixture({timeoutMs:1,print:()=>new Promise(resolve=>{finish=resolve;})});
 await assert.rejects(sharePlayerPassport(pass,'owner',io),/prepared/);finish('file:///cache/passport.pdf');await new Promise(resolve=>setTimeout(resolve,1));assert.deepEqual(calls,[['remove','file:///cache/passport.pdf']]);
});

test('missing native modules show a recoverable message without exposing binding details',async()=>{
 const {io,calls}=fixture({available:async()=>{throw Error('SECRET native-module implementation path');}});
 await assert.rejects(sharePlayerPassport(pass,'owner',io),/unavailable in this app version/);assert.deepEqual(calls,[]);
});
