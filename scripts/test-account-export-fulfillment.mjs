import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("durable export endpoint is disabled by default and uses the verified caller RPC, not service credentials",()=>{
 const src=read("app/api/account/export-job/route.ts");
 assert.match(src,/ACCOUNT_EXPORT_FULFILLMENT_ENABLED!=="true"/);
 assert.match(src,/confirm_active_account_session/);
 assert.match(src,/assuranceForVerifiedUser/);
 assert.match(src,/jwt\.sub!==user\.id/);
 assert.match(src,/await verify\(\)!==owner/);
 assert.match(src,/account_export_job/);
 assert.match(src,/private, no-store/);
 assert.doesNotMatch(src,/SERVICE_ROLE|\.from\(/);
});
test("privacy center has separately gated, account-keyed export UI with cancel and page downloads",()=>{
 const page=read("app/privacy-center/page.tsx"),src=read("components/AccountExportJobs.tsx");
 assert.match(page,/NEXT_PUBLIC_ACCOUNT_EXPORT_FULFILLMENT_ENABLED==="true"&&userId&&<AccountExportJobs key=\{userId\}/);
 assert.match(src,/latest\.data\.session\.access_token!==token/);
 assert.match(src,/current\.current\?\.abort\(\)/);
 assert.match(src,/action\("cancel"\)/);
 assert.match(src,/setAfter\(value\.next_after\)/);
 assert.doesNotMatch(src,/localStorage|sessionStorage/);
});
test("worker requires opt-in, uses only a server key and logs no payload",()=>{
 const src=read("scripts/run-account-export-worker.mjs");
 assert.match(src,/ACCOUNT_EXPORT_WORKER_ENABLED!=="true"/);
 assert.match(src,/run_account_export_worker/);
 assert.doesNotMatch(src,/console\.(?:log|error)\(r\./);
});
