import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { act, create } from 'react-test-renderer';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const require = createRequire(import.meta.url);
const exports = {};
const code = ts.transpileModule(readFileSync(new URL('../components/EntityArtwork.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const stubs = {
  'react-native': { ActivityIndicator: 'Spinner', Image: 'Image', View: 'View' },
  './DirectoryIdentity': { DirectoryCrest: 'Crest' },
  '../src/theme': { useEntryTheme: () => ({ border: '#444', surface: '#171717', accent: '#ff8a5c', crest: { panel: '#111' } }) },
};
new Function('require', 'exports', code)(id => stubs[id] ?? require(id), exports);

test('stalled artwork falls back, a new URL retries, and loaded artwork keeps its image', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let tree;
  const props = { name: 'Club', kind: 'teams', logoUrl: 'https://media.test/one.png' };
  await act(async () => { tree = create(React.createElement(exports.EntityArtwork, props)); });
  assert.equal(tree.root.findAllByType('Spinner').length, 1);
  await act(async () => t.mock.timers.tick(12000));
  assert.equal(tree.root.findAllByType('Crest').length, 1);
  assert.equal(tree.root.findAllByType('Image').length, 0);
  await act(async () => tree.update(React.createElement(exports.EntityArtwork, { ...props, logoUrl: 'https://media.test/two.png' })));
  assert.equal(tree.root.findAllByType('Image').length, 1);
  await act(async () => tree.root.findByType('Image').props.onLoad());
  await act(async () => t.mock.timers.tick(12000));
  assert.equal(tree.root.findAllByType('Spinner').length, 0);
  assert.equal(tree.root.findAllByType('Image').length, 1);
  await act(async () => tree.unmount());
});
