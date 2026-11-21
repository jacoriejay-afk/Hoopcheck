import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { readWithDeadline } from '../src/native/readDeadline.ts';
import { createPreferenceWriter, defaultPreferences, restorePreferences } from '../src/native/preferenceStore.ts';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const require = createRequire(import.meta.url);
function load(path, stubs) {
  const code = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  new Function('require', 'exports', code)(id => Object.hasOwn(stubs, id) ? stubs[id] : require(id), exports);
  return exports;
}
const { createSessionBootstrap } = load('src/native/sessionBootstrap.ts', { './readDeadline': { readWithDeadline } });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const settle = async () => { for (let n = 0; n < 8; n++) await Promise.resolve(); };
const session = id => ({ user: { id } });

test('a hanging initial session exposes retry without declaring the user signed out', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = deferred(); const states = [];
  let read = () => pending.promise;
  const bootstrap = createSessionBootstrap(() => read(), () => () => {}, value => states.push(value), 100);
  await settle(); t.mock.timers.tick(100); await settle();
  assert.equal(states.at(-1).ready, false); assert.match(states.at(-1).error, /try again/);
  read = async () => ({ data: { session: session('current') } });
  await bootstrap.retry();
  assert.deepEqual(states.at(-1), { ready: true, userId: 'current', error: null });
  pending.resolve({ data: { session: session('stale') } }); await settle();
  assert.equal(states.at(-1).userId, 'current'); bootstrap.dispose();
});

test('auth transitions win over a stale initial read and a stale failure', async () => {
  for (const fail of [false, true]) {
    const pending = deferred(); const states = []; let receive;
    const bootstrap = createSessionBootstrap(() => pending.promise, next => { receive = next; return () => {}; }, value => states.push(value));
    await settle(); receive(session('new-user')); receive(null);
    if (fail) pending.reject(new Error('old request failed')); else pending.resolve({ data: { session: session('old-user') } });
    await settle(); assert.deepEqual(states.at(-1), { ready: true, userId: null, error: null }); bootstrap.dispose();
  }
});

test('synchronous initial auth notification is not overwritten by another bootstrap', () => {
  let reads = 0; const states = [];
  const bootstrap = createSessionBootstrap(async () => { reads++; return { data: { session: null } }; }, receive => { receive(session('current')); return () => {}; }, value => states.push(value));
  assert.equal(reads, 0); assert.deepEqual(states, [{ ready: true, userId: 'current', error: null }]); bootstrap.dispose();
});

test('disposing startup unsubscribes and ignores late native reads and auth callbacks', async () => {
  const pending = deferred(); const states = []; let receive, removed = 0;
  const bootstrap = createSessionBootstrap(() => pending.promise, next => { receive = next; return () => removed++; }, value => states.push(value));
  await settle(); bootstrap.dispose(); const count = states.length;
  receive(session('stale')); pending.resolve({ data: { session: session('stale') } }); await settle();
  assert.equal(removed, 1); assert.equal(states.length, count);
});

test('failed and timed-out settings reads preserve stored security settings and recover on retry', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = deferred(); let getItem = () => pending.promise; const writes = []; let state;
  const { DevicePreferences, useDevicePreferences } = load('src/native/preferences.tsx', {
    './themePreference': { setThemePreference() {} },
    '@react-native-async-storage/async-storage': { default: { getItem: () => getItem(), setItem: async (...args) => writes.push(args) } },
    './preferenceStore': { createPreferenceWriter, defaultPreferences, restorePreferences }, './readDeadline': { readWithDeadline },
  });
  function Observe() { state = useDevicePreferences(); return null; }
  let tree; await act(async () => { tree = create(React.createElement(DevicePreferences, null, React.createElement(Observe))); });
  await act(async () => { t.mock.timers.tick(10000); await settle(); });
  assert.equal(state.ready, false); assert.match(state.restoreError, /security settings/);
  await assert.rejects(state.update({ appLock: false }), /not ready/); assert.deepEqual(writes, []);
  getItem = async () => { throw new Error('storage unavailable'); };
  await act(async () => state.retryRestore()); assert.equal(state.ready, false); assert.deepEqual(writes, []);
  getItem = async () => JSON.stringify({ appLock: true, onboardingDone: true, theme: 'dark' });
  await act(async () => state.retryRestore());
  assert.equal(state.ready, true); assert.equal(state.preferences.appLock, true); assert.equal(state.preferences.theme, 'dark');
  pending.resolve(JSON.stringify({ appLock: false })); await act(settle);
  assert.equal(state.preferences.appLock, true); assert.deepEqual(writes, []);
  await act(async () => tree.unmount());
});
