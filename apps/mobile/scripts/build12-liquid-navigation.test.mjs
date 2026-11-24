import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("native glass navigation is clear without opaque overlays, preserving card styling", () => {
  const glass = read("../components/GlassSurface.tsx");
  assert.match(glass, /navigation = false/);
  assert.match(glass, /backgroundColor: opaque \? theme\.surface : navigation \? "transparent" : theme\.glassFill/);
  assert.match(glass, /glassEffectStyle=\{navigation \? "clear" : "regular"\}/);
  assert.match(glass, /!navigation \? <LinearGradient/);
  assert.match(glass, /const opaque = solid \|\| reduceTransparency \|\| Platform\.OS !== "ios"/);
  assert.match(glass, /isGlassEffectAPIAvailable\(\) && isLiquidGlassAvailable\(\)/);
  assert.match(glass, /<BlurView pointerEvents="none" accessible=\{false\}/);
});

test("bottom floating navigation supports iOS clear glass and BlurView with reduced transparency fallback", () => {
  const tabs = read("../components/TabBar.tsx");
  assert.match(tabs, /backgroundColor: translucent \? "transparent" : theme\.surface/);
  assert.match(tabs, /glassEffectStyle="clear"/);
  assert.doesNotMatch(tabs, /colorScheme=/);
  assert.doesNotMatch(tabs, /LinearGradient/);
  assert.match(tabs, /AccessibilityInfo\.isReduceTransparencyEnabled\(\)/);
  assert.match(tabs, /const translucent = Platform\.OS === "ios" && !reduceTransparency/);
  assert.match(tabs, /marginBottom: Math\.max\(9, insets\.bottom\)/);
  assert.match(tabs, /<View \{\.\.\.slide\.panHandlers\} accessibilityRole="tablist"/);
});

test("Home safe-area header uses transparent navigation chrome with low-opacity highlights", () => {
  const home = read("../app/dashboard.tsx");
  assert.match(home, /<GlassSurface navigation style=/);
  assert.match(home, /rgba\(255,255,255,\.10\)/);
  assert.doesNotMatch(home, /rgba\(255,255,255,\.75\)/);
  assert.match(home, /<SafeAreaView edges=\{\["top", "left", "right", "bottom"\]\}/);
  assert.match(home, /<BrandLogo onHero=\{theme\.dark\} \/>/);
  assert.match(home, /accessibilityLabel="Open account menu"/);
  assert.match(home, /item.label==="HoopChat"\) router\.push\(\{pathname:"\/notifications",params:\{tab:"chat"\}\}\)/);
  const account = read("../app/account.tsx");
  assert.match(account, /title="HoopChat & requests"[^\n]*params:\{tab:"chat"\}/);
});
