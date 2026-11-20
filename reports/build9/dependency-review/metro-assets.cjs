/* eslint-disable @typescript-eslint/no-require-imports -- Node.js CommonJS compatibility reproducers intentionally exercise require() behavior. */
// Candidate-only: run from the isolated repository root after installing image-size 2.0.3.
// Exercises the installed Metro, not a mocked import.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');
const mobile = createRequire(path.resolve('apps/mobile/package.json'));
const metroPath = path.join(path.dirname(mobile.resolve('metro/package.json')), 'src/Assets.js');
const metroRequire = createRequire(metroPath);
assert.equal(typeof metroRequire('image-size'), 'object', 'Candidate-only test: do not run with locked 1.x');
const { getAssetSize } = require(metroPath);
const png = fs.readFileSync('apps/mobile/assets/hoopcheck-mark.png');
assert.ok(getAssetSize('png', png, 'mark.png').width > 0);
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="24"></svg>');
assert.deepEqual(getAssetSize('svg', svg, 'test.svg'), { width: 16, height: 24 });
assert.throws(() => getAssetSize('png', Buffer.alloc(0), 'empty.png'), /empty/);
assert.equal(getAssetSize('txt', Buffer.from('text'), 'test.txt'), null);
// Content sniffing means excluded extensions alone cannot rule out parser reachability.
// ICNS with a zero-length entry: old parser loops; patched parser must reject promptly.
const bad = Buffer.alloc(16); bad.write('icns'); bad.writeUInt32BE(16, 4); bad.write('ic07', 8);
const child = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(metroPath)}).getAssetSize('png',Buffer.from('${bad.toString('hex')}','hex'),'bad.png')`], { timeout: 5000, encoding: 'utf8' });
assert.ok(!child.error, String(child.error));
assert.notEqual(child.status, 0);
assert.match(child.stderr, /Invalid ICNS/);
console.log('PASS: real Metro PNG/SVG dimensions, empty/non-image handling, malformed ICNS rejection within 5 seconds');
