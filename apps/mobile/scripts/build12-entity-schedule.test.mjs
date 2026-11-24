import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { upcomingEntityGames } from "../src/native/entitySchedule.ts";
import { readLiveGames } from "../src/native/liveGames.ts";
const id = n => "11111111-1111-4111-8111-" + String(n).padStart(12,"0");
const now = new Date("2026-11-24T10:00:00Z");
const row=(n,changes={})=>({ id:id(n),team_id:id(10),opponent_team_id:id(11),opponent_name:"Away",
  scheduled_at:"2026-11-24T12:00:00Z",status:"scheduled",league_name:"Fixture League",country:"Spain",...changes });
const db = request => createClient("https://fixture.supabase.co","fixture",{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:request}});
const read = path => readFileSync(new URL(path,import.meta.url),"utf8");
test("entity schedules include only unique future fixtures for the exact home or away team",()=>{
  const scope={kind:"team",id:id(10)};
  const input=[row(1),row(1),row(2,{team_id:id(12),opponent_team_id:id(10),scheduled_at:"2026-11-24T11:00:00Z"}),
    row(3,{team_id:id(12),opponent_team_id:id(13)}),row(4,{status:"final"}),row(5,{status:"cancelled"}),
    row(6,{scheduled_at:"2026-11-24T09:59:00Z"}),row(7,{scheduled_at:null})];
  assert.deepEqual(upcomingEntityGames(input,scope,now.getTime()).map(x=>x.id),[id(2),id(1)]);
});
test("same-named leagues in other countries, unknown countries and partial names never cross-match",()=>{
  const input=[row(1),row(2,{country:"France"}),row(3,{league_name:"Fixture League 2"}),row(4,{country:null}),row(5,{league_name:" fixture league "})];
  assert.deepEqual(upcomingEntityGames(input,{kind:"league",name:"Fixture League",country:"Spain"},now.getTime()).map(x=>x.id),[id(1),id(5)]);
  assert.equal(upcomingEntityGames(input,{kind:"league",name:"Fixture League",country:null},now.getTime()).length,0);
});
test("scoped direct reads constrain status, date and both team IDs before the 500-row cap",async()=>{
  const queries=[];
  const result=await readLiveGames(db(async input=>{const u=new URL(String(input));queries.push(u);
    return Response.json(u.pathname.endsWith("/fan_live_games")?[row(1),row(2,{team_id:id(12),opponent_team_id:id(13)})]:[{id:id(10),name:"Home"}]);
  }),"mens",null,now,fetch,{kind:"team",id:id(10)});
  const q=queries[0].searchParams;
  assert.equal(q.get("status"),"eq.scheduled");
  assert.equal(q.get("or"),"(team_id.eq."+id(10)+",opponent_team_id.eq."+id(10)+")");
  assert.deepEqual(q.getAll("scheduled_at"),["gte.2026-11-24T10:00:00.000Z","lte.2026-12-08T10:00:00.000Z"]);
  assert.equal(q.get("limit"),"500");
  assert.deepEqual(result.games.map(x=>x.id),[id(1)]);
  assert.ok(!queries[1].searchParams.get("id").includes(id(12)));
});
test("free-player scoped reads preserve bearer API and do not access the live table",async()=>{
  const paths=[];
  const result=await readLiveGames(db(async input=>{paths.push(new URL(String(input)).pathname);return Response.json([{id:id(10),name:"Home"}]);}),"mens",
    {origin:"https://api.test",token:"fixture"},now,async(url,options)=>{
      assert.equal(url,"https://api.test/api/game-predictions?mode=games");assert.equal(options.headers.Authorization,"Bearer fixture");
      return Response.json({games:[row(1),row(2,{country:"France"}),row(3,{status:"final"})]});
    },{kind:"league",name:"Fixture League",country:"Spain"});
  assert.deepEqual(result.games.map(x=>x.id),[id(1)]);
  assert.ok(!paths.includes("/rest/v1/fan_live_games"));
});
test("all four native directory details mount schedules, with account and game center gates",()=>{
  for(const path of ["../app/teams/[id].tsx","../app/leagues/[id].tsx","../app/womens/[id].tsx","../app/womens/leagues/[id].tsx"])assert.match(read(path),/<EntitySchedule scope=/);
  const screen=read("../components/EntitySchedule.tsx");
  assert.match(screen,/canUseLiveGameHub/);assert.match(screen,/canSwitchBasketballSide/);
  assert.match(screen,/session.data.session\?\.user.id !== uid/);
  assert.match(screen,/state\?\.key === key/);assert.match(screen,/params: \{ gameId: game.id, side \}/);
  assert.match(screen,/No confirmed upcoming fixtures/);
});
test("navigation glass, header, and native settings destinations remain accessibility-safe",()=>{
  const layout=read("../app/_layout.tsx"),header=read("../components/NativePageHeader.tsx"),glass=read("../components/GlassSurface.tsx"),tab=read("../components/TabBar.tsx");
  assert.match(layout,/<NativePageHeader title=/);assert.match(header,/insets.top \+ 3/);
  assert.match(header,/accessibilityLabel="Back"/);assert.match(header,/fontFamily: "HoopCheckDisplay"/);
  assert.match(glass,/navigation && nativeGlass \? "transparent"/);assert.match(tab,/glassEffectStyle="clear"/);assert.match(tab,/PanResponder\.create/);
  const account=read("../app/account.tsx"),settings=read("../app/settings.tsx");
  assert.doesNotMatch(account,/pathname:"\/web"/);assert.doesNotMatch(settings,/pathname:\s*"\/web"/);
  assert.match(settings,/router.push\("\/membership"\)/);assert.match(settings,/router.push\("\/account\/edit"\)/);
  assert.match(read("../app/search.tsx"),/<ExploreLinks compact/);
});
