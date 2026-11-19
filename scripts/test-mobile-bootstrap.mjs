import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
function compile(path, imports) {
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const compiled = { exports: {} };
  new Function('require', 'module', 'exports', source)(imports, compiled, compiled.exports);
  return compiled.exports;
}
const membership = compile('../lib/membership-tier.ts', () => { throw new Error('Unexpected import'); });
const id = '11111111-1111-4111-8111-111111111111';
function fixture(options = {}) {
  const calls = [];
  const user = { id, email: 'private@example.test', user_metadata: { account_type: 'admin', isAdmin: true } };
  const db = {
    auth: { getUser: async token => { calls.push(['getUser', token]); return { data: { user }, error: options.invalid ? new Error('Rejected token') : null }; } },
    from(table) { const chain = { select(columns) { calls.push(['select',table,columns]); return chain; }, eq(key,value) { calls.push(['eq',table,key,value]); return chain; }, async maybeSingle() {
      return { data: table === 'profiles' ? (options.noProfile ? null : { account_type: options.accountType || 'player', display_name: 'Fixture', player_verified: true }) : (options.subscription || null), error: options.queryError ? new Error('private database error') : null };
    } }; return chain; },
    rpc: async name => { calls.push(['rpc',name]); return { data: options.role ?? null, error: options.roleError ? new Error('Role unavailable') : null }; },
  };
  const { GET } = compile('../app/api/mobile/bootstrap/route.ts', name => {
    if (name === 'next/server') return { NextResponse: { json: (body, init) => Response.json(body, init) } };
    if (name === '@supabase/supabase-js') return { createClient: (...args) => { calls.push(['client',...args]); return db; } };
    if (name === '../../../../lib/membership-tier') return membership;
    throw new Error(`Unexpected import ${name}`);
  });
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'fixture-publishable';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'never-use-this-secret';
  return { calls, get: authorization => GET(new Request('https://fixture.example/api/mobile/bootstrap', { headers: authorization ? { authorization } : {} })) };
}
test('anonymous and malformed auth cannot start database reads', async () => {
  for (const header of [undefined, 'Basic fixture', 'Bearer token extra', 'Bearer ' + 'x'.repeat(16385)]) {
    const f = fixture(); const response = await f.get(header);
    assert.equal(response.status,401); assert.deepEqual(f.calls,[]);
    assert.equal(response.headers.get('cache-control'),'private, no-store');
  }
});
test('invalid bearer is verified by Auth and cannot query membership', async () => {
  const f = fixture({invalid:true});
  assert.equal((await f.get('Bearer fixture-token')).status,401);
  assert.equal(f.calls.some(c=>c[0]==='select'),false);
});
test('scoped reads use verified identity and never service credentials or metadata roles', async () => {
  const f = fixture(); const response = await f.get('Bearer fixture-token'); const data = await response.json();
  assert.equal(response.status,200); assert.equal(data.entitlements.canReadHoopFeed,false);
  assert.deepEqual(data.user,{id,displayName:'Fixture',accountType:'player'});
  assert.ok(f.calls.some(c=>JSON.stringify(c)===JSON.stringify(['eq','profiles','id',id])));
  assert.ok(f.calls.some(c=>JSON.stringify(c)===JSON.stringify(['eq','membership_entitlements','user_id',id])));
  const client = f.calls.find(c=>c[0]==='client');
  assert.equal(client[2],'fixture-publishable'); assert.equal(client[3].global.headers.Authorization,'Bearer fixture-token');
  assert.equal(JSON.stringify(data).includes('private@example.test'),false);
  assert.equal(JSON.stringify(f.calls).includes('never-use-this-secret'),false);
});
test('canonical expiry and independently verified admin rules govern entitlements', async () => {
  const active = {plan:'pro',status:'active',current_period_end:'2099-01-01T00:00:00Z'};
  const paid = await (await fixture({subscription:active}).get('Bearer fixture')).json();
  assert.equal(paid.entitlements.canReadHoopFeed,true);
  const expired = await (await fixture({subscription:{...active,current_period_end:'2000-01-01T00:00:00Z'}}).get('Bearer fixture')).json();
  assert.equal(expired.entitlements.canReadHoopFeed,false);
  const forged = await (await fixture({accountType:'admin'}).get('Bearer fixture')).json();
  assert.equal(forged.entitlements.hasPaidMembership,false);
  const verified = await (await fixture({role:'admin'}).get('Bearer fixture')).json();
  assert.equal(verified.entitlements.tier,'premium');
});
test('database and role failures deny access without leaking errors', async () => {
  for (const options of [{queryError:true},{roleError:true}]) {
    const response = await fixture(options).get('Bearer fixture'); assert.equal(response.status,503);
    assert.equal((await response.text()).includes('private database'),false);
  }
  assert.equal((await fixture({noProfile:true}).get('Bearer fixture')).status,409);
});
