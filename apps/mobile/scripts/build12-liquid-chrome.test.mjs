import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("native Liquid Glass chrome uses a genuinely clear layer, while normal cards stay unchanged", () => {
  const glass = read("../components/GlassSurface.tsx");
  assert.match(glass, /chrome = false/);
  assert.match(glass, /backgroundColor: opaque \? theme\.surface : chrome \? "transparent" : theme\.glassFill/);
  assert.match(glass, /glassEffectStyle=\{chrome \? "clear" : "regular"\}/);
  assert.match(glass, /!chrome \? <LinearGradient/);
  assert.match(glass, /AccessibilityInfo\.isReduceTransparencyEnabled\(\)/);
  assert.match(glass, /const opaque = solid \|\| reduceTransparency \|\| Platform\.OS !== "ios"/);
  assert.match(glass, /isGlassEffectAPIAvailable\(\) && isLiquidGlassAvailable\(\)/);
  assert.match(glass, /<BlurView pointerEvents="none" accessible=\{false\}/);
});

test("iOS bottom navigation has clear native effect instead of multiple opaque white layers", () => {
  const tabs = read("../components/TabBar.tsx");
  assert.match(tabs, /backgroundColor: translucent \? "transparent"/);
  assert.match(tabs, /glassEffectStyle="clear"/);
  assert.match(tabs, /rgba\(255,255,255,0\.12\)/);
  assert.match(tabs, /colors=\{translucent \? /);
  assert.match(tabs, /rgba\(255,255,255,\.10\)/);
  assert.doesNotMatch(tabs, /rgba\(255,255,255,\.77\)/);
  assert.match(tabs, /AccessibilityInfo\.isReduceTransparencyEnabled\(\)/);
  assert.match(tabs, /const translucent = Platform\.OS === "ios" && !reduceTransparency/);
  assert.match(tabs, /const nativeGlass = translucent && isGlassEffectAPIAvailable\(\) && isLiquidGlassAvailable\(\)/);
  assert.match(tabs, /marginBottom: Math\.max\(9, insets\.bottom\)/);
});

test("Home header is clear chrome but retains safe-area and legible logo/controls", () => {
  const home = read("../app/dashboard.tsx");
  assert.match(home, /<GlassSurface chrome style=/);
  assert.match(home, /rgba\(255,255,255,\.10\)/);
  assert.doesNotMatch(home, /rgba\(255,255,255,\.75\)/);
  assert.match(home, /<SafeAreaView edges=\{\["top", "left", "right", "bottom"\]\}/);
  assert.match(home, /<BrandLogo onHero=\{theme\.dark\} \/>/);
  assert.match(home, /accessibilityLabel="Open account menu"/);
  assert.match(home, /<GlassSurface style=\{\{\s*position:"absolute",right:12,top:78/);
});
