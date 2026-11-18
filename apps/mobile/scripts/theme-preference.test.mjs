import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getThemePreference, getServerThemePreference, setThemePreference, subscribeThemePreference, themeIsDark } from '../src/native/themePreference.ts';
import { restorePreferences, createPreferenceWriter, defaultPreferences } from '../src/native/preferenceStore.ts';
test('explicit appearance overrides the device and system appearance follows it', () => {
  for (const system of ['light','dark',null,undefined]) {
    assert.equal(themeIsDark('light',system),false);
    assert.equal(themeIsDark('dark',system),true);
    assert.equal(themeIsDark('system',system),system!=='light');
  }
});
test('all theme subscribers update together and cleanup removes the listener', () => {
  setThemePreference('system'); const seen=[];
  const remove=subscribeThemePreference(()=>seen.push(getThemePreference()));
  setThemePreference('dark'); setThemePreference('dark'); setThemePreference('light');
  remove(); setThemePreference('system');
  assert.deepEqual(seen,['dark','light']);
  assert.equal(getServerThemePreference(),'system');
});
test('legacy and malformed saved appearance default to system', () => {
  assert.equal(restorePreferences('{}').theme,'system');
  assert.equal(restorePreferences('{"theme":"dark"}').theme,'dark');
  assert.equal(restorePreferences('{"theme":"light"}').theme,'light');
  assert.equal(restorePreferences('{"theme":"unknown"}').theme,'system');
});
test('failed theme save cannot change a later unrelated persisted setting', async () => {
  let fail=true;
  const writer=createPreferenceWriter(defaultPreferences,async()=>{if(fail){fail=false;throw new Error('Storage unavailable');}});
  await assert.rejects(writer.update({theme:'dark'}));
  const next=await writer.update({haptics:false});
  assert.equal(next.theme,'system');
});
