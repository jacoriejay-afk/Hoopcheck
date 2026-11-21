import test from 'node:test';
import assert from 'node:assert/strict';
import { passportFields, passportHtml } from '../src/native/playerPassport.ts';
const profile = { id: 'owner', display_name: '<script>alert(1)</script>', position: 'Guard', current_team: 'A & B', years_pro: 3, player_verified: false, current_country: 'PRIVATE LOCATION', country: 'PRIVATE COUNTRY', bio: 'PRIVATE BIO', avatar_url: 'https://private.test/avatar' };
test('passport refuses another player and exports only the explicit field allowlist', () => {
  assert.throws(() => passportFields(profile, 'other'), /own/);
  const fields = passportFields(profile, 'owner');
  assert.deepEqual(Object.keys(fields).sort(), ['name','position','team','verified','years']);
  const html = passportHtml(fields);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('A &amp; B'));
  for (const secret of ['PRIVATE LOCATION', 'PRIVATE COUNTRY', 'PRIVATE BIO', 'private.test']) assert.ok(!html.includes(secret));
  assert.ok(!html.includes('Verified professional player on HoopCheck'));
});
test('only the server-projected verification flag produces a verification label', () => {
  assert.ok(passportHtml(passportFields({ ...profile, player_verified: true }, 'owner')).includes('Verified professional player on HoopCheck'));
});
