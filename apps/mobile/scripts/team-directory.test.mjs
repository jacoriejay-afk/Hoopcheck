import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { teamDirectoryQuery, cleanTeamSearch } from '../src/native/teamDirectory.ts';

test('native directory uses each canonical table, active filters and stable pages', async () => {
  for (const women of [false, true]) {
    let request;
    const client = createClient('https://sandbox.example', 'test-key', { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: async (input, options) => {
      request = { url: new URL(String(input)), options };
      return Response.json([{ id: 'fixture-team', name: 'Fixture Team' }]);
    } } });
    const result = await teamDirectoryQuery(client, women, 'Test (city),country.eq.secret', 40);
    assert.equal(result.error, null);
    assert.equal(result.data[0].id, 'fixture-team');
    assert.equal(request.url.pathname, women ? '/rest/v1/womens_teams' : '/rest/v1/teams');
    assert.equal(request.url.searchParams.get('active'), 'eq.true');
    assert.equal(request.url.searchParams.get('basketball_type'), women ? null : 'eq.mens');
    assert.equal(request.url.searchParams.get('order'), 'name.asc,id.asc');
    assert.equal(request.url.searchParams.get('offset'), '40');
    assert.equal(request.url.searchParams.get('limit'), '41');
    assert.equal(request.url.searchParams.get('or'), '(name.ilike.%Test city country eq secret%,country.ilike.%Test city country eq secret%,city.ilike.%Test city country eq secret%,league_name.ilike.%Test city country eq secret%)');
    assert.equal(request.options.method, 'GET');
  }
});
test('search preserves international names and bounds filter input', () => {
  assert.equal(cleanTeamSearch("  İstanbul   Žabiny  "), 'İstanbul Žabiny');
  assert.equal(cleanTeamSearch('a'.repeat(500)).length, 120);
});
