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

async function render(accountType, path, platform = "ios") {
  const navigations = [];
  const exports = {};
  const stubs = {
    'expo-blur': { BlurView: 'BlurView' },
    'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
    'expo-glass-effect': { GlassView: 'GlassView', isGlassEffectAPIAvailable: () => false, isLiquidGlassAvailable: () => false },
    'react-native': { Platform: { OS: platform }, StyleSheet: { absoluteFill: {} }, AccessibilityInfo: { isReduceTransparencyEnabled: platform === "ios" ? async () => true : undefined, addEventListener: () => ({ remove() {} }) }, Keyboard: { addListener: () => ({ remove() {} }) }, Pressable: ({ children, ...props }) => React.createElement('Pressable', props, typeof children === 'function' ? children({ pressed: false }) : children), Text: 'Text', View: 'View' },
    'expo-router': { usePathname: () => path, useRouter: () => ({ navigate: route => navigations.push(route) }) },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ left: 0, right: 0, bottom: 0 }) },
    'react-native-reanimated': {
      __esModule: true, default: { View: 'AnimatedView' },
      useAnimatedStyle: fn => fn(), useSharedValue: value => ({ get: () => value, set() {} }),
      withSpring: value => value, withTiming: value => value, withSequence: (...values) => values[values.length - 1],
    },
    '../src/motion/Provider': { useMotionSetting: () => true },
    '../src/motion/config': { motion: { shortFade: 0, spring: {} } },
    '../src/native/haptics': { useHaptics: () => () => {} },
    '../src/theme': { useEntryTheme: () => ({ courtside: { navigation: { radius: 24, height: 56, iconSize: 22 } }, surface: '#fff', background: '#fff', border: '#ddd', muted: '#333', foreground: '#000', accent: '#f60', accentSurface: '#fee', glassFill: 'rgba(255,255,255,.6)', glassBorder: '#eee', dark: false, type: { ui: { fontFamily: 'System' } } }) },
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

test('web navigation does not call iOS-only transparency APIs', async () => {
  const { tree } = await render('player', '/dashboard', 'web');
  try { assert.equal(tree.root.findAllByType('Pressable').length, 5); }
  finally { await act(async () => tree.unmount()); }
});

test('glass routes float while other Build 9 screens retain their navigation footprint', async () => {
  const floated = await render('player', '/dashboard');
  const ordinary = await render('player', '/search');
  try {
    assert.equal(floated.tree.root.findByProps({ testID: 'glass-floating-tab-bar' }).props.style.position, 'absolute');
    assert.equal(ordinary.tree.root.findByProps({ testID: 'glass-floating-tab-bar' }).props.style.position, 'relative');
  } finally {
    await act(async () => floated.tree.unmount());
    await act(async () => ordinary.tree.unmount());
  }
});
