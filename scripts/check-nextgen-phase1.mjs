import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

const agentsApi=read("app/api/network/agents/route.ts");
assert.match(agentsApi,/\.in\("account_type",\["agent","scout"\]\)/);
assert.match(agentsApi,/\.eq\("profile_visibility","public"\)/);
assert.match(agentsApi,/\.eq\("moderation_status","normal"\)/);
assert.match(agentsApi,/identity_checked:row\.identity_verification_status==="verified"/);
const agentColumns=agentsApi.match(/\.select\("([^"]+)"\)/)?.[1]||"";
assert.doesNotMatch(agentColumns,/\bcurrent_country\b|\bbirthdate\b|\bmoderation_note\b/);

const creatorsApi=read("app/api/network/creators/route.ts");
assert.match(creatorsApi,/\.eq\("is_published",true\)/);
assert.match(creatorsApi,/\.eq\("profiles\.profile_visibility","public"\)/);
assert.match(creatorsApi,/\.eq\("profiles\.moderation_status","normal"\)/);
assert.match(creatorsApi,/p\.profile_visibility!=="public"\|\|p\.moderation_status!=="normal"/);
assert.doesNotMatch(creatorsApi,/user_metadata|service_role.*NEXT_PUBLIC/);

const studio=read("app/api/network/creator-studio/route.ts");
assert.match(studio,/auth\.auth\.getUser\(token\)/);
assert.match(studio,/\.eq\("profile_id",user\.id\)/);
assert.match(studio,/profile_id:user\.id/);
assert.match(studio,/typeof is_published!=="boolean"/);
assert.match(studio,/parsed\.protocol!=="https:"/);
assert.doesNotMatch(studio,/\.from\("profiles"\)\.select\("\*"\)/);

for(const path of ["app/agents/page.tsx","app/agents/[id]/page.tsx","app/creators/page.tsx","app/creators/[id]/page.tsx","app/creator-studio/page.tsx"]){
  const component=read(path);
  assert.match(component,/\/api\/network\//,path+" uses scoped API");
  assert.doesNotMatch(component,/\.from\("profiles"\)|\.from\("creator_profiles"\)/,path+" must not query protected tables directly");
}
const ddl=read("supabase/migrations/20261122230000_nextgen_creator_profiles.sql");
assert.match(ddl,/enable row level security/i);
assert.match(ddl,/creator profiles own create/);
assert.match(ddl,/creator profiles own edit/);
assert.match(ddl,/creator profiles own remove/);
assert.match(ddl,/revoke all on public\.creator_profiles from anon, authenticated/i);
assert.doesNotMatch(ddl,/grant select on public\.creator_profiles to anon/i);
assert.doesNotMatch(ddl,/security definer/i);
assert.match(ddl,/grant select, insert, update, delete on public\.creator_profiles to service_role/i);

for(const path of ["app/directory/page.tsx","components/SiteHeader.tsx"]){
  assert.match(read(path),/\/agents/);
  assert.match(read(path),/\/creators/);
}
console.log("NEXTGEN Phase 1 security and routing invariants passed.");
