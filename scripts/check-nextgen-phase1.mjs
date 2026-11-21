import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

for(const [kind,table] of [["agents","agent_showcases"],["creators","creator_profiles"]]){
  const source=read("app/api/network/"+kind+"/route.ts");
  assert.match(source,new RegExp('\\.from\\("'+table+'"\\)'),kind+" uses only owner-opted showcases");
  assert.match(source,/\.eq\("is_published",true\)/);
  assert.match(source,/\.eq\("profiles\.moderation_status","normal"\)/);
  assert.doesNotMatch(source,/\.from\("profiles"\)/,kind+" must not pull private profile rows directly");
  assert.match(source,/SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(source,/Cache-Control/);
}
const agents=read("app/api/network/agents/route.ts");
assert.match(agents,/\.in\("profiles\.account_type",\["agent","scout"\]\)/);
assert.match(agents,/identity_checked:p\.identity_verification_status==="verified"/);
assert.match(agents,/display_name:row\.public_name/);
const creators=read("app/api/network/creators/route.ts");
assert.match(creators,/display_name:row\.public_name/);
assert.match(creators,/avatar_url:null/);
assert.doesNotMatch(creators,/profile_visibility/);

for(const path of ["app/api/network/creator-studio/route.ts","app/api/network/agent-studio/route.ts"]){
  const source=read(path);
  assert.match(source,/auth\.auth\.getUser\(token\)/,path+" revalidates bearer token");
  assert.match(source,/\.eq\("profile_id",user\.id\)/,path+" only reads its own row");
  assert.match(source,/profile_id:user\.id/,path+" writes owner id, not supplied id");
  assert.match(source,/typeof is_published!=="boolean"/,path+" validates publish opt-in");
  assert.match(source,/moderation_status/,path+" enforces live moderation");
  assert.match(source,/https:/,path+" validates HTTPS websites");
}
assert.match(read("app/api/network/agent-studio/route.ts"),/\["agent","scout"\]\.includes\(profile\.account_type\)/);

for(const path of ["app/agents/page.tsx","app/agents/[id]/page.tsx",
 "app/creators/page.tsx","app/creators/[id]/page.tsx","app/creator-studio/page.tsx","app/agent-studio/page.tsx"]){
  const component=read(path);
  assert.match(component,/\/api\/network\//,path+" uses scoped API");
  assert.doesNotMatch(component,/\.from\("profiles"\)|\.from\("creator_profiles"\)|\.from\("agent_showcases"\)/,
    path+" does not read or write protected tables directly");
}
const ddl=read("supabase/migrations/20261122230000_nextgen_creator_profiles.sql");
for(const table of ["creator_profiles","agent_showcases"]){
  assert.match(ddl,new RegExp('alter table public\\.'+table+' enable row level security'));
  assert.match(ddl,new RegExp('revoke all on public\\.'+table+' from anon, authenticated'));
  assert.match(ddl,new RegExp('grant select, insert, update, delete on public\\.'+table+' to service_role'));
}
assert.doesNotMatch(ddl,/alter table public\.profiles|grant select on public\.profiles|security definer/i);
for(const path of ["app/directory/page.tsx","components/SiteHeader.tsx"]){
  assert.match(read(path),/\/agents/);
  assert.match(read(path),/\/creators/);
}
console.log("NEXTGEN Phase 1: privacy, roles, opt-in and routing invariants passed.");
