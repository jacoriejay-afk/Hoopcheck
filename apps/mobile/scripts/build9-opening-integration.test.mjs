import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Native startup retains Build 9 role hub destinations, authentication and the splash watchdog", () => {
  const root = read("app/_layout.tsx");
  for (const screen of ["messages", "feed-welcome", "hoopgroups", "dashboard", "sign-in", "reset-password", "auth/callback"]) {
    assert.ok(root.includes('<Stack.Screen name="' + screen + '"'), "Missing route: " + screen);
  }
  assert.match(root, /"messages", "feed-welcome", "hoopgroups"/);
  assert.match(root, /createSessionBootstrap/);
  assert.match(root, /AppLock authReady=\{sessionReady\}/);
  assert.match(root, /rememberDestination/);
  assert.match(root, /takeDestination/);
  assert.match(root, /SplashScreen\.hideAsync/);
  assert.match(root, /AppOpening ready=\{sessionReady && \(fontsLoaded \|\| Boolean\(fontError\)\)\}/);
  assert.match(root, /disabled=\{\["auth", "reset-password"\]\.includes/);
  assert.ok(root.indexOf("<AppOpening ready=") > root.indexOf("<AppLock authReady="),
    "The opening must not gate AppLock or navigator mounting");
});

test("Interrupted opening never strands the user behind a non-interactive overlay", () => {
  const opening = read("components/AppOpening.tsx");
  assert.match(opening, /hasPlayedColdOpen/);
  // OAuth callback/recovery interruption must not replay and block touches again.
  assert.match(opening, /\(!ready \|\| disabled\) && hasPlayedColdOpen/);
  assert.match(opening, /aborted\.current = true/);
  assert.match(opening, /finished \|\| aborted\.current/);
  assert.match(opening, /started\.current = false;/);
  assert.match(opening, /!ready \|\| disabled \|\| finished \|\| started\.current/);
  assert.match(opening, /timeouts\.current\.forEach\(clearTimeout\)/);
  assert.match(opening, /cancelAnimation\(progress\)/);
  assert.match(opening, /Platform\.OS === "web"/);
  assert.match(opening, /useMotionSetting/);
  assert.match(opening, /Skip opening animation/);
  assert.match(opening, /reduced \? 70 : 760/);
});

test("Rebranded authentication preserves PKCE, deep links and account-bound sessions", () => {
  const login = read("app/sign-in.tsx");
  for (const invariant of ["signInWithPassword", "signInWithOAuth", "skipBrowserRedirect: true",
    "recordFreshSignIn", "takeDestination", "secureTextEntry={!showPassword}", "ArenaBrand"]) {
    assert.ok(login.includes(invariant), "Missing auth invariant: " + invariant);
  }
  assert.match(read("app/forgot-password.tsx"), /resetPasswordForEmail/);
  assert.match(read("app/reset-password.tsx"), /exchangeCodeForSession/);
  const signup = read("app/sign-up.tsx");
  for (const invariant of ["validBirthdate", "accepted", "supabase.auth.signUp"]) {
    assert.ok(signup.includes(invariant), "Missing signup invariant: " + invariant);
  }
});
