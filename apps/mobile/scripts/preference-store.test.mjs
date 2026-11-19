import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPreferenceWriter, defaultPreferences, restorePreferences } from '../src/native/preferenceStore.ts';
test('failed lock-setting write cannot be persisted by a later unrelated change', async () => {
  const saved = [];
  let fail = true;
  const writer = createPreferenceWriter({ ...defaultPreferences, appLock: true }, async value => {
    if (fail) { fail = false; throw new Error('Disk full'); }
    saved.push(value);
  });
  await assert.rejects(writer.update({ appLock: false }));
  await writer.update({ haptics: false });
  assert.equal(saved[0].appLock, true);
  assert.equal(saved[0].haptics, false);
});
test('queued writes merge against committed state and retain onboarding completion', async () => {
  const saved = [];
  let release;
  const barrier = new Promise(resolve => { release = resolve; });
  const writer = createPreferenceWriter(defaultPreferences, async value => { await barrier; saved.push(value); });
  const first = writer.update({ onboardingDone: true });
  const second = writer.update({ haptics: false });
  assert.deepEqual(saved, []);
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a.onboardingDone, true);
  assert.equal(b.onboardingDone, true);
  assert.equal(b.haptics, false);
  assert.deepEqual(saved, [a, b]);
});
test('queued failed security changes do not poison subsequent writes', async () => {
  let calls = 0;
  const writer = createPreferenceWriter({ ...defaultPreferences, appLock: true }, async () => { if (++calls === 1) throw new Error('Write failed'); });
  const failed = writer.update({ appLock: false });
  const second = writer.update({ onboardingDone: true });
  await assert.rejects(failed);
  const next = await second;
  assert.equal(next.appLock, true);
  assert.equal(next.onboardingDone, true);
});
test('fresh and legacy preferences retain defaults; malformed security settings fail closed', () => {
  assert.deepEqual(restorePreferences(null), defaultPreferences);
  assert.equal(restorePreferences('{}').appLock, false);
  assert.equal(restorePreferences('{"appLock":false}').appLock, false);
  for (const value of ['broken', 'null', '[]', '{"appLock":"false"}', '{"appLock":0}']) assert.equal(restorePreferences(value).appLock, true);
  const prefs = restorePreferences('{"onboardingDone":"false","role":"owner","haptics":false,"secret":"ignore"}');
  assert.equal(prefs.onboardingDone, false);
  assert.equal(prefs.haptics, false);
  assert.equal(prefs.role, undefined);
  assert.equal(prefs.secret, undefined);
});
