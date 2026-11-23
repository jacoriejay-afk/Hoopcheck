import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../components/glass/GlassBadge.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const exports = {};
vm.runInNewContext(code, {
  exports,
  require: id => id === "react-native" ? { Text: "Text", View: "View" }
    : id === "../../src/glassTheme" ? { glassTokens: { orange: "#FF5A1F", border: "#FFF", solid: "#16171E" } }
    : require(id),
});

test("LIVE status fails closed without a trusted score timestamp", () => {
  const isLive = exports.isFreshLive;
  const now = Date.parse("2026-11-23T18:00:00Z");
  assert.equal(isLive("live", null, now), false);
  assert.equal(isLive("live", undefined, now), false);
  assert.equal(isLive("final", new Date(now).toISOString(), now), false);
  assert.equal(isLive("finished", new Date(now).toISOString(), now), false);
  assert.equal(isLive("live", new Date(now - 300_000).toISOString(), now), false);
  assert.equal(isLive("live", new Date(now - 300_001).toISOString(), now), false);
  assert.equal(isLive("live", new Date(now - 299_999).toISOString(), now), true);
  assert.equal(isLive("live", new Date(now + 1).toISOString(), now), false);
  assert.equal(isLive("live", "invalid", now), false);
});

test("shared glass surfaces preserve reduced-transparency fallback", () => {
  const surface = readFileSync(new URL("../components/GlassSurface.tsx", import.meta.url), "utf8");
  const card = readFileSync(new URL("../components/glass/GlassCard.tsx", import.meta.url), "utf8");
  const header = readFileSync(new URL("../components/glass/GlassHeader.tsx", import.meta.url), "utf8");
  assert.match(surface, /reduceTransparency/);
  assert.match(surface, /const opaque = solid \|\| reduceTransparency/);
  assert.doesNotMatch(card, /backgroundColor: solid \? glass.solid : glass.fill/);
  assert.match(header, /insets.top \+ 8/);
  assert.match(header, /BrandLogo/);
});
