import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { act, create } from 'react-test-renderer';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const require = createRequire(import.meta.url);
const code = ts.transpileModule(readFileSync(new URL('../src/native/network.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
function setup() {
  const exports = {}, state = { owner: 'a', offline: false, writes: [], listener: null };
  const stubs = {
    './telemetry': { traceFlow: (_, run) => run() },
    '@react-native-community/netinfo': { addEventListener: listener => { state.listener = listener; return () => { state.listener = null; }; }, fetch: async () => ({ isConnected: !state.offline }) },
    '../lib/supabase': { supabase: { auth: {
      getSession: async () => ({ data: { session: state.owner ? { user: { id: state.owner } } : null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    } } },
    './cache': { clearPublicCache: async () => {}, readCache: async () => ({ savedAt: 1, data: ['old'] }), writeCache: async (...args) => { state.writes.push(args); } },
  };
  new Function('require','exports',code)(id => stubs[id] ?? require(id), exports);
  return { state, ...exports };
}
test('unchanged network state does not trigger context consumers again', async () => {
  const { state, NetworkProvider, useNetwork } = setup();
  const renders = [];
  function Consumer() { renders.push(useNetwork()); return null; }
  let tree;
  await act(async () => { tree = create(React.createElement(NetworkProvider, null, React.createElement(Consumer))); });
  try {
    await act(async () => state.listener({ isConnected: true }));
    assert.equal(renders.length, 1);
    await act(async () => state.listener({ isConnected: false }));
    assert.equal(renders.length, 2);
    await act(async () => state.listener({ isConnected: false }));
    assert.equal(renders.length, 2);
    await act(async () => state.listener({ isConnected: true }));
    assert.deepEqual(renders.at(-1), { offline: false, revision: 1 });
  } finally { await act(async () => tree.unmount()); }
});
test('cache reader rejects a network response after an account switch and retains normal success', async () => {
  const { state, useCachedRead } = setup();
  let reader, tree;
  function Consumer() { reader = useCachedRead(); return null; }
  await act(async () => { tree = create(React.createElement(Consumer)); });
  try {
    let result;
    await act(async () => { result = await reader.read('teams:page', async () => {
      state.owner = 'b'; return { data: ['old'], error: null };
    }); });
    assert.equal(result.data, null);
    assert.match(result.error.message, /Account changed/);
    assert.equal(state.writes.length, 0);
    await act(async () => { result = await reader.read('teams:page', async () => ({ data: ['current'], error: null })); });
    assert.deepEqual(result.data, ['current']);
    assert.deepEqual(state.writes, [['b:teams:page', ['current']]]);
  } finally { await act(async () => tree.unmount()); }
});
