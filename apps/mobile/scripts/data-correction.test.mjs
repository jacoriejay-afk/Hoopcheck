import test from "node:test";
import assert from "node:assert/strict";
import {correctionTicket,correctionSubject} from "../src/native/dataCorrection.ts";
const base={kind:"teams",entityId:"AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",field:"name",correction:"Official club name is Example Club.",source:"https://example.invalid/club"};
test("correction ticket uses existing private queue and canonical record URL",()=>{
 const ticket=correctionTicket(base);assert.equal(ticket.subject,correctionSubject);assert.equal(ticket.category,"team_request");assert.equal(ticket.priority,"normal");assert.match(ticket.description,/https:\/\/hoopcheck\.online\/teams\/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/);assert.match(ticket.description,/https:\/\/example\.invalid\/club/);
});
test("invalid records, short descriptions, secret URLs and unsupported fields are rejected",()=>{
 for(const x of [{kind:"../account"},{entityId:"bad"},{field:"password"},{correction:"bad"},{source:"http://example.invalid"},{source:"https://a:b@example.invalid"},{source:"https://example.invalid/path?token=abc"},{source:"https://example.invalid/#private"}])assert.equal(correctionTicket({...base,...x}),null);
 assert.match(correctionTicket({...base,source:""}).description,/Not supplied/);
});
