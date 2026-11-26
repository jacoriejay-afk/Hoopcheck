import assert from "node:assert/strict";
import {test} from "node:test";
import {parseGroupInvite,findInvitedGroup,nativeDestination} from "../src/native/deepLinks.ts";
import {readFileSync} from "node:fs";
test("group invitation hints reject injection and cannot select invisible groups",()=>{
 const visible=[{id:"first",slug:"global-hoops"},{id:"second",slug:"players-court"}];
 assert.equal(parseGroupInvite("players-court"),"players-court");
 for(const value of ["../account","a?token=x","https://evil.test","a".repeat(61),["global-hoops"],null])assert.equal(parseGroupInvite(value),null);
 assert.equal(findInvitedGroup(visible,"players-court"),visible[1]);
 assert.equal(findInvitedGroup(visible,"private-group"),null);
});
test("native invitation route selects only an authorized visible group and preserves membership checks",()=>{
 const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
 const link=read("../src/native/deepLinks.ts"),screen=read("../app/hoopgroups.tsx"),component=read("../components/HoopGroupsChannels.tsx");
 assert.match(link,/parseGroupInvite\(url\.searchParams\.get\("group"\)\)/);
 assert.match(screen,/<HoopGroupsChannels inviteSlug=\{inviteSlug\}/);
 assert.match(component,/findInvitedGroup\(spaces,inviteSlug\)/);
 assert.match(component,/const member=Boolean\(selected&&joined\.includes\(selected\.id\)\)/);
 assert.match(component,/if\(!userId\|\|offline\|\|!member\|\|!channel\?\.id\)/);
});

test("group share links open the native route and invalid hints are discarded",()=>{
 assert.equal(nativeDestination("https://hoopcheck.online/hoopgroups?group=players-court"),"/hoopgroups?group=players-court");
 assert.equal(nativeDestination("hoopcheck://hoopgroups?group=global-hoops"),"/hoopgroups?group=global-hoops");
 assert.equal(nativeDestination("/hoopgroups?group=../account"),"/hoopgroups");
 assert.equal(nativeDestination("https://evil.test/hoopgroups?group=global-hoops"),"/");
});

import {rememberDestination,takeDestination} from "../src/native/pendingDestination.ts";
test("native and sign-in navigation preserve only safe game side, alerts tab and visible group hints",()=>{
 const id="11111111-1111-4111-8111-111111111111";
 for(const [input,expected] of [[`/fan-live?gameId=${id}&side=womens&token=secret`,`/fan-live?gameId=${id}&side=womens`],["/hoopgroups?group=global-hoops&token=secret","/hoopgroups?group=global-hoops"],["/notifications?tab=requests&token=secret","/notifications?tab=requests"],["/connections","/connections"],["/fan-live?side=bad","/fan-live"]]){
 assert.equal(nativeDestination(input),expected);rememberDestination(input);assert.equal(takeDestination(),expected);assert.equal(takeDestination(),null);
 }
});

test("coach and support screens have canonical native routes and safe sign-in return",()=>{
 assert.equal(nativeDestination("/coaches/coach-123"),"/coaches/coach-123");
 assert.equal(nativeDestination("/account/support?topic=scam&token=secret"),"/account/support?topic=scam");
 rememberDestination("/account/support?topic=scam&token=secret");assert.equal(takeDestination(),"/account/support?topic=scam");
});
