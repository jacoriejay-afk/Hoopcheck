import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");

test("owner customization uses only the existing permitted database fields and choices",()=>{
  const groups=read("../components/HoopGroupsChannels.tsx");
  for(const value of ["orange","blue","purple","green","pink","gold"]){
    assert.ok(groups.includes(value+':"')||groups.includes(value+': "'),"Allowed existing accent: "+value);
  }
  for(const value of ["basketball","flame","globe","star","trophy","users"])assert.match(groups,new RegExp(value+':"'));
  assert.match(groups,/\.update\(\{name,description,accent_color:editColor,icon_key:editIcon\}\)/);
  assert.match(groups,/\.eq\("id",id\)\.eq\("owner_id",userId\)/);
  assert.match(groups,/data\.owner_id!==userId/);
  assert.match(groups,/if\(!selected \|\| !userId \|\| selected\.owner_id!==userId/);
  assert.match(groups,/selected\?\.owner_id===userId\?<Pressable/);
  assert.match(groups,/name\.length<3 \|\| name\.length>80 \|\| description\.length>300/);
  assert.match(groups,/setSpaces\(current=>current\.map\(space=>space\.id===id\?data as Space:space\)\)/);
});

test("new owner appearance controls do not bypass the independent HoopGroups rollout",()=>{
  const route=read("../app/hoopgroups.tsx");
  const groups=read("../components/HoopGroupsChannels.tsx");
  assert.match(route,/EXPO_PUBLIC_HOOPGROUPS_CHANNELS_ENABLED === "true"/);
  assert.match(route, /enabled \? <HoopGroupsChannels \/>/);
  assert.match(groups,/moderation_status:"pending"/);
  assert.match(groups,/hoop_group_reports/);
  assert.match(groups,/hoop_group_blocks/);
  assert.doesNotMatch(route,/Browse official Team Fan Groups/);
});

test("group visuals come from approved fixed choices, not unmoderated image URLs",()=>{
  const groups=read("../components/HoopGroupsChannels.tsx");
  assert.match(groups,/emblem\(space\.icon_key\)/);
  assert.match(groups,/accent\(selected\?\.accent_color\|\|"orange"\)/);
  assert.match(groups,/accessibilityRole="radio"/);
  assert.match(groups,/accessibilityLabel="Manage group appearance"/);
  assert.doesNotMatch(groups,/upload.*banner|banner_url|cover_url/i);
});
