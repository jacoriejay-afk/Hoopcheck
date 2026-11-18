import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { lockScreenRequired } from '../src/native/lockPolicy.ts';

// Real component/hooks, stubbed native bridges. UIKit touch delivery needs a device.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const require = createRequire(import.meta.url);
function load(name, state, overrides = {}) {
  state.preferences = { onboardingDone: true, ...state.preferences };
  const source = readFileSync(new URL(`../components/${name}.tsx`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  const stubs = {
    'react-native': { Modal: 'Modal', Pressable: 'Pressable', Text: 'Text', View: 'View', Image: 'Image', AppState: { addEventListener: () => ({ remove() {} }) } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '../src/native/preferences': { useDevicePreferences: () => state },
    '../src/theme': { useEntryTheme: () => ({}) },
    './Motion': { Reveal: ({ children }) => children },
    '../assets/hoopcheck-mark.png': 1,
    'expo-local-authentication': { authenticateAsync: async () => ({ success: true }) },
    'expo-secure-store': { getItemAsync: async () => null },
    '../src/native/lockPolicy': { lockScreenRequired, consumeFreshSignIn: () => false, backgroundRequiresLock: () => true },
    '../src/lib/supabase': { supabase: { auth: { signOut: async () => ({ error: null }) } } },
  };
  if (name === 'AppLock') stubs['./Onboarding'] = { Onboarding: load('Onboarding', state) };
  Object.assign(stubs, overrides);
  vm.runInNewContext(code, { exports, require: id => Object.hasOwn(stubs, id) ? stubs[id] : require(id) });
  return exports[name];
}
async function render(Component, props = {}) {
  let tree;
  await act(async () => { tree = create(React.createElement(Component, props)); });
  return tree;
}

test('inactive onboarding has no mounted modal', async () => {
  for (const state of [{ ready: false, preferences: { onboardingDone: false } }, { ready: true, preferences: { onboardingDone: true } }]) {
    const tree = await render(load('Onboarding', state));
    assert.equal(tree.toJSON(), null);
    await act(async () => tree.unmount());
  }
});

test('completing onboarding removes its content', async () => {
  const state = { ready: true, preferences: { onboardingDone: false }, update: async value => { state.preferences = { ...state.preferences, ...value }; } };
  const Component = load('Onboarding', state);
  const tree = await render(Component);
  assert.equal(tree.root.findAllByType('Modal').length, 0);
  assert.ok(tree.root.findByType('SafeAreaView'));
  await act(async () => { await tree.root.findAllByType('Pressable')[0].props.onPress(); });
  await act(async () => tree.update(React.createElement(Component)));
  assert.equal(tree.toJSON(), null);
  await act(async () => tree.unmount());
});

test('app lock conceals content throughout hydration', async () => {
  for (const [authReady, ready] of [[false, false], [false, true], [true, false]]) {
    const tree = await render(load('AppLock', { ready, preferences: { appLock: false } }), { authReady, protectedScreen: true });
    assert.equal(tree.root.findByType('Modal').props.visible, true);
    await act(async () => tree.unmount());
  }
});

test('inactive app lock has no mounted modal', async () => {
  for (const [protectedScreen, appLock] of [[false, true], [true, false]]) {
    const tree = await render(load('AppLock', { ready: true, preferences: { appLock } }), { authReady: true, protectedScreen });
    assert.equal(tree.toJSON(), null);
    await act(async () => tree.unmount());
  }
});

test('restored session stays locked until device authentication succeeds', async () => {
  const tree = await render(load('AppLock', { ready: true, preferences: { appLock: true } }), { authReady: true, protectedScreen: true });
  assert.equal(tree.root.findByType('Modal').props.visible, true);
  await act(async () => { await tree.root.findAllByType('Pressable')[0].props.onPress(); });
  assert.equal(tree.toJSON(), null);
  await act(async () => tree.unmount());
});

for (const [label, authenticateAsync] of [
  ['cancelled', async () => ({ success: false })],
  ['unavailable', async () => { throw new Error('Unavailable'); }],
]) {
  test(`device authentication ${label} does not dismiss app lock`, async () => {
    const tree = await render(load('AppLock', { ready: true, preferences: { appLock: true } }, {
      'expo-local-authentication': { authenticateAsync },
    }), { authReady: true, protectedScreen: true });
    await act(async () => { await tree.root.findAllByType('Pressable')[0].props.onPress(); });
    assert.equal(tree.root.findByType('Modal').props.visible, true);
    assert.equal(tree.root.findAllByType('Pressable')[0].props.disabled, false);
    await act(async () => tree.unmount());
  });
}

test('hydration and onboarding share one native presentation', async () => {
  const state = { ready: false, preferences: { appLock: false, onboardingDone: false }, update: async value => { state.preferences = { ...state.preferences, ...value }; } };
  const Component = load('AppLock', state);
  const tree = await render(Component, { authReady: false, protectedScreen: true });
  const modal = tree.root.findByType('Modal');
  assert.equal(tree.root.findAllByType('SafeAreaView').length, 0);
  state.ready = true;
  await act(async () => tree.update(React.createElement(Component, { authReady: true, protectedScreen: true })));
  assert.equal(tree.root.findAllByType('Modal').length, 1);
  assert.equal(tree.root.findByType('Modal'), modal);
  assert.ok(tree.root.findByType('SafeAreaView'));
  await act(async () => { await tree.root.findAllByType('Pressable')[0].props.onPress(); });
  await act(async () => tree.update(React.createElement(Component, { authReady: true, protectedScreen: true })));
  assert.equal(tree.toJSON(), null);
  await act(async () => tree.unmount());
});

test('onboarding cannot cover an active app lock', async () => {
  const tree = await render(load('AppLock', { ready: true, preferences: { appLock: true, onboardingDone: false } }), { authReady: true, protectedScreen: true });
  assert.equal(tree.root.findAllByType('Modal').length, 1);
  assert.equal(tree.root.findAllByType('SafeAreaView').length, 0);
  await act(async () => { await tree.root.findAllByType('Pressable')[0].props.onPress(); });
  assert.equal(tree.root.findAllByType('Modal').length, 1);
  assert.ok(tree.root.findByType('SafeAreaView'));
  await act(async () => tree.unmount());
});
