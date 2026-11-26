import assert from 'node:assert/strict';
import {pairFingerprint,planDuplicatePairs} from './directory-duplicate-pair-plan.mjs';
const a={id:'a',name:'Example',country:'Japan',city:'Tokyo',basketball_type:'mens',active:true};
const b={...a,id:'b',name:'Example BC'};
const decision=(x=a,y=b)=>({keepId:x.id,retireId:y.id,snapshotFingerprint:pairFingerprint(x,y),identityConfirmed:true,distinctSquadExcluded:true,reviewerId:'reviewer',evidenceRef:'fixture-only',survivorReason:'retains established profile'});
const check=(x,y,d=decision(x,y))=>planDuplicatePairs([x,y],[d],{complete:true});
assert.throws(()=>planDuplicatePairs([a,b],[decision()]));
assert.throws(()=>planDuplicatePairs([a,a],[decision()],{complete:true}));
const ok=check(a,b);
assert.equal(ok.referenceReviewCount,1);
assert.equal(ok.pairs[0].status,'reference-review-required');
assert.equal(ok.writeAuthorized,false);
assert.equal(ok.pairs[0].writeAuthorized,false);
assert.deepEqual(check(a,b),ok);
for(const [x,y,reason] of [
 [a,{...b,basketball_type:'womens'},'side-conflict'],
 [a,{...b,country:'Russia'},'country-conflict'],
 [a,{...b,city:'Osaka'},'city-conflict'],
 [{...a,source_id:'s',external_id:'1'},{...b,source_id:'s',external_id:'2'},'provider-id-conflict'],
 [{...a,active:false},b,'inactive-survivor']
]){
 const p=check(x,y).pairs[0];assert.equal(p.status,'blocked');assert.ok(p.reasons.includes(reason));
}
assert.ok(check(a,{...b,name:'Changed'},decision()).pairs[0].reasons.includes('stale-review'));
assert.ok(check(a,b,{...decision(),distinctSquadExcluded:false}).pairs[0].reasons.includes('identity-evidence-required'));
const c={...a,id:'c'};
assert.equal(planDuplicatePairs([a,b,c],[decision(),decision(b,c)],{complete:true}).referenceReviewCount,0);
assert.equal(planDuplicatePairs([a],[decision()],{complete:true}).pairs[0].status,'blocked');
console.log('PASS: duplicate pairs require reviewed identity, unchanged snapshot and disjoint IDs; no write permission');
