import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeThemeColorMath } from './lib/theme-color-math.mjs';
const color = makeThemeColorMath();
test('computed legacy and CSS Color 4 sRGB colors resolve to equivalent channels', () => {
  assert.deepEqual(color.parse('rgb(255, 90, 31)'), color.parse('color(srgb 1 0.35294117647058826 0.12156862745098039)'));
  assert.deepEqual(color.parse('rgba(255, 255, 255, 0.92)'), color.parse('color(srgb 1 1 1 / 0.92)'));
  assert.deepEqual(color.parse('rgb(100% 100% 100% / 92%)'), [255, 255, 255, 0.92]);
  for (const value of ['bad', 'color(srgb nan 1 1)', 'rgb(1 2)']) assert.equal(color.parse(value), null);
});
test('translucent glass is composited before measuring text contrast', () => {
  const body = { parentElement: null, fill: 'rgb(0, 0, 0)' };
  const card = { parentElement: body, fill: 'color(srgb 1 1 1 / 0.92)' };
  const text = { parentElement: card, fill: 'rgba(0, 0, 0, 0)' };
  const back = color.background(text, element => ({ backgroundColor: element.fill }));
  assert.deepEqual(back, [234.60000000000002, 234.60000000000002, 234.60000000000002, 1]);
  assert.ok(color.contrast([23, 23, 23, 1], back) > 14);
});
test('the audit rejects pale text on orange but accepts the corrected dark badge ink', () => {
  const orange = [255, 90, 31, 1];
  assert.ok(color.contrast([245, 245, 240, 1], orange) < 4.5);
  assert.ok(color.contrast([21, 21, 21, 1], orange) >= 4.5);
  assert.equal(color.contrast([255, 255, 255, 1], [0, 0, 0, 1]), 21);
});
