import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
test('decoder preserves query-string routing and handles hostile runs within a deadline', () => {
  const qs = require('query-string');
  assert.equal(qs.parse('name=Jos%C3%A9&next=%2Ffeed').name, 'José');
  assert.equal(qs.parse('next=%2Ffeed').next, '/feed');
  execFileSync(process.execPath, ['-e', `const d=require('decode-uri-component'); for(const s of ['%C3'.repeat(100000), '%41%FF'.repeat(100000)]) d(s);`], { timeout: 5000 });
});
test('Metro image API remains callable for real assets and malformed parsers terminate', () => {
  const size = require('image-size');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
  assert.equal(size(png).width, 1);
  const temporary = mkdtempSync(join(tmpdir(), 'hoopcheck-assets-'));
  try {
    const filename = join(temporary, 'image.png');
    writeFileSync(filename, png);
    assert.deepEqual(size(filename), size(png));
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="32"></svg>');
    assert.equal(size(svg).width, 48);
    assert.equal(size(svg).height, 32);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
  const assets = require(new URL('./Assets.js', 'file://' + require.resolve('metro')).pathname);
  assert.equal(assets.getAssetSize('png', png, 'fixture.png').height, 1);
  execFileSync(process.execPath, ['-e', `const size=require('image-size'); for(const h of ['69636e730000001069636e3800000000','0000000c4a584c200d0a870a000000006a786c63','000000186674797068656963000000006865696300000000000000006d657461']) { try { size(Buffer.from(h,'hex')); } catch {} }`], { timeout: 5000 });
});
test('SDK and native bundler remain pinned', () => {
  const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url)));
  assert.match(lock.packages['node_modules/expo'].version, /^54\./);
  assert.equal(lock.packages['node_modules/react-native'].version, '0.81.5');
  assert.equal(lock.packages['node_modules/metro'].version, '0.83.3');
});
