import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { overseasGuideIntro, overseasGuideSections, overseasGuideNotice } from "../src/native/overseasGuide.ts";
test("overseas guide has unique and complete due-diligence topics", () => {
  assert.deepEqual(overseasGuideSections.map(s => s.id), ["club","contract","travel","living","payment","arrival"]);
  for (const section of overseasGuideSections) {
    assert.ok(section.title.trim());
    assert.equal(section.checks.length, 3);
    assert.equal(new Set(section.checks).size, 3);
    for (const check of section.checks) assert.ok(check.length > 40);
  }
  assert.match(overseasGuideIntro, /not legal, immigration, tax or medical advice/);
  assert.match(overseasGuideNotice, /official authorities/);
});
test("native and web about surfaces reuse the same guide", () => {
  const native = readFileSync(new URL("../app/about.tsx", import.meta.url), "utf8");
  const web = readFileSync(new URL("../../../app/about/page.tsx", import.meta.url), "utf8");
  for (const source of [native, web]) {
    assert.match(source, /overseasGuideSections\.map/);
    assert.match(source, /overseasGuideNotice/);
  }
  assert.match(native, /accessibilityState=\{\{expanded\}\}/);
  assert.match(web, /<summary/);
});
