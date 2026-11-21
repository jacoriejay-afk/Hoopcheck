import assert from 'node:assert/strict';import{test}from'node:test';import{rememberDestination,takeDestination}from'../src/native/pendingDestination.ts';
test('protected membership, settings and directory links survive sign-in once without retaining credentials',()=>{
 for(const path of['/membership','/settings','/coaches','/dashboard','/account/security']){rememberDestination(path+'?access_token=private&refresh_token=private#private');assert.equal(takeDestination(),path);assert.equal(takeDestination(),null);}
});
test('post, game and bounded search context survive while unrelated fields and external routes are discarded',()=>{
 const id='11111111-1111-4111-8111-111111111111';rememberDestination('/feed?post='+id+'&token=private');assert.equal(takeDestination(),'/feed?post='+id);rememberDestination('/fan-live?gameId='+id+'&code=private');assert.equal(takeDestination(),'/fan-live?gameId='+id);rememberDestination('/search?q='+'x'.repeat(200)+'&code=private');assert.equal(takeDestination(),'/search?q='+'x'.repeat(100));
 for(const path of['//other.test/account','https://other.test/account','/auth/callback?code=private','/reset-password?code=private','/membership?'+('x'.repeat(9000))]){rememberDestination(path);assert.equal(takeDestination(),null);}
});
