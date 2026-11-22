import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { act, create } from 'react-test-renderer';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const require = createRequire(import.meta.url);

test('Check motion requires a scoped server-confirmed pulse, never a refresh or Reduce Motion', async () => {
  let reduced = false;
  let celebrations = 0;
  const exports = {};
  const stub = {
    'react-native': { Pressable: 'Pressable', Text: 'Text' },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'react-native-reanimated': {
      __esModule: true,
      default: { View: 'AnimatedView' },
      cancelAnimation() {},
      useSharedValue(value) {
        const cell = React.useRef({ value, get() { return this.value; }, set(next) { this.value = next; } });
        return cell.current;
      },
      useAnimatedStyle(effect) { return effect(); },
      withTiming(value) { celebrations++; return value; },
      withSpring(value) { return value; },
      withSequence(...values) { return values.at(-1); },
    },
    '../src/motion/Provider': { useMotionSetting: () => reduced },
    '../src/motion/config': { motion: { spring: { damping: 18 } } },
    '../src/theme': { useEntryTheme: () => ({
      accent: '#DD752A', muted: '#777777', foreground: '#FFFFFF',
      accentSurface: '#202020', chip: '#333333', radius: { pill: 999 },
    }) },
  };
  const source = readFileSync(new URL('../components/FeedCheckAction.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, require: id => stub[id] || require(id) });
  const view = (checked, pulseKey, count = 1) =>
    React.createElement(exports.FeedCheckAction, {
      checked, pulseKey, count, disabled: false, busy: false, onPress: () => {},
    });
  let tree;
  await act(async () => { tree = create(view(true, 0)); });
  assert.equal(celebrations, 0, 'initial server state never animates');
  await act(async () => tree.update(view(false, 0)));
  await act(async () => tree.update(view(true, 0, 2)));
  assert.equal(celebrations, 0, 'unchecked to checked from a refresh is not a receipt');
  await act(async () => tree.update(view(false, 0)));
  await act(async () => tree.update(view(true, 1, 3)));
  assert.equal(celebrations, 1, 'one confirmed Check receipt pulses once');
  await act(async () => tree.update(view(true, 1, 4)));
  assert.equal(celebrations, 1, 'poll updates with the same receipt do not repeat motion');
  await act(async () => tree.update(view(false, 0)));
  assert.equal(celebrations, 1, 'resetting a receipt on account switch stays still');
  reduced = true;
  await act(async () => tree.update(view(true, 1, 5)));
  assert.equal(celebrations, 1, 'Reduce Motion suppresses a new confirmed receipt');
  await act(async () => tree.unmount());
});
