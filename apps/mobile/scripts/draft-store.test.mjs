import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDraftStore } from '../src/native/draftStore.ts';
const uid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const key=`game:chat:${uid}`;
test('same-user token refresh retains memory drafts while identity changes and sign-out clear them',()=>{
 const store=createDraftStore();store.switchUser(uid);store.write(uid,key,'Private draft');store.switchUser(uid);assert.equal(store.read(uid,key),'Private draft');assert.equal(store.read(other,key),'');
 store.switchUser(other);assert.equal(store.read(uid,key),'');assert.equal(store.write(uid,key,'Late old request'),false);assert.equal(store.read(other,key),'');
 store.write(other,key,'Other draft');store.switchUser(null);assert.equal(store.read(other,key),'');store.switchUser(other);assert.equal(store.read(other,key),'');
});
test('drafts have a bounded memory/key contract and subscribers clean up',()=>{
 const store=createDraftStore();store.switchUser(uid);let calls=0;const unsubscribe=store.subscribe(()=>calls++);
 store.write(uid,key,'x'.repeat(5000));assert.equal(store.read(uid,key).length,2000);assert.equal(store.write(uid,'__proto__','bad'),false);
 store.write(uid,key,'');assert.equal(store.read(uid,key),'');assert.equal(calls,2);unsubscribe();store.write(uid,key,'Later');assert.equal(calls,2);
 store.switchUser('invalid');assert.equal(store.read(uid,key),'');
});
test('profile drafts have room for the bounded form and cannot target another identity',()=>{
 const store=createDraftStore();store.switchUser(uid);const profile=`profile:edit:${uid}`;
 assert.equal(store.write(uid,`profile:edit:${other}`,'forged'),false);store.write(uid,profile,'x'.repeat(9000));assert.equal(store.read(uid,profile).length,8000);
 store.switchUser(other);assert.equal(store.read(uid,profile),'');
});
