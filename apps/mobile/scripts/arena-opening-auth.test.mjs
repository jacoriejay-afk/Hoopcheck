import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("native cold open is skippable, bounded and preserves the existing splash watchdog", () => {
  const opening=read("../components/AppOpening.tsx");
  const root=read("../app/_layout.tsx");
  const motion=read("../src/motion/config.ts");
  assert.match(opening, /hasPlayedColdOpen/);
  assert.doesNotMatch(opening, /started\\.current/);
  assert.match(opening, /\[interrupted, setInterrupted\]/);
  assert.match(opening, /setInterrupted\(true\)/);
  assert.match(opening, /finished \|\| interrupted/);
  assert.match(opening, /Skip opening animation/);
  assert.match(opening, /Platform\.OS === "web"/);
  assert.match(opening, /useMotionSetting/);
  assert.match(opening, /reduced \? 70 : 760/);
  assert.match(opening, /setTimeout\(\(\) => setFinished\(true\), reduced \? 0 : 160/);
  assert.match(root, /AppOpening/);
  assert.match(root, /sessionReady && \(fontsLoaded \|\| Boolean\(fontError\)\)/);
  assert.match(root, /createSessionBootstrap/);
  assert.match(root, /SplashScreen\.hideAsync/);
  assert.match(motion, /splashDeadline: 1500/);
});

test("login animation preserves Google OAuth, reset, destination and account-security flows", () => {
  const login=read("../app/sign-in.tsx");
  assert.match(login, /signInWithPassword/);
  assert.match(login, /signInWithOAuth/);
  assert.match(login, /provider: "google"/);
  assert.match(login, /skipBrowserRedirect: true/);
  assert.match(login, /recordFreshSignIn/);
  assert.match(login, /takeDestination/);
  assert.match(login, /\/forgot-password/);
  assert.match(login, /secureTextEntry=\{!showPassword\}/);
  assert.match(login, /accessibilityLabel="Email"/);
  assert.match(login, /accessibilityLabel="Password"/);
  assert.match(login, /accessibilityLabel="Continue with Google"/);
  assert.match(login, /disabled=\{busy\}/);
  assert.match(login, /useMotionSetting/);
  assert.match(login, /ArenaBrand/);
});

test("full sign-up and recovery contracts remain intact under new branding", () => {
  const signup=read("../app/sign-up.tsx");
  const recover=read("../app/forgot-password.tsx");
  const reset=read("../app/reset-password.tsx");
  assert.match(signup, /ACCOUNT_TYPES/);
  assert.match(signup, /validBirthdate/);
  assert.match(signup, /accepted/);
  assert.match(signup, /supabase\.auth\.signUp/);
  assert.match(recover, /resetPasswordForEmail/);
  assert.match(reset, /exchangeCodeForSession/);
  assert.match(reset, /updateUser/);
  for(const src of [signup,recover,reset]) assert.match(src,/ArenaBrand/);
});
