import assert from "node:assert/strict";
import { test } from "node:test";
import { nativeDestination, canonicalWebUrl } from "../src/native/deepLinks.ts";
import { privateEvent } from "../src/native/telemetryPrivacy.ts";
import { backgroundRequiresLock, lockAfter, recordFreshSignIn, consumeFreshSignIn, lockScreenRequired } from "../src/native/lockPolicy.ts";

test("session and preference hydration conceal content before app-lock state is known", () => {
  assert.equal(lockScreenRequired(false, false, false, false, false), true);
  assert.equal(lockScreenRequired(true, false, true, false, false), true);
  assert.equal(lockScreenRequired(false, true, true, true, false), true);
  assert.equal(lockScreenRequired(true, true, true, true, true), true);
  assert.equal(lockScreenRequired(true, true, false, true, true), false);
  assert.equal(lockScreenRequired(true, true, true, false, true), false);
  assert.equal(lockScreenRequired(true, true, true, true, false), false);
});

test("app lock waits five minutes and fails closed for invalid restoration state", () => {
  assert.equal(backgroundRequiresLock(1000, 1000 + lockAfter - 1), false);
  assert.equal(backgroundRequiresLock(1000, 1000 + lockAfter), true);
  assert.equal(backgroundRequiresLock(1000, 1000 + lockAfter + 1), true);
  for (const value of [null, NaN, Infinity, 2000]) assert.equal(backgroundRequiresLock(value, 1000), true);
});

test("normal sign-in bypasses restored app lock once, without authorizing later opens", () => {
  recordFreshSignIn(1000);
  assert.equal(consumeFreshSignIn(1001), true);
  assert.equal(consumeFreshSignIn(1002), false);
  recordFreshSignIn(1000);
  assert.equal(consumeFreshSignIn(31000), false);
});

test("native directory/profile links retain their exact entity, including custom scheme", () => {
  for (const type of ["teams", "leagues", "players"]) {
    for (const prefix of ["https://hoopcheck.online", "", "hoopcheck:/"]) {
      assert.equal(nativeDestination(`${prefix}/${type}/abc-123`), `/${type}/abc-123`);
    }
    assert.equal(nativeDestination(`hoopcheck://${type}/abc-123`), `/${type}/abc-123`);
  }
});

test("unimplemented group pages keep canonical web paths", () => {
  for (const path of ["/groups/abc", "/womens/teams/abc"]) {
    assert.equal(nativeDestination(`https://hoopcheck.online${path}`), `/web?path=${encodeURIComponent(path)}`);
  }
});

test("both Lykes referral route spellings preserve the server attribution entry", () => {
  for (const path of ["/r/CHRISLYKES", "/referral/CHRISLYKES", "/r/chrislykes"]) {
    assert.equal(nativeDestination(`https://hoopcheck.online${path}`), "/web?path=%2Freferral%2FCHRISLYKES");
  }
  assert.equal(canonicalWebUrl("/referral/CHRISLYKES"), "https://hoopcheck.online/referral/CHRISLYKES");
});

test("malformed links and external redirects cannot become trusted web destinations", () => {
  for (const path of ["https://evil.example/teams/abc", "https://hoopcheck.online.evil.example/teams/abc", "https://user:password@hoopcheck.online/teams/abc", "http://hoopcheck.online/teams/abc", "https://hoopcheck.online:8443/teams/abc", "javascript:alert(1)", "//evil.example/a"]) {
    assert.equal(nativeDestination(path), "/", path);
  }
  for (const path of ["//evil.example", "https://evil.example", "/\\evil.example"]) assert.equal(canonicalWebUrl(path), null);
});

test("Sentry drops private content even when integrations nest it in unknown fields", () => {
  const secret = "secret@example.com private message review text Bearer token";
  const event = {
    event_id: "a".repeat(32), timestamp: 12, start_timestamp: 11, type: "transaction", transaction: secret,
    contexts: { app: { secret }, trace: { trace_id: "b".repeat(32), span_id: "c".repeat(16), data: { secret } } },
    message: secret, extra: { anything: { secret } }, tags: { secret }, request: { headers: { Authorization: secret } }, user: { email: secret },
    breadcrumbs: [{ message: secret }], spans: [{ description: secret, data: { secret } }],
    exception: { values: [{ value: secret, type: secret, stacktrace: { frames: [{ filename: "https://api.example/review?body=" + secret, function: secret }] } }] },
  };
  const clean = privateEvent(event);
  assert.ok(!JSON.stringify(clean).includes(secret));
  assert.equal(clean.event_id, event.event_id);
  assert.equal(clean.contexts.trace.trace_id, event.contexts.trace.trace_id);
  assert.equal(clean.transaction, undefined);
  assert.deepEqual(clean.spans, []);
  assert.equal(clean.request, undefined);
});

test("Sentry retains allowlisted flow timing and bundled symbolication locations", () => {
  const event = privateEvent({ transaction: "team", timestamp: 12, start_timestamp: 11, type: "transaction", exception: { values: [{ stacktrace: { frames: [{ filename: "app:///index.android.bundle?token=private", lineno: 2, colno: 3 }] } }] } });
  assert.equal(event.transaction, "team");
  assert.equal(event.timestamp - event.start_timestamp, 1);
  assert.equal(event.exception.values[0].stacktrace.frames[0].filename, "app:///index.android.bundle");
  assert.ok(!JSON.stringify(event).includes("private"));
});


test("women's canonical team routes open natively and retain identity", () => {
  for (const prefix of ["https://hoopcheck.online", "hoopcheck:/", ""]) {
    assert.equal(nativeDestination(`${prefix}/womens/abc-123`), "/womens/abc-123");
    assert.equal(nativeDestination(`${prefix}/womens`), "/womens");
    assert.equal(nativeDestination(`${prefix}/womens/leagues/abc-123`), "/womens/leagues/abc-123");
  }
  assert.equal(nativeDestination("hoopcheck://womens/abc-123"), "/womens/abc-123");
  assert.equal(nativeDestination("https://evil.example/womens/abc-123"), "/");
});


test("native feed share URLs preserve exact posts and legacy fan feed resolves to HoopFeed", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  assert.equal(nativeDestination(`https://hoopcheck.online/feed#post-${id}`), `/feed?post=${id}`);
  assert.equal(nativeDestination(`hoopcheck://feed?post=${id}`), `/feed?post=${id}`);
  assert.equal(nativeDestination(`https://hoopcheck.online/fan-feed?post=${id}`), `/feed?post=${id}`);
  assert.equal(nativeDestination("https://hoopcheck.online/feed?post=invalid"), "/feed");
  assert.equal(nativeDestination("https://hoopcheck.online/reels"), "/reels");
});

test("native PKCE callbacks preserve the code instead of opening the website", () => {
  for (const prefix of ["hoopcheck://auth", "hoopcheck:///auth", "https://hoopcheck.online/auth", "/auth"]) {
    assert.equal(nativeDestination(`${prefix}/callback?code=fixture-code`), "/auth/callback?code=fixture-code");
  }
  assert.equal(nativeDestination("https://evil.example/auth/callback?code=fixture"), "/");
  assert.equal(nativeDestination("hoopcheck://auth/callback?code=fixture&redirect=https://evil.example"), "/auth/callback?code=fixture");
});

test("auth errors and malformed escapes are safely re-encoded and oversized links fail closed", () => {
  assert.equal(nativeDestination("hoopcheck://auth/callback?error_description=Denied%20access"), "/auth/callback?error_description=Denied+access");
  const destination = nativeDestination("hoopcheck://auth/callback?code=%ZZ");
  assert.equal(destination, "/auth/callback?code=%25ZZ");
  assert.doesNotThrow(() => decodeURIComponent(destination.split("code=")[1]));
  assert.equal(nativeDestination("hoopcheck://auth/callback?code=" + "x".repeat(9000)), "/");
  assert.equal(nativeDestination("hoopcheck://reset-password?code=fixture-code"), "/reset-password?code=fixture-code");
});


test("Live Games links preserve the canonical game and reject malformed IDs", () => {
  const id = "11111111-1111-4111-8111-000000000001";
  assert.equal(nativeDestination(`hoopcheck://fan-live?gameId=${id}`), `/fan-live?gameId=${id}`);
  assert.equal(nativeDestination("/fan-live?gameId=../secret"), "/fan-live");
});


test("club group canonical links retain group identity and malformed alternatives use the website", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  assert.equal(nativeDestination(`hoopcheck://team-hub/groups/${id}`), `/team-hub/groups/${id}`);
  assert.equal(nativeDestination("/team-hub/groups"), "/team-hub/groups");
  assert.equal(nativeDestination("/groups/other"), "/web?path=%2Fgroups%2Fother");
});

test("search links bound and safely re-encode terms for native routing", () => {
  assert.equal(nativeDestination("hoopcheck://search?q=%ZZ&token=discard"), "/search?q=%25ZZ");
  assert.equal(nativeDestination("/search?q=" + "x".repeat(200)), "/search?q=" + "x".repeat(100));
});


test("own profile customization uses a canonical native account route", () => {
  assert.equal(nativeDestination("hoopcheck://account/edit"), "/account/edit");
});

test("canonical homepage and empty app links reach native entry without a web handoff", () => {
  for (const url of ["/", "https://hoopcheck.online/", "hoopcheck://", "hoopcheck:///"]) assert.equal(nativeDestination(url), "/");
  assert.equal(nativeDestination("https://hoopcheck.online/?token=discard"), "/");

});
