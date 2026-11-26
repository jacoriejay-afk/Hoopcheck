import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { nativeDestination } from "../src/native/deepLinks.ts";
import { rememberDestination, takeDestination } from "../src/native/pendingDestination.ts";

test("existing native destinations do not fall through to website", () => {
  const routes = ["/dashboard","/feed","/search","/notifications","/account","/messages","/feed-welcome","/about","/sign-in","/sign-up","/forgot-password","/choose-username","/account/career-history","/account/owner-hq","/account/ambassador-hq","/account/network","/teams/team-1/review","/team-hub/groups/team-1","/womens/leagues/league-1"];
  for (const path of routes) {
    assert.equal(nativeDestination(path), path);
    assert.equal(nativeDestination("https://hoopcheck.online"+path), path);
  }
  assert.equal(nativeDestination("hoopcheck://messages"), "/messages");
  assert.equal(nativeDestination("/agents"), "/account/network?kind=agents");
  assert.equal(nativeDestination("/creators"), "/account/network?kind=creators");
  assert.equal(nativeDestination("/account/network?kind=safety&token=private"), "/account/network?kind=safety");
  assert.equal(nativeDestination("/owner-hq"), "/account/owner-hq");
  assert.equal(nativeDestination("/ambassador-hq"), "/account/ambassador-hq");
  assert.equal(nativeDestination("https://evil.test/messages"), "/");
  assert.equal(nativeDestination("/referral/TEST"), "/web?path=%2Freferral%2FTEST");
  assert.equal(nativeDestination("/privacy"), "/web?path=%2Fprivacy");
});
test("sign-in return path admits existing protected screens only", () => {
  for (const path of ["/messages","/feed-welcome","/account/network?kind=creators","/account/owner-hq","/account/career-history","/teams/team-1/review","/team-hub/groups/team-1","/choose-username"]) {
    rememberDestination(path);
    assert.equal(takeDestination(),path);
    assert.equal(takeDestination(),null);
  }
  for (const path of ["/account/does-not-exist","/feed/missing","/teams/a/missing","/messages/unknown","//evil.test","/web?path=/account","/sign-in","/account/%2f"]) {
    rememberDestination(path);assert.equal(takeDestination(),null,path);
  }
  rememberDestination("/account/network?kind=safety&token=private");
  assert.equal(takeDestination(),"/account/network?kind=safety");
});
test("five main tabs resolve to file-based screens and unmatched screens recover natively",()=>{
  for (const name of ["dashboard","feed","search","notifications","account"]) assert.ok(existsSync(new URL("../app/"+name+".tsx",import.meta.url)));
  const fallback=readFileSync(new URL("../app/+not-found.tsx",import.meta.url),"utf8");
  assert.match(fallback,/router\.replace\("\/"\)/);
  assert.doesNotMatch(fallback,/WebBrowser|openURL|fetch\(/);
});

test("plain legacy website paths map to native routes without consuming auth or referral parameters",()=> {
  assert.equal(nativeDestination("/login"),"/sign-in");
  assert.equal(nativeDestination("/signup"),"/sign-up");
  assert.equal(nativeDestination("/feed/welcome"),"/feed-welcome");
  assert.equal(nativeDestination("/live-games?side=womens"),"/fan-live?side=womens");
  assert.equal(nativeDestination("/signup?ref=TEST"),"/web?path=%2Fsignup%3Fref%3DTEST");
});
