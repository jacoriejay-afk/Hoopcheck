import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { act, create } from 'react-test-renderer';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../components/TabBar.tsx', import.meta.url), 'utf8');

async function render(accountType, path) {
  const navigations = [];
  const exports = {};
  const stubs = {
    'react-native': { Keyboard: { addListener: () => ({ remove() {} }) }, Pressable: 'Pressable', Text: 'Text', View: 'View' },
    'expo-router': { usePathname: () => path, useRouter: () => ({ navigate: route => navigations.push(route) }) },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ left: 0, right: 0, bottom: 0 }) },
    'react-native-reanimated': {
      __esModule: true, default: { View: 'AnimatedView' },
      useAnimatedStyle: fn => fn(), useSharedValue: value => ({ get: () => value, set() {} }),
      withSpring: value => value, withTiming: value => value,
    },
    '../src/motion/Provider': { useMotionSetting: () => true },
    '../src/motion/config': { motion: { shortFade: 0, spring: {} } },
    '../src/native/haptics': { useHaptics: () => () => {} },
    '../src/theme': { useEntryTheme: () => ({ courtside: { navigation: { radius: 24, height: 56, iconSize: 22 } } }) },
    '../src/native/useNativeAccount': { useNativeAccount: () => ({ account: accountType ? { user: { accountType } } : null }) },
  };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: id => Object.hasOwn(stubs, id) ? stubs[id] : require(id) });
  let tree;
  await act(async () => { tree = create(React.createElement(exports.TabBar)); });
  return { tree, navigations };
}

test('tab accessible names match visible labels for fans, other accounts and loading state', async () => {
  for (const accountType of ['fan', 'player', 'coach', null]) {
    const { tree, navigations } = await render(accountType, '/dashboard');
    try {
      assert.equal(tree.root.findAllByProps({ accessibilityRole: 'tablist' }).length, 1);
      const tabs = tree.root.findAllByType('Pressable');
      assert.equal(tabs.length, 5);
      for (const tab of tabs) {
        assert.equal(tab.props.accessibilityRole, 'tab');
        assert.equal(tab.props.accessibilityLabel, tab.findByType('Text').props.children);
      }
      const feed = tree.root.findByProps({ testID: 'tab-hoopfeed' });
      assert.equal(feed.props.accessibilityLabel, accountType === 'fan' ? 'FAN HQ' : 'HoopFeed');
      assert.equal(feed.props.accessibilityState.selected, false);
      await act(async () => { feed.props.onPress(); });
      assert.deepEqual(navigations, ['/feed']);
    } finally { await act(async () => tree.unmount()); }
  }
});

test('fan feed tab retains selected semantics on feed and fan-feed routes', async () => {
  for (const path of ['/feed', '/fan-feed']) {
    const { tree } = await render('fan', path);
    try {
      const feed = tree.root.findByProps({ testID: 'tab-hoopfeed' });
      assert.equal(feed.props.accessibilityLabel, 'FAN HQ');
      assert.equal(feed.props.accessibilityState.selected, true);
      assert.equal(tree.root.findAllByType('Pressable').filter(tab => tab.props.accessibilityState.selected).length, 1);
    } finally { await act(async () => tree.unmount()); }
  }
});
