import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {exitReasons,membershipExitTicket} from "../src/native/membershipExitFeedback.ts";
test("only bounded reasons are accepted and no cancellation command is created",()=>{
 for(const r of exitReasons){const ticket=membershipExitTicket(r.id);assert.equal(ticket.category,"billing");assert.match(ticket.description,/not a cancellation request/);assert.deepEqual(Object.keys(ticket).sort(),["category","description","priority","subject"]);}
 for(const x of [null,"cancel",{}, "arbitrary text"])assert.equal(membershipExitTicket(x),null);
});
test("optional consent and existing membership controls remain independent",()=>{
 const web=readFileSync(new URL("../../../components/MembershipExitFeedback.tsx",import.meta.url),"utf8"),native=readFileSync(new URL("../components/MembershipExitFeedback.tsx",import.meta.url),"utf8");
 for(const s of [web,native]){assert.match(s,/!consent/);assert.match(s,/not anonymous/);assert.match(s,/support_tickets/);assert.doesNotMatch(s,/cancel-subscription|store\.manage|billingAction/);}
 const webPage=readFileSync(new URL("../../../app/membership/page.tsx",import.meta.url),"utf8"),nativePage=readFileSync(new URL("../app/membership.tsx",import.meta.url),"utf8");
 assert.ok(webPage.indexOf("Cancel Membership")<webPage.indexOf("<MembershipExitFeedback"));assert.ok(nativePage.indexOf("Manage Apple subscription")<nativePage.indexOf("<MembershipExitFeedback"));
});
