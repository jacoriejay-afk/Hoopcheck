import {test} from "node:test";
import assert from "node:assert/strict";
import {removeApprovedExportCopiesAndRetainReviews} from "../lib/server/account-deletion-export-review.ts";
const lease={requestId:"11111111-1111-4111-8111-111111111111",ownerId:"22222222-2222-4222-8222-222222222222",fence:"33333333-3333-4333-8333-333333333333",policyVersion:"fixture",completed:[]};
test("deletion export/review adapter requires opt-in and ordered durable acknowledgements",async()=>{
 const prior=process.env.ACCOUNT_DELETION_WORKER_ENABLED;
 const calls=[];let fail=false;
 const admin={rpc:async(name,args)=>{calls.push(name);assert.equal(args.p_owner,lease.ownerId);if(name==="assert_account_deletion_worker")return {data:true};if(name==="scrub_approved_deletion_exports")return {data:fail?{ok:false}:{ok:true,removed_jobs:2}};return {data:{ok:true,retained_count:1}};}};
 try{
 delete process.env.ACCOUNT_DELETION_WORKER_ENABLED;
 await assert.rejects(removeApprovedExportCopiesAndRetainReviews(admin,lease,async()=>{}));assert.deepEqual(calls,[]);
 process.env.ACCOUNT_DELETION_WORKER_ENABLED="true";fail=true;
 await assert.rejects(removeApprovedExportCopiesAndRetainReviews(admin,lease,async()=>{}));assert.ok(!calls.includes("retain_approved_deletion_reviews"));
 fail=false;calls.length=0;assert.equal((await removeApprovedExportCopiesAndRetainReviews(admin,lease,async()=>{})).confirmed,true);
 assert.deepEqual(calls.filter(x=>x!=="assert_account_deletion_worker"),["scrub_approved_deletion_exports","retain_approved_deletion_reviews"]);
 }finally{if(prior===undefined)delete process.env.ACCOUNT_DELETION_WORKER_ENABLED;else process.env.ACCOUNT_DELETION_WORKER_ENABLED=prior;}
});
