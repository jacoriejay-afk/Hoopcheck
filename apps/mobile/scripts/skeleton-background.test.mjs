import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { act, create } from 'react-test-renderer';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const require = createRequire(import.meta.url);
test('skeleton suspends repeating shimmer in background and removes listener on unmount', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL('../components/Motion.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  let starts = 0, cancellations = 0, removed = 0, listener;
  const stubs = {
    'react-native': { View: 'View', AppState: { currentState: 'background', addEventListener: (_, callback) => { listener = callback; return { remove() { removed++; } }; } } },
    'expo-linear-gradient': { LinearGradient: 'Gradient' },
    '../src/motion/Provider': { useMotionSetting: () => false },
    '../src/motion/config': { motion: { skeletonDelay: 100, shimmer: 500, shimmerWidth: 20 } },
    '../src/theme': { useEntryTheme: () => ({ border: '#444', surface: '#111' }) },
    'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView' }, cancelAnimation: () => cancellations++, useAnimatedStyle: fn => fn(), useSharedValue: initial => {
      const ref = React.useRef(null);
      if (!ref.current) { let value = initial; ref.current = { get: () => value, set: v => { value = v; } }; }
      return ref.current;
    }, withRepeat: value => { starts++; return value; }, withTiming: value => value },
  };
  new Function('require', 'exports', code)(id => stubs[id] ?? require(id), exports);
  let tree;
  await act(async () => { tree = create(React.createElement(exports.Skeleton)); });
  try {
    await act(async () => t.mock.timers.tick(100));
    assert.equal(starts, 0);
    await act(async () => listener('active'));
    assert.equal(starts, 1);
    const before = cancellations;
    await act(async () => listener('inactive'));
    assert.ok(cancellations > before);
    assert.equal(starts, 1);
    await act(async () => listener('active'));
    assert.equal(starts, 2);
  } finally { await act(async () => tree.unmount()); }
  assert.equal(removed, 1);
});
