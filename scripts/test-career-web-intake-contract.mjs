import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("career UI is opt-in and preserves the legacy and non-player paths",()=>{
 const onboarding=read("app/onboarding/teams/page.tsx"),account=read("app/account/page.tsx"),page=read("app/career-history/page.tsx"),component=read("components/CareerClaimIntake.tsx");
 assert.match(component,/NEXT_PUBLIC_HOOPCHECK_CAREER_CLAIMS_ENABLED==="true"/);
 assert.match(onboarding,/step===1&&accountType==="player"&&careerIntakeEnabled&&userId\?<CareerClaimIntake/);
 assert.match(onboarding,/step===1&&accountType==="player"&&!careerIntakeEnabled/);
 assert.match(account,/NEXT_PUBLIC_HOOPCHECK_CAREER_CLAIMS_ENABLED==="true"&&<SettingsRow icon="file" label="Private career history"/);
 assert.match(page,/profile\.data\?\.account_type!=="player"/);
 assert.match(component,/session\?\.user\.id!==userId/);
 assert.match(component,/if\(lock\.current\)return/);
 assert.match(component,/does not unlock reviews yet/);
 assert.match(component,/kind:"missing_club"/);
 assert.doesNotMatch(component,/service_role|verification_status:"verified"|player_id:/);
});
