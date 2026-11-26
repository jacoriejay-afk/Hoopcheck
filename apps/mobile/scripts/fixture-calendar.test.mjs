import test from "node:test";
import assert from "node:assert/strict";
import {fixtureCalendarFile} from "../src/native/fixtureCalendar.ts";
const now=Date.parse("2026-11-26T12:00:00Z");
const fixture={id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",status:"scheduled",scheduledAt:"2026-11-27T20:00:00+04:00",home:"Home, Club",away:"Away; Club",side:"mens"};
test("calendar contains timezone-correct start and never invents an end",()=>{
 const s=fixtureCalendarFile(fixture,now);assert.match(s,/DTSTART:20261127T160000Z\r\n/);assert.match(s,/UID:mens-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa@hoopcheck.online/);assert.ok(s.includes("SUMMARY:Home\\, Club vs Away\\; Club"));assert.doesNotMatch(s,/DTEND:|DURATION:/);
});
test("rejects non-upcoming, ambiguous times, invalid IDs and unknown opponents",()=>{
 for(const x of [{status:"postponed"},{status:"live"},{scheduledAt:"2026-11-27T20:00:00"},{scheduledAt:"2026-11-25T20:00:00Z"},{scheduledAt:"2027-01-01T00:00:00Z"},{id:"bad"},{home:""}])assert.equal(fixtureCalendarFile({...fixture,...x},now),null);
});
test("escapes injection and folds UTF-8 lines",()=>{
 const s=fixtureCalendarFile({...fixture,home:"Ž".repeat(120)+"\nATTENDEE:evil"},now);
 assert.ok(!s.includes("\r\nATTENDEE:"));
 for(const line of s.split("\r\n"))assert.ok(Buffer.byteLength(line,"utf8")<=75);
});
