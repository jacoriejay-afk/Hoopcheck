import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const prefix = 'hoopcheck:public-cache:v1:';
function loadCache(storage) {
  const code = ts.transpileModule(readFileSync(new URL('../src/native/cache.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  new Function('require', 'exports', code)(id => {
    assert.equal(id, '@react-native-async-storage/async-storage');
    return { default: storage };
  }, exports);
  return exports;
}
test('clear removes only public directory cache entries', async () => {
  const keys = [prefix + 'teams', prefix + 'leagues', 'supabase-auth-token', 'hoopcheck:preferences', 'hoopcheck:drafts:owner', 'other:' + prefix + 'teams'];
  const removed = [];
  const { clearPublicCache } = loadCache({ getAllKeys: async () => keys, multiRemove: async values => removed.push(...values) });
  await clearPublicCache();
  assert.deepEqual(removed, keys.slice(0, 2));
});
test('empty cache does not remove other keys', async () => {
  const { clearPublicCache } = loadCache({ getAllKeys: async () => ['auth', 'draft'], multiRemove: async () => assert.fail('unexpected removal') });
  await clearPublicCache();
});
test('failed storage removal is surfaced to the caller', async () => {
  const { clearPublicCache } = loadCache({ getAllKeys: async () => [prefix + 'teams'], multiRemove: async () => { throw new Error('storage unavailable'); } });
  await assert.rejects(clearPublicCache(), /storage unavailable/);
});
test('native settings uses only scoped cache removal and waits for confirmation', () => {
  const source = readFileSync(new URL('../app/settings.tsx', import.meta.url), 'utf8');
  assert.match(source, /if \(clearingCache\.current\) return/);
  assert.match(source, /await clearPublicCache\(\);\s*setCacheMessage\("Cached directory data cleared/);
  assert.match(source, /Could not clear cached directory data/);
  assert.match(source, /disabled=\{cacheBusy\}/);
  assert.doesNotMatch(source, /AsyncStorage\.clear\(/);
});
