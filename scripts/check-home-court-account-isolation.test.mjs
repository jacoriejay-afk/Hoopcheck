import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("Authenticated user ID and role are passed to the two courtside surfaces",()=>{
  const dashboard=read("app/dashboard/page.tsx");
  assert.match(dashboard,/setAuthenticatedUserId\(user\.id\)/);
  assert.match(dashboard,/<HomeCourtSpace profileId=\{authenticatedUserId\} role=\{profile\?\.account_type\}/);
  assert.match(dashboard,/<RoleQuickLinks role=\{profile\?\.account_type\} profileId=\{authenticatedUserId\}/);
  assert.doesNotMatch(dashboard,/<HomeCourtSpace profileId=\{profile\?\.id \|\| email\}/);
});

test("My Court storage is user-and-role scoped with legacy account migration",()=>{
  const source=read("app/dashboard/HomeCourtSpace.tsx");
  assert.match(source,/identity=profileId\?profileId\+"\:"\+activeRole/);
  assert.match(source,/getItem\("hc-court-v2:"\+identity\)/);
  assert.match(source,/getItem\("hc-court-v1:"\+profileId\)/);
  assert.match(source,/setLoadedIdentity\(identity\)/);
  assert.match(source,/if\(!identity\|\|loadedIdentity!==identity\)return/);
  assert.match(source,/if\(!profileId\|\|loadedIdentity!==identity\)return null/);
  assert.match(source,/setItem\("hc-court-v2:"\+identity,JSON\.stringify\(prefs\)\)/);
});

test("All supported roles have My Court presets without duplicate featured quick actions",()=>{
  const source=read("app/dashboard/HomeCourtSpace.tsx");
  for(const role of ["player","fan","coach","agent","scout","club_admin","admin","creator","member"]){
    assert.match(source,new RegExp("\\b"+role+":\\{accent:"));
  }
  assert.match(source,/current\.featured===id/);
  assert.match(source,/current\.actions\.filter\(item=>item!==id\)/);
  assert.match(source,/hasFeedAccess\?"/);
  assert.match(source,/feature\(event\.target\.value as ActionId\)/);
});

test("Courtside shortcuts are independently scoped, editable and role-specific",()=>{
  const source=read("components/RoleQuickLinks.tsx");
  for(const role of ["player","fan","coach","agent","club_admin","admin","creator","member"]){
    assert.match(source,new RegExp("\\b"+role+":\\{title:"));
  }
  assert.match(source,/setItem\("hc-courtside-v1:"\+identity,JSON\.stringify\(prefs\)\)/);
  assert.match(source,/if\(profileId&&loadedIdentity!==identity\)return null/);
  assert.match(source,/aria-expanded=\{editing\}/);
  assert.match(source,/current\.links\.length>=4/);
});

test("iPhone CSS prioritizes two readable columns and keeps bottom navigation clear",()=>{
  const court=read("app/dashboard/home-court-space.css");
  const role=read("components/role-quick-links.css");
  assert.match(court,/\.hc-home3 \.hc-my-court \.hc-court-actions \{display:grid!important;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
  assert.match(court,/overflow-wrap:normal;word-break:normal;hyphens:none/);
  assert.match(court,/padding-bottom:calc\(155px \+ env\(safe-area-inset-bottom,0px\)\)!important/);
  assert.match(role,/\.hc-home3 \.hc-role-quick-links\.is-compact \.hc-role-quick-links__grid \{display:grid!important;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
});

test("Dashboard Court Space does not inherit illustration aspect ratio or perspective",()=>{
  const global=read("app/globals.css");
  const court=read("app/dashboard/home-court-space.css");
  const role=read("components/role-quick-links.css");
  assert.match(global,/\.hc-hero-art > \.hc-court \{\s*width: min\(82%, 470px\); aspect-ratio: 1 \/ 1\.04/);
  assert.doesNotMatch(global,/(?:^|\n)\.hc-court \{\s*width: min\(82%, 470px\)/);
  assert.doesNotMatch(global,/\n\s*\.hc-court \{ width: 78%; \}/);
  assert.match(court,/section\.hc-my-court \{[\s\S]*?aspect-ratio: auto !important;[\s\S]*?transform: none !important;/);
  assert.match(read("app/dashboard/HomeCourtSpace.tsx"),/className="hc-my-court"/);
  assert.doesNotMatch(read("app/dashboard/HomeCourtSpace.tsx"),/className="hc-court"/);
  assert.match(court,/section\.hc-my-court \{[\s\S]*?height: auto !important;/);
  assert.match(global,/\.page-container input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\)/);
  for(const css of [court,role]){
    assert.match(css,/input\[type="radio"\]/);
    assert.match(css,/input\[type="checkbox"\]/);
    assert.match(css,/width: 18px !important;/);
    assert.match(css,/max-width: 18px !important;/);
  }
  assert.match(court,/body:has\(main\.hc-home3\)::before/);
});

test("Fan HQ shortcut reaches the personal team dashboard and restores saved legacy links",()=>{
  const source=read("components/RoleQuickLinks.tsx");
  assert.match(source,/href:"\/team-hub",label:"Fan HQ"/);
  assert.match(source,/role==="fan"&&href==="\/fan-feed"\?"\/team-hub"/);
  const hub=read("app/team-hub/page.tsx");
  assert.match(hub,/<h1>\{labels.title\}<\/h1>/);
  assert.match(hub,/href=\{directoryHref\}>\{labels.findTeams\}/);
  assert.match(hub,/getLiveGameStatusPresentation\(game,clock\)/);
  assert.match(hub,/presentation.showPeriod&&game.period_label/);
  assert.match(hub,/formatPregameCountdown\(game.status,game.scheduled_at,clock\)/);
  assert.match(hub,/signedIn&&!message&&!teams.length/);
  assert.match(hub,/window.clearInterval\(id\);requestSequence.current\+\+/);
});

test("Fan HQ includes home and away fixtures on both sides and clears cross-account state",()=>{
  const hub=read("app/team-hub/page.tsx");
  assert.match(hub,/\.in\("team_id",followedTeamIds\)/);
  assert.match(hub,/\.in\("opponent_team_id",followedTeamIds\)/);
  assert.match(hub,/g\.team_id===team\.id\|\|g\.opponent_team_id===team\.id/);
  assert.doesNotMatch(hub,/if\(basketballSide==="mens" && followedTeamIds.length\)/);
  assert.match(hub,/new Map\(\[\.\.\.\(homeRows.data\|\|\[\]\),\.\.\.\(awayRows.data\|\|\[\]\)\]/);
  assert.match(hub,/homeRows.error\|\|awayRows.error/);
  assert.match(hub,/!scheduleAvailable\?<p/);
  assert.match(hub,/event!=="SIGNED_OUT"/);
  assert.match(hub,/requestSequence.current\+\+;activeUser.current=next/);
  assert.match(hub,/setSignedIn\(false\);setTeams\(\[\]\);setGames\(\[\]\);setTeamNames\(\{\}\)/);
  assert.match(hub,/signedIn&&teams.map/);
});
