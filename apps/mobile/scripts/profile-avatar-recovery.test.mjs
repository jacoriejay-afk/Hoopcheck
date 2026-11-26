import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { act, create } from 'react-test-renderer';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const require = createRequire(import.meta.url), exports = {};
const code = ts.transpileModule(readFileSync(new URL('../components/ProfileAvatar.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const stubs = {
  'react-native': { Image: 'Image', Text: 'Text', View: 'View' },
  '../src/theme': { useEntryTheme: () => ({ chip: '#111', onChip: '#fff' }) },
  '../src/native/playerProfiles': { safeAvatar: url => url?.startsWith('https://') ? url : null },
};
new Function('require', 'exports', code)(id => stubs[id] ?? require(id), exports);
const avatar = props => React.createElement(exports.ProfileAvatar, props);
const props = { name: '  Élodie', url: 'https://fixture.test/a.jpg' };

test('profile avatar has immediate accessible fallback and bounds a stalled request', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let tree;
  await act(async () => { tree = create(avatar(props)); });
  try {
    assert.equal(tree.root.findByType('Text').props.children, 'É');
    assert.equal(tree.root.findByType('Image').props.accessibilityElementsHidden, true);
    const staleLoad = tree.root.findByType('Image').props.onLoad;
    await act(async () => t.mock.timers.tick(8000));
    assert.equal(tree.root.findAllByType('Image').length, 0);
    await act(async () => staleLoad());
    assert.equal(tree.root.findAllByType('Image').length, 0);
    await act(async () => tree.update(avatar({ ...props, url: 'https://fixture.test/b.jpg' })));
    assert.equal(tree.root.findByType('Image').props.style.opacity, 0);
    await act(async () => tree.root.findByType('Image').props.onLoad());
    await act(async () => t.mock.timers.tick(8000));
    assert.equal(tree.root.findByType('Image').props.style.opacity, 1);
    assert.equal(tree.root.findByType('Image').props.accessibilityElementsHidden, false);
    assert.equal(tree.root.findAllByType('Text').length, 0);
    await act(async () => tree.update(avatar({ ...props, url: 'https://fixture.test/c.jpg' })));
    assert.equal(tree.root.findByType('Image').props.style.opacity, 0);
    await act(async () => tree.root.findByType('Image').props.onError());
    assert.equal(tree.root.findAllByType('Image').length, 0);
  } finally { await act(async () => tree.unmount()); }
});

test('missing avatar fallback preserves Unicode code points and normalized accents', async () => {
  for (const [name, initial] of [['  E\u0301lodie', 'É'], ['𐐨name', '𐐀'], ['李明', '李'], ['   ', 'P']]) {
    let tree;
    await act(async () => { tree = create(avatar({ name, url: null })); });
    try {
      assert.equal(tree.root.findByType('Text').props.children, initial);
      assert.equal(tree.root.findAllByType('Image').length, 0);
    } finally { await act(async () => tree.unmount()); }
  }
});
