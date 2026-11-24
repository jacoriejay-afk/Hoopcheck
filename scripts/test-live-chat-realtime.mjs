import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const read = file => readFileSync(new URL("../" + file, import.meta.url), "utf8");
const compiled = ts.transpileModule(read("lib/game-availability.ts"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const availability = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
const { getGameAvailability, isGameChatOpen, GAME_CHAT_OPEN_EARLY_MINUTES, GAME_CHAT_POST_GAME_MINUTES } = availability;
const game = {
  status:"scheduled",
  scheduledAt:"2026-11-22T12:00:00Z",
  startedAt:"2026-11-22T12:00:00Z",
  endsAt:null,
};
assert.equal(GAME_CHAT_OPEN_EARLY_MINUTES, 60);
assert.equal(GAME_CHAT_POST_GAME_MINUTES, 120);
assert.equal(getGameAvailability({...game,now:new Date("2026-11-22T10:59:00Z")}).chatOpen,false);
assert.equal(getGameAvailability({...game,now:new Date("2026-11-22T11:00:00Z")}).chatOpen,true);
assert.equal(getGameAvailability({...game,status:"live",now:new Date("2026-11-22T12:20:00Z")}).chatOpen,true);
const final={...game,status:"final",endsAt:"2026-11-22T14:05:00Z"};
assert.equal(getGameAvailability({...final,now:new Date("2026-11-22T15:00:00Z")}).phase,"post-game");
assert.equal(getGameAvailability({...final,now:new Date("2026-11-22T15:00:00Z")}).state,"POST GAME","A final result must never appear as a live game");
assert.equal(getGameAvailability({...final,now:new Date("2026-11-22T16:04:59Z")}).chatOpen,true);
assert.equal(getGameAvailability({...final,now:new Date("2026-11-22T16:05:00Z")}).chatOpen,false);
assert.equal(isGameChatOpen({...game,status:"live",now:new Date("2026-11-22T12:20:00Z")},false),true,
  "Live game chat must remain available before the postgame rollout");
assert.equal(isGameChatOpen({...final,now:new Date("2026-11-22T15:00:00Z")},false),false,
  "Verified final must stay read-only when postgame SQL is review-only and the feature flag is OFF");
assert.equal(isGameChatOpen({...final,now:new Date("2026-11-22T15:00:00Z")},true),true,
  "Explicit flag may open postgame phase only after separate SQL/RLS approval");
assert.equal(isGameChatOpen({...game,status:"final",now:new Date("2026-11-22T15:00:00Z")},true),false,
  "A final without provider-confirmed end timestamp must never open");
assert.equal(isGameChatOpen({...final,now:new Date("2026-11-22T16:05:00Z")},true),false,
  "Approved postgame chat still closes exactly two hours after final");

assert.equal(getGameAvailability({...game,status:"final",now:new Date("2026-11-22T14:20:00Z")}).chatOpen,false,"Never fabricate a final timestamp");
assert.equal(getGameAvailability({...final,status:"cancelled",now:new Date("2026-11-22T15:00:00Z")}).chatOpen,false);

const chat=read("app/fan-live/page.tsx");
assert.match(chat,/\.eq\("id",roomId\)\.maybeSingle\(\)/,"Dedicated deep link must query exact persisted game, not only recent directory rows");
assert.match(chat,/\.on\("postgres_changes",\{event:"\*",schema:"public",table:"fan_live_games"\}/,"Provider commits must fan out to open directory");
assert.match(chat,/table:"fan_live_chat_messages"/,"Messages must arrive on their game-scoped Realtime channel");
assert.match(chat,/void loadMessages\(gameId\)/,"Persisted message history must recover after websocket interruption");
assert.match(chat,/fan_live_chat_presence/,"Directory occupancy must be read from database-backed presence");
assert.match(chat,/roomPresenceCounts\[game.id\]/,"Directory must show actual room occupancy");
assert.match(chat,/serverRoomOpen\?\.gameId!==selected.id/,"Postgres authorization guard must decide whether users can send");
assert.match(chat,/NEXT_PUBLIC_LIVE_POSTGAME_CHAT_ENABLED==="true"/,"Postgame JOIN must stay off until reviewed database rollout");
assert.match(chat,/const isClosed=availability\?\.state==="CLOSED" \|\| \(availability\?\.phase==="post-game" && !POSTGAME_CHAT_ENABLED\)/,
  "Finished rooms must display a closed state while postgame flag is off");
assert.match(chat,/!roomOpen\(selected,clock\)\)\{setServerRoomOpen\(null\)/,
  "Disabled postgame rooms must not probe the server for writable chat access");

assert.match(chat,/JOIN CHAT/,"Directory must clearly offer join action");

const hub=read("app/live-games/page.tsx");
assert.match(hub,/VIEW ROOM/,"Live game directory must link to dedicated rooms even before opening or after close");
assert.match(hub,/NEXT_PUBLIC_LIVE_POSTGAME_CHAT_ENABLED === "true"/,"Live hub must not advertise unactivated postgame chat");
assert.match(hub,/fan-live\/room/,"Hub must open persisted game-specific chats");
const cron=read("app/api/cron/live-basketball/route.ts");
assert.match(cron,/finalStatuses.has\(providerStatus\) \? "final"/,"Final status must come from provider, never a clock");
assert.match(cron,/endingByProviderId\.get\(row\.provider_game_id\) \|\| confirmedAt/,"Re-polling finals must preserve first confirmed end time");
assert.doesNotMatch(cron,/update\(\{\s*status:\s*["']final["']\s*\}\)/,"No fabricated final statuses");

const scoreWorkflow=read(".github/workflows/live-basketball-score-sync.yml");
// Count actual unique daily slots, not the spelling of the old cron expression.
const schedules = [...scoreWorkflow.matchAll(/- cron: "([^"]+)"/g)].map(m => m[1]);
function values(field, max) {
  if (field === "*") return Array.from({length:max+1}, (_,i)=>i);
  return field.split(",").flatMap(part => {
    assert.match(part, /^\d+(?:-\d+)?$/, "Only explicit bounded daily slots");
    const [first,last=first] = part.split("-").map(Number);
    assert.ok(first >= 0 && last <= max && first <= last);
    return Array.from({length:last-first+1}, (_,i)=>first+i);
  });
}
const slots = new Set();
for (const schedule of schedules) {
  const [mins,hours,...days]=schedule.split(" ");
  assert.deepEqual(days, ["*","*","*"]);
  for (const h of values(hours,23)) for (const m of values(mins,59)) {
    const slot=h*60+m;
    assert.ok(!slots.has(slot), "No duplicate provider calls");
    slots.add(slot);
  }
}
assert.equal(slots.size,99,"99 scheduled requests preserves one free-tier request of headroom");
for(let hour=0;hour<24;hour++) for(const minute of [7,22,37,52])
  assert.ok(slots.has(hour*60+minute),"Maintain regular off-peak refresh slots");
assert.match(scoreWorkflow, /"7 0 \* \* \*"\) offset=-1/,"Reconcile yesterday without exceeding quota");
assert.match(scoreWorkflow, /"12 3 \* \* \*"\) offset=1/,"Preload tomorrow");
assert.match(scoreWorkflow, /date_offset=\$offset/,"Send requested calendar offset");

const sql=read("supabase/candidates/live_game_chat_realtime_directory_review_only.sql");
assert.match(sql,/REVIEW ONLY/);
assert.match(sql,/current_user_has_live_game_membership\(\)/,"Room history must remain membership gated");
assert.match(sql,/fan_live_chat_user_controls/,"Blocked-user privacy must remain enforced");
assert.match(sql,/interval '2 hours'/,"Database room window must agree with UI");
assert.match(sql,/fan_live_chat_room_open/,"Postgres room guard must remain the authority");
assert.doesNotMatch(sql,/grant\s+(?:all|insert|update)\s+on\s+public\.fan_live_chat_messages\s+to\s+anon/i,"Never expose anonymous writes");
console.log("PASS: Persistent live room directory, membership gates, realtime recovery and final +2h window.");
