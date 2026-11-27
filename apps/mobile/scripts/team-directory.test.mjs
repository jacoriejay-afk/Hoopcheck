import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { teamDirectoryQuery, cleanTeamSearch, mergeTeamDirectoryRows, readTeamFacets, teamDirectoryScope } from '../src/native/teamDirectory.ts';

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

test('overlapping pages update canonical IDs without duplicate keys or reordering', () => {
  const first = [{id:'a',name:'A'},{id:'b',name:'Old B'}];
  const next = [{id:'b',name:'New B'},{id:'c',name:'C'},{id:'c',name:'Latest C'}];
  assert.deepEqual(mergeTeamDirectoryRows(first,next),[{id:'a',name:'A'},{id:'b',name:'New B'},{id:'c',name:'Latest C'}]);
  assert.equal(first[1].name,'Old B');
  assert.deepEqual(mergeTeamDirectoryRows([],next).map(x=>x.id),['b','c']);
});

test('country and league filter exact stored labels and isolate cached page scopes', async () => {
 const urls=[];const client=createClient('https://sandbox.example','test-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async input=>{urls.push(new URL(String(input)));return Response.json([]);}}});
 const facet={country:"Côte d’Ivoire",league:"League (A), 1"};
 await teamDirectoryQuery(client,false,"",0,facet);
 assert.equal(urls[0].searchParams.get('country'),'eq.'+facet.country);
 assert.equal(urls[0].searchParams.get('league_name'),'eq.'+facet.league);
 assert.notEqual(teamDirectoryScope(false,"",facet),teamDirectoryScope(true,"",facet));
 assert.notEqual(teamDirectoryScope(false,"",facet),teamDirectoryScope(false,"",{country:facet.country,league:""}));
});
test('on-demand facets preserve exact labels, separate sides, and deduplicate labels',async()=>{
 const calls=[];const client=createClient('https://sandbox.example','test-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async input=>{calls.push(new URL(String(input)));return Response.json([{id:"1",country:"Spain",league_name:"Liga A"},{id:"2",country:"Spain",league_name:"Liga A"},{id:"3",country:"Spain",league_name:"Liga B"},{id:"4",country:"Iceland",league_name:null},{id:"5",country:null,league_name:"Unknown"}]);}}});
 const result=await readTeamFacets(client,true,new AbortController().signal);
 assert.equal(result.complete,true);assert.deepEqual(result.countries,[{country:"Iceland",leagues:[]},{country:"Spain",leagues:["Liga A","Liga B"]}]);
 assert.equal(calls[0].pathname,'/rest/v1/womens_teams');assert.equal(calls[0].searchParams.get('limit'),'500');
 assert.equal(calls[0].searchParams.get('select'),'id,country,league_name');
 const abort=new AbortController();abort.abort();await assert.rejects(readTeamFacets(client,false,abort.signal),/cancelled/);assert.equal(calls.length,1);
});
