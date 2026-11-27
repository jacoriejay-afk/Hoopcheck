import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { contractCountdownDays } from "../src/native/contractCountdown.ts";
test("countdown uses local calendar dates and supports past, today and future",()=>{
 const now=new Date(2026,10,27,23,59);
 assert.equal(contractCountdownDays("2026-11-27",now),0);
 assert.equal(contractCountdownDays("2026-11-28",now),1);
 assert.equal(contractCountdownDays("2026-11-26",now),-1);
 assert.equal(contractCountdownDays("2027-01-01",now),35);
 assert.equal(contractCountdownDays("2028-03-01",new Date(2028,1,28,12)),2);
 assert.equal(contractCountdownDays("2026-03-09",new Date(2026,2,7,23,59)),2);
});
test("malformed dates, invalid leap days and injected text fail closed",()=>{
 for(const date of ["","2026-2-01","2026-02-29","2026-04-31","2026-11-27\n","1899-12-31"]) assert.equal(contractCountdownDays(date,new Date()),null);
 assert.equal(contractCountdownDays("2026-11-27",new Date(NaN)),null);
});
test("countdown is owner and Premium gated, unmounted when inactive and never persisted",()=>{
 const screen=readFileSync(new URL("../app/players/[id].tsx",import.meta.url),"utf8");
 const panel=readFileSync(new URL("../components/PrivateContractCountdown.tsx",import.meta.url),"utf8");
 assert.ok(screen.includes('activeScreen && player.id === viewerId && account?.user.id === viewerId && account.user.accountType === "player" && account.tier === "premium"'));
 assert.ok(screen.includes('<PrivateContractCountdown key={viewerId}'));
 assert.doesNotMatch(panel,/AsyncStorage|localStorage|SecureStore|supabase|fetch\(|ShareSheet/);
});
