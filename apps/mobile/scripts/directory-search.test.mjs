import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { searchDirectory, searchResultPath, cleanDirectorySearch } from '../src/native/directorySearch.ts';
function fixture(request) {
  return createClient('https://sandbox.example', 'test-key', { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: request } });
}
test('global search preserves directory eligibility and emits only public fields', async () => {
  const requests = [];
  const groups = await searchDirectory(fixture(async (input, options) => {
    requests.push({ url: new URL(String(input)), method: options.method });
    return Response.json([{ id: 'fixture', name: 'Fixture' }]);
  }), 'Olympia');
  assert.equal(groups.length, 6);
  assert.equal(requests.length, 6);
  for (const { url, method } of requests) {
    assert.equal(method, 'GET');
    assert.equal(url.searchParams.get('limit'), '6');
    assert.ok(!/email|birth|address|phone|salary/.test(url.searchParams.get('select')));
    if (url.pathname.endsWith('/profiles')) {
      for (const [key, value] of Object.entries({ account_type: 'eq.player', profile_visibility: 'eq.public', moderation_status: 'eq.normal', professional_experience: 'eq.true' })) assert.equal(url.searchParams.get(key), value);
      assert.equal(url.searchParams.get('basketball_type'), 'in.(mens,womens)');
      assert.equal(url.searchParams.get('username'), 'ilike.%olympia%');
    } else {
      assert.equal(url.searchParams.get('active'), 'eq.true');
      const mens = url.pathname === '/rest/v1/teams' || url.pathname === '/rest/v1/leagues';
      assert.equal(url.searchParams.get('basketball_type'), mens ? 'eq.mens' : null);
      assert.equal(url.searchParams.get('order'), 'name.asc,id.asc');
    }
  }
});
test('one unavailable directory does not hide successful search results', async () => {
  const groups = await searchDirectory(fixture(async input => {
    const url = new URL(String(input));
    return url.pathname.endsWith('/womens_teams') ? new Response('{}', { status: 503 }) : Response.json([{ id: 'fixture', name: 'Fixture' }]);
  }), 'Test');
  assert.equal(groups.find(g => g.kind === 'women').failed, true);
  assert.deepEqual(groups.find(g => g.kind === 'women').rows, []);
  assert.equal(groups.find(g => g.kind === 'teams').rows.length, 1);
});
test('short or punctuation-only searches never query the database', async () => {
  let calls = 0;
  const client = fixture(async () => { calls++; return Response.json([]); });
  for (const input of ['', 'a', '(),.%']) assert.deepEqual(await searchDirectory(client, input), []);
  assert.equal(calls, 0);
  assert.equal(cleanDirectorySearch('a'.repeat(1000)).length, 100);
});
test('results navigate to canonical native routes and reject path injection', () => {
  assert.equal(searchResultPath('teams', 'fixture'), '/teams/fixture');
  assert.equal(searchResultPath('women', 'fixture'), '/womens/fixture');
  assert.equal(searchResultPath('womens-leagues', 'fixture'), '/womens/leagues/fixture');
  assert.equal(searchResultPath('players', 'fixture'), '/players/fixture');
  assert.equal(searchResultPath('coaches', 'fixture'), '/web?path=%2Fcoaches%2Ffixture');
  for (const value of ['../other', 'https://evil.example', 'fixture?x=1']) assert.equal(searchResultPath('teams', value), null);
});
