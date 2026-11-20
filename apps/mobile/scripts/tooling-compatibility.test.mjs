import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

test('sharp fixtures preserve PNG/JPEG dimensions through decode', async () => {
  const sharp = require('sharp');
  for (const format of ['png', 'jpeg']) {
    const bytes = await sharp({ create: { width: 80, height: 40, channels: 3, background: '#ff790b' } })[format]().toBuffer();
    const result = await sharp(bytes).metadata();
    assert.equal(result.width, 80);
    assert.equal(result.height, 40);
    assert.equal(result.format, format);
  }
});

test('Expo glob consumers retain sync, async, brace and dotfile traversal', async () => {
  const glob = require('glob');
  const options = { cwd: new URL('..', import.meta.url).pathname, nodir: true, dot: true };
  const pattern = '{app,scripts}/**/*.{ts,tsx,mjs}';
  const sync = glob.globSync(pattern, options).sort();
  assert(sync.length > 20);
  assert.deepEqual((await glob.glob(pattern, options)).sort(), sync);
  assert.deepEqual(glob.sync(pattern, options).sort(), sync);
});

test('real fingerprint minimatch consumer preserves ignore and negation behavior', () => {
  const { isIgnoredPath } = require('@expo/fingerprint/build/utils/Path.js');
  assert(isIgnoredPath('node_modules/a/index.js', ['**/node_modules/**']));
  assert(!isIgnoredPath('app/index.tsx', ['**/node_modules/**']));
  assert(isIgnoredPath('.hidden/file', ['**']));
  assert(!isIgnoredPath('app/keep.ts', ['app/**', '!app/keep.ts']));
  const cliRequire = createRequire(require.resolve('expo/package.json'));
  const cli = createRequire(cliRequire.resolve('@expo/cli/package.json'));
  const { minimatch, Minimatch } = cli('minimatch');
  assert(minimatch('app/(tabs)/index.tsx', '**/*.tsx'));
  assert(new Minimatch('**/*.{png,jpg}').match('assets/icon.png'));
});
