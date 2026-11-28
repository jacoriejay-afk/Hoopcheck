import test from "node:test";
import assert from "node:assert/strict";
import {resolveTrustReviewVerification} from "../lib/server/review-trust-verification.ts";
import {calculateTrustScore} from "../lib/trust-score.ts";
const id=n=>"11111111-1111-4111-8111-"+String(n).padStart(12,"0");
function fixture(facts=[{review_id:id(2),reviewer_verified:true}]){
 const calls=[];
 const db={from(table){assert.equal(table,"profiles");return {select(fields){assert.equal(fields,"id,player_verified");return {in(column,ids){calls.push(["profiles",column,ids]);return Promise.resolve({data:[{id:id(3),player_verified:true}],error:null})}}}}},rpc(name,args){calls.push([name,args]);return Promise.resolve({data:facts,error:null});}};
 return {db,calls};
}
test("legacy reviews do not depend on a new RPC",async()=>{
 const {db,calls}=fixture();
 const result=await resolveTrustReviewVerification(db,"men",[{id:id(1),author_id:id(3)}]);
 assert.equal(result.get(id(1)),true);assert.equal(calls.length,1);
});
test("retained reviews use only the verified flag, never a former author lookup",async()=>{
 for(const kind of ["men","women"]){
  const {db,calls}=fixture();
  const result=await resolveTrustReviewVerification(db,kind,[{id:id(1),author_id:id(3)},{id:id(2),author_id:null}]);
  assert.deepEqual([...result.entries()],[[id(1),true],[id(2),true]]);
  assert.deepEqual(calls,[["profiles","id",[id(3)]],["get_retained_review_trust_facts",{p_kind:kind,p_ids:[id(2)]}]]);
  const score=calculateTrustScore({averageRating:4,reviews:[id(1),id(2)].map(id=>({createdAt:"2026-11-01T00:00:00Z",reviewerVerified:result.get(id)})),now:new Date("2026-11-28T00:00:00Z")});
  assert.equal(score.reviewCount,2);assert.equal(score.verifiedReviewCount,2);
 }
});
test("missing, foreign, malformed and duplicate retained facts fail closed",async()=>{
 for(const facts of [[],[{review_id:id(9),reviewer_verified:true}],[{review_id:id(2),reviewer_verified:"true"}],[{review_id:id(2),reviewer_verified:true},{review_id:id(2),reviewer_verified:true}]]){
  const {db}=fixture(facts);
  await assert.rejects(resolveTrustReviewVerification(db,"men",[{id:id(2),author_id:null}]));
 }
 const {db}=fixture();await assert.rejects(resolveTrustReviewVerification(db,"men",[{id:id(2),author_id:null},{id:id(2),author_id:null}]));
});
