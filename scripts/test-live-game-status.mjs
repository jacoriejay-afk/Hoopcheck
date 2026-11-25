import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const read = name => readFileSync(new URL("../" + name, import.meta.url), "utf8");
const compiled = ts.transpileModule(read("lib/live-game-status.ts"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { getLiveGameStatusPresentation: present } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);

const now = new Date("2026-11-22T12:00:00Z");
const active = { status: "live", period_label: "Quarter 1", started_at: "2026-11-22T11:00:00Z", scheduled_at: "2026-11-22T11:00:00Z", ends_at: null };
assert.deepEqual(present(active, now), {
  label: "LIVE", isVerifiedLive: true, isVerifiedFinal: false, isUnverified: false, showPeriod: true,
}, "Provider live Q1 must remain live");
for (const period_label of ["Quarter 1", "Q1", "Quarter 3", "Halftime", "Break Time", "Overtime"]) {
  const result = present({ ...active, status: "final", period_label }, now);
  assert.equal(result.label, "RESULT PENDING", "A terminal status with " + period_label + " cannot be a confirmed final");
  assert.equal(result.isVerifiedFinal, false);
  assert.equal(result.isVerifiedLive, false);
  assert.equal(result.showPeriod, false);
}
assert.equal(present({ ...active, status: "final", period_label: null }, now).label, "FINAL",
  "Real provider final may be displayed");
assert.equal(present({ ...active, started_at: "2026-11-22T06:00:00Z" }, now).label, "UPDATE DELAYED",
  "Overdue live rows must not be silently finalized or marked as live");
assert.equal(present({ ...active, status: "scheduled", period_label: null }, now).label, "UPCOMING");

const sync = read("app/api/cron/live-basketball/route.ts");
assert.ok(sync.includes('finalStatuses.has(providerStatus) ? "final"'), "Provider must explicitly confirm finals");
assert.doesNotMatch(sync, /update\(\{\s*status:\s*["']final["']\s*\}\)/, "Never infer final from elapsed time");
assert.doesNotMatch(sync, /staleQuery/, "Do not restore the time-based forced final");
assert.ok(sync.includes('period_label: liveStatuses.has(providerStatus)'), "Clear stale period text after genuine finals");

const hub = read("app/live-games/page.tsx");
const chat = read("app/fan-live/page.tsx");
assert.match(hub, /presentation\.isVerifiedLive/, "LIVE listing must use confirmed provider state");
assert.match(hub, /presentation\.isUnverified/, "Hub needs an honest unverified state");
assert.match(chat, /selectedStatus\?\.isUnverified/, "Game chat needs an honest unverified state");
assert.match(chat, /status\.showPeriod\?game\.period_label/, "Room picker must not show Q1 beside FINAL");
console.log("PASS: Live quarter, stale final, delayed score and room labels remain consistent.");

const availabilityJs = ts.transpileModule(read("lib/game-availability.ts"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { formatPregameCountdown: countdown, formatViewerLocalTime, getViewerUpcomingTimeBucket: bucket } = await import(
  "data:text/javascript;base64," + Buffer.from(availabilityJs).toString("base64")
);
assert.equal(countdown("scheduled", "2026-11-22T12:00:01Z", now), "Tip-off in 1m");
assert.equal(countdown("scheduled", "2026-11-22T13:00:00Z", now), "Tip-off in 1h");
assert.equal(countdown("scheduled", "2026-11-23T13:30:00Z", now), "Tip-off in 1d 1h 30m");
for (const state of ["live", "final", "cancelled", "postponed", "abandoned"]) {
  assert.equal(countdown(state, "2026-11-23T13:30:00Z", now), null);
}
for (const date of [null, "invalid", "2026-11-22T12:00:00Z", "2026-11-22T11:59:00Z"]) {
  assert.equal(countdown("scheduled", date, now), null);
}
assert.match(hub, /isUpcoming && !presentation\.isUnverified \? formatPregameCountdown/);
console.log("PASS: pregame countdown only displays for valid future scheduled fixtures.");

const xpJs=ts.transpileModule(read("lib/fan-prediction-xp.ts"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {calculateFanPredictionXp:xp}=await import("data:text/javascript;base64,"+Buffer.from(xpJs).toString("base64"));
const game={id:"g",team_id:"home",opponent_team_id:"away",winner_team_id:"home",scheduled_at:"2026-11-22T09:00:00Z",ends_at:"2026-11-22T11:00:00Z"};
const pick={game_id:"g",picked_team_id:"home",updated_at:"2026-11-22T08:00:00Z"};
assert.equal(xp([pick,pick],[game],now).xp,10,"Duplicate game picks do not inflate XP");
assert.equal(xp([{...pick,picked_team_id:"away"}],[game],now).settled_picks,1);
assert.equal(xp([{...pick,picked_team_id:"away"}],[game],now).xp,0);
for(const updated_at of ["2026-11-22T09:00:00Z","2026-11-22T10:00:00Z","2025-11-22T08:00:00Z",null])assert.equal(xp([{...pick,updated_at}],[game],now).xp,0);
for(const ends_at of [null,"2026-11-22T08:59:00Z","2026-11-22T13:00:00Z"])assert.equal(xp([pick],[{...game,ends_at}],now).xp,0);
assert.equal(xp([{...pick,picked_team_id:"third"}],[game],now).settled_picks,0);
const many=Array.from({length:5},(_,i)=>({...game,id:"g"+i}));
assert.equal(xp(many.map(g=>({...pick,game_id:g.id})),many,now).level,"Starter");
assert.equal(xp([],[],now).level,"Rookie");
const fanApi=read("app/api/game-predictions/route.ts");
assert.match(fanApi,/mode"\) === "fan-xp"/);
assert.match(fanApi,/profile\?\.account_type!=="fan"/);
assert.match(fanApi,/ranking\?base:base\.eq\("user_id",user.id\)\)\s*\.gte\("updated_at",cutoff\)/);
assert.match(fanApi,/count!==picks.length/);
assert.match(fanApi,/getLiveGameStatusPresentation\(game,now\).isVerifiedFinal/);
assert.match(read("app/team-hub/page.tsx"),/key=\{fanAccountId\} accountId=\{fanAccountId\}/);
assert.match(read("components/FanPredictionXp.tsx"),/session\?\.user.id!==accountId/);
console.log("PASS: bounded, private, non-redeemable fan XP from settled pregame picks.");

const passportGames=[{...game,id:"one",country:"Portugal",league_name:"Liga A"},{...game,id:"two",country:" portugal ",league_name:"liga a"},{...game,id:"three",country:"Austria",league_name:"Liga A"},{...game,id:"four",country:null,league_name:null}];
const passportPicks=passportGames.map(g=>({...pick,game_id:g.id}));
const passport=xp([...passportPicks,passportPicks[0]],passportGames,now).passport;
assert.deepEqual(passport.countries,["Austria","Portugal"]);
assert.equal(passport.league_count,2);
assert.equal(passport.recent.length,4);
assert.equal(passport.milestones.find(m=>m.id==="first-pick").earned,true);
assert.equal(passport.milestones.find(m=>m.id==="international").earned,false);
assert.equal(xp([{...pick,game_id:"one",updated_at:"2025-01-01T00:00:00Z"}],passportGames,now).passport.recent.length,0);
const large=Array.from({length:15},(_,i)=>({...game,id:"x"+i}));
assert.equal(xp(large.map(g=>({...pick,game_id:g.id})),large,now).passport.recent.length,12);
assert.match(read("components/FanPredictionXp.tsx"),/not your location, travel or arena attendance/);
console.log("PASS: private prediction passport and rolling-window milestones.");

const {calculateFanPredictionRank:rank}=await import("data:text/javascript;base64,"+Buffer.from(xpJs).toString("base64"));
const fanIds=new Set(Array.from({length:10},(_,i)=>"fan"+i));
const rankPicks=Array.from(fanIds,(id,i)=>({...pick,user_id:id,picked_team_id:i<3?"home":"away"}));
const ranked=rank([...rankPicks,rankPicks[0],{...pick,user_id:"not-fan"}],[game],fanIds,"fan3",now);
assert.equal(ranked.rank,4);
assert.equal(ranked.participants,10);
assert.equal(ranked.correct_picks,0);
assert.equal(rank(rankPicks,[game],fanIds,"fan1",now).rank,1);
assert.equal(rank(rankPicks,[game],fanIds,"absent",now).status,"no-settled-picks");
assert.equal(rank(rankPicks.slice(0,9),[game],fanIds,"fan1",now).rank,null);
assert.equal(rank(rankPicks.slice(0,9),[game],fanIds,"fan1",now).participants,null);
assert.equal(rank(rankPicks.map(p=>({...p,updated_at:"2026-11-01T08:00:00Z"})),[game],fanIds,"fan1",now).status,"insufficient-participation");
assert.doesNotMatch(JSON.stringify(ranked),/fan[0-9]|not-fan/);
assert.match(fanApi,/\.select\("id"\)\.in\("id",users.slice\(i,i\+50\)\)\.eq\("account_type","fan"\)/);
console.log("PASS: private fan rank, ties, minimum cohort and rolling-window filtering.");

// Viewer-local grouping must remain correct on 23- and 25-hour calendar days.
const priorTz = process.env.TZ;
try {
  process.env.TZ = "America/New_York";
  assert.equal(bucket("2026-03-08T12:00:00Z", new Date("2026-03-08T04:30:00Z")), "Tomorrow");
  assert.equal(bucket("2026-11-02T12:00:00Z", new Date("2026-11-01T04:30:00Z")), "Tomorrow");
  assert.equal(bucket("2026-11-01T15:00:00Z", new Date("2026-11-01T04:30:00Z")), "Tonight / Today");
  assert.equal(bucket("2026-11-01T05:00:00Z", new Date("2026-11-01T04:30:00Z")), "Starting within the hour");
  assert.equal(bucket(null, now), "Time unconfirmed");
  assert.equal(formatViewerLocalTime("invalid"), "Tip-off time not confirmed");
  assert.equal(formatViewerLocalTime("2026-11-22T12:00:00Z"), new Date("2026-11-22T12:00:00Z").toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }));
  process.env.TZ = "Asia/Baku";
  assert.equal(bucket("2026-11-22T21:30:00Z", new Date("2026-11-22T18:00:00Z")), "Tomorrow");
} finally {
  if (priorTz === undefined) delete process.env.TZ;
  else process.env.TZ = priorTz;
}
assert.ok(hub.includes("getViewerUpcomingTimeBucket(entry.game.scheduled_at, clock)"));
assert.ok(chat.includes("formatViewerLocalTime(selected.scheduled_at)"));
console.log("PASS: viewer-local fixture time labels and daylight-saving-safe date grouping.");
