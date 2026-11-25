import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const read = file => readFileSync(new URL("../" + file, import.meta.url), "utf8");
const compiled = ts.transpileModule(read("lib/game-availability.ts"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const availability = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
const { getGameAvailability, GAME_CHAT_OPEN_EARLY_MINUTES, GAME_CHAT_POST_GAME_MINUTES } = availability;
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
assert.ok(scoreWorkflow.includes('- cron: "7,22,37,52 * * * *"'),"Provider sync stays at four off-peak checks per hour");
assert.ok(!scoreWorkflow.includes("*/5 ") && !scoreWorkflow.includes("*/1 "),"Never overspend the free-tier provider request budget");

const sql=read("supabase/candidates/live_game_chat_realtime_directory_review_only.sql");
assert.match(sql,/REVIEW ONLY/);
assert.match(sql,/current_user_has_live_game_membership\(\)/,"Room history must remain membership gated");
assert.match(sql,/fan_live_chat_user_controls/,"Blocked-user privacy must remain enforced");
assert.match(sql,/interval '2 hours'/,"Database room window must agree with UI");
assert.match(sql,/fan_live_chat_room_open/,"Postgres room guard must remain the authority");
assert.doesNotMatch(sql,/grant\s+(?:all|insert|update)\s+on\s+public\.fan_live_chat_messages\s+to\s+anon/i,"Never expose anonymous writes");
console.log("PASS: Persistent live room directory, membership gates, realtime recovery and final +2h window.");

assert.match(chat,/formatPregameCountdown\(selected.status,selected.scheduled_at,clock\)/,"Dedicated rooms use the same scheduled-tip countdown as the hub");
assert.match(chat,/select\("user_id",\{count:"exact",head:true\}\)/,"Presence reads an exact server-side count without downloading identities");
assert.match(chat,/presenceSample.gameId===selected\?\.id/,"Room counts cannot carry over to another game");
assert.match(chat,/clock.getTime\(\)-presenceSample.observedAt<75_000/,"Expired participation samples must not be displayed");
assert.match(chat,/presenceCount===null\?"Live participation unavailable"/,"Unknown participation must not appear as a fabricated zero");
assert.match(chat,/canSend&&selectedStatus&&!selectedStatus.isUnverified&&availability\?\.chatOpen&&\(!selectedStatus.isVerifiedFinal\|\|process.env.NEXT_PUBLIC_LIVE_POSTGAME_CHAT_ENABLED==="true"\)/,"New room panel honors authoritative room access and the postgame rollout flag");
assert.match(chat,/not arena attendance/,"Online room participation must not claim physical attendance");
console.log("PASS: countdown, room participation freshness, and game-day lobby gates.");
