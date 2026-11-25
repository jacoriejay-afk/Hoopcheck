import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
const native = readFileSync(new URL('../components/HoopCheckLoading.tsx', import.meta.url), 'utf8');
const web = readFileSync(new URL('../../../components/HoopLoading.tsx', import.meta.url), 'utf8');
test('native loader retains the website orbit, brand and indeterminate track structure', () => {
  assert.match(web, /hc-brand-loader__orbit/);
  assert.match(web, /hc-brand-loader__track/);
  assert.match(native, /<BrandLockup size=\{32\}/);
  assert.match(native, /compact \? <BrandMark size=\{17\}/);
  assert.match(native, /translateX: reduced \|\| !foreground \? 29 :/);
  assert.match(native, /accessibilityRole="progressbar"/);
  assert.match(native, /accessibilityState=\{\{ busy: true \}\}/);
  assert.doesNotMatch(native, /accessibilityValue=|setTimeout\(/);
});
test('native loader stops animation on background, reduce motion and unmount', () => {
  assert.match(native, /!reduced && foreground/);
  assert.match(native, /return \(\) => cancelAnimation\(phase\)/);
  assert.match(native, /return \(\) => listener.remove\(\)/);
});
