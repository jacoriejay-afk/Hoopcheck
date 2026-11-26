import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
test("all nine icon choices are synchronized with native registration and preserve original artwork", () => {
  const ui = read("../components/AlternateIcons.tsx"), swift = read("../modules/hoopcheck-icons/ios/HoopcheckIconsModule.swift"), plugin = read("../plugins/withAlternateIcons.cjs");
  const names = [...ui.matchAll(/name: "([A-Za-z]+)", label:/g)].map(m => m[1]);
  assert.deepEqual(names, ["Classic","Blackout","Orange","Whiteout","Gold","Chrome","ElectricBlue","Stealth","Court"]);
  for (const name of names) { assert.ok(swift.includes('"'+name+'"')); if(name !== "Classic") assert.ok(plugin.includes('"'+name+'"')); }
  assert.ok(plugin.includes('assets", "app-icon.png"'));
  assert.ok(plugin.includes('Object.keys(icons).join(" ")'));
});
test("startup reuses branded loader while keeping recovery and authentication", () => {
  const lock = read("../components/AppLock.tsx");
  assert.ok(lock.includes('<HoopCheckLoading label="Preparing HoopCheck…" />'));
  for (const marker of ["MfaChallenge", "retryStartup?.()", "retryRestore()", "security.retry()", "normalSignIn()", "lockScreenRequired("]) assert.ok(lock.includes(marker));
});
test("related routes select the proper navigation destination", () => {
  const tab = read("../components/TabBar.tsx");
  for (const marker of ["feed-welcome|hoopgroups", "settings|membership|connections|about", 'path === "/fan-live" ? 0', "account ? 4", "keyboardVisible", "useSafeAreaInsets"]) assert.ok(tab.includes(marker));
});

test("motion is bounded and icon previews use the original asset", () => {
  const loader = read("../components/HoopCheckLoading.tsx"), tab = read("../components/TabBar.tsx"), ui = read("../components/AlternateIcons.tsx"), plugin = read("../plugins/withAlternateIcons.cjs");
  assert.ok(loader.includes("animated={foreground && !reduced}"));
  assert.ok(loader.includes("cancelAnimation(phase)"));
  assert.ok(tab.includes("cancelAnimation(scale); cancelAnimation(lift);"));
  assert.ok(tab.includes("if (reduced) { x.set(next); opacity.set(1); }"));
  assert.ok(ui.includes('require("../assets/app-icon.png")'));
  assert.ok(ui.includes("reduced ? undefined : FadeIn.duration(motion.fade)"));
  assert.ok(plugin.includes('JSON.stringify(Object.keys(icons).join(" "))'));
});

test("onboarding uses the existing reduced-motion-aware brand reveal", () => {
  assert.ok(read("../components/Onboarding.tsx").includes("<BrandLogo animated />"));
  assert.ok(read("../components/BrandLockup.tsx").includes("animated && !reduced"));
});
