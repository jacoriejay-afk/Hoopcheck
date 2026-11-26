import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
test("campaign reporting stays behind owner MFA authorization and uses aggregates",()=>{
 const page=read("../app/owner-hq/campaigns/page.tsx"),server=read("../lib/owner/campaign-reporting.ts");
 assert.ok(page.indexOf('await requireAmbassadorSession("/owner-hq/campaigns",true)')<page.indexOf("await readCampaignReporting()"));
 assert.match(server,/import "server-only"/);
 assert.match(server,/head:true,count:"exact"/);
 assert.match(server,/\.is\("disqualified_at",null\)\.not\("first_paid_at","is",null\)/);
 assert.match(server,/MAX_CAMPAIGNS=20/);
 assert.doesNotMatch(server,/referred_user_id|stripe_customer_id|\.insert\(|\.update\(|\.delete\(/);
 assert.match(page,/not unique visitors/);
});
