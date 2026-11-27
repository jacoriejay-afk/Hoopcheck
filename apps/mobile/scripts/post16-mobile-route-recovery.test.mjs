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
  assert.equal(nativeDestination("/referral/TEST"), "/link-unavailable");
  assert.equal(nativeDestination("/privacy"), "/account/policies?kind=privacy");
});
test("sign-in return path admits existing protected screens only", () => {
  for (const path of ["/messages","/feed-welcome","/account/network?kind=creators","/account/owner-hq","/account/career-history","/account/privacy-center","/teams/team-1/review","/team-hub/groups/team-1","/choose-username"]) {
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
  assert.equal(nativeDestination("/signup?ref=TEST"),"/link-unavailable");
});

test("merged native policy and support screens use canonical native destinations",()=>{
  assert.ok(existsSync(new URL("../app/account/policies.tsx",import.meta.url)));
  assert.equal(nativeDestination("/terms"),"/account/policies?kind=terms");
  assert.equal(nativeDestination("/account/policies?kind=terms&token=fixture"),"/account/policies?kind=terms");
  assert.equal(nativeDestination("/support?topic=scam"),"/account/support?topic=scam");
  rememberDestination("/account/policies?kind=terms&token=fixture");
  assert.equal(takeDestination(),"/account/policies?kind=terms");
  const home=readFileSync(new URL("../app/dashboard.tsx",import.meta.url),"utf8");
  assert.match(home,/pathname: "\/account\/policies"/);
  assert.match(home,/router\.push\("\/account\/support"\)/);
  assert.doesNotMatch(home,/Linking\.openURL/);
  const layout=readFileSync(new URL("../app/_layout.tsx",import.meta.url),"utf8");
  assert.match(layout,/pathname === "\/account\/policies"\) return;/);
  assert.match(layout,/!signedIn && \(inAppArea \|\| designProtected\)/);
});

test("specialized support links retain only the validated topic through sign-in", () => {
  for (const [query, topic] of [
    ["scamAlert", "scam"], ["membershipCancellation", "billing"],
    ["accountCompromised", "compromised"], ["agentVerification", "verification"],
  ]) {
    const route = "/account/support?topic=" + topic;
    assert.equal(nativeDestination("/support?" + query + "=1&token=secret"), route);
    rememberDestination(route + "&token=secret");
    assert.equal(takeDestination(), route);
  }
  assert.equal(nativeDestination("/copyright"), "/account/support?topic=copyright");
});
