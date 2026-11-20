// Run from repository root after mobile npm ci and an isolated candidate install:
// npm install --prefix /tmp/hoopcheck-dependency-probe --ignore-scripts --no-audit decode-uri-component@0.5.1 image-size@2.0.3
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const path = require('node:path');
const mobile = createRequire(path.resolve('apps/mobile/package.json'));
const candidate = createRequire('/tmp/hoopcheck-dependency-probe/package.json');
const png = fs.readFileSync('apps/mobile/assets/hoopcheck-mark.png');
const currentImage = mobile('image-size');
const patchedImage = candidate('image-size');

// Exact Babel default-import semantics used by Metro Assets.js.
const interop = value => value && value.__esModule ? value : { default: value };
assert.ok(interop(patchedImage).default(png).width > 0);
assert.ok(patchedImage.imageSize(png).width > 0);
console.log('PASS: image-size 2.0.3 parses PNG via named API, preserves Metro callable default contract');
const code = fs.readFileSync(mobile.resolve('query-string'), 'utf8');
const exportsObject = {};
const decoder = candidate('decode-uri-component');
vm.runInNewContext(code, { exports: exportsObject, require: id => id === 'decode-uri-component' ? decoder : mobile(id), Buffer });
assert.equal(exportsObject.stringify({ q: 'a b' }), 'q=a%20b');
assert.throws(() => exportsObject.parse('q=a%20b'), /decodeComponent is not a function/);
assert.equal(mobile('query-string').parse('q=a%20b').q, 'a b');
assert.equal(decoder.default('a%20b'), 'a b');
console.log('PASS: decoder 0.5.1 works via ESM default, but breaks query-string 7 CommonJS parse contract; stringify remains functional');
assert.throws(() => interop(patchedImage).default(path.resolve('apps/mobile/assets/hoopcheck-mark.png')), /list.*argument|argument.*list/);
assert.ok(currentImage(path.resolve('apps/mobile/assets/hoopcheck-mark.png')).width > 0);
console.log('PASS: image-size 2.0.3 rejects filename input required by Metro getAssetData; locked 1.2.1 accepts it');
