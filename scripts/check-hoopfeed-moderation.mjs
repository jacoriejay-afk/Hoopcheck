import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { compileFunction } from 'node:vm';
import { NextResponse } from 'next/server.js';
import ts from 'typescript';

const route = readFileSync(new URL('../app/api/hoopfeed/moderate/route.ts', import.meta.url), 'utf8');
const loadRoute = compileFunction(ts.transpileModule(route, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, ['require', 'exports', 'fetch', 'process']);

function fixture(secondResult) {
  const events = [];
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: 'fixture-player' } } }) },
    from(table) {
      const records = { profiles: { account_type: 'player' }, subscriptions: { plan: 'premium', status: 'active' } };
      return {
        select: () => ({ eq: () => table === 'admin_roles' ? { data: [] } : { maybeSingle: async () => ({ data: records[table] }) } }),
        insert: async (row) => { events.push(['insert', table, row.image_urls.length]); return { error: null }; },
        upsert: async () => ({ error: null }),
      };
    },
    storage: { from: () => ({
      upload: async (_path, bytes) => { events.push(['upload', bytes.toString()]); return { error: null }; },
      getPublicUrl: (path) => ({ data: { publicUrl: 'https://fixture.invalid/' + path } }),
    }) },
  };
  const routeExports = {};
  loadRoute((id) => {
    if (id === 'next/server') return { NextResponse };
    if (id === '@supabase/supabase-js') return { createClient: () => db };
    if (id.endsWith('/membership-tier')) return { getHoopCheckEntitlements: () => ({ canWriteHoopFeed: true }) };
    throw new Error(`Unexpected route dependency ${id}`);
  }, routeExports, async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/moderations');
    const input = JSON.parse(options.body).input;
    const photo = input.find(({ type }) => type === 'image_url').image_url.url;
    const content = Buffer.from(photo.split(',')[1], 'base64').toString();
    events.push(['moderate', content]);
    return Response.json({ results: [content === 'second photo' ? secondResult : { flagged: false }] });
  }, { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://fixture.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fixture', OPENAI_API_KEY: 'fixture' } });

  const form = new FormData();
  form.set('text', 'Training recap');
  form.set('image', new Blob(['first photo'], { type: 'image/png' }), 'first.png');
  form.append('images', new Blob(['second photo'], { type: 'image/png' }), 'second.png');
  const request = new Request('http://localhost/api/hoopfeed/moderate', {
    method: 'POST', headers: { Authorization: 'Bearer fixture-session' }, body: form,
  });
  return { submit: () => routeExports.POST(request), events };
}

test('a rejected second photo prevents all uploads and publication', async () => {
  const { submit, events } = fixture({ flagged: true });
  const response = await submit();
  assert.equal(response.status, 400);
  assert.equal((await response.json()).allowed, false);
  assert.deepEqual(events, [['moderate', 'first photo'], ['moderate', 'second photo']]);
});

test('an invalid second moderation decision prevents all writes', async () => {
  const { submit, events } = fixture({});
  const response = await submit();
  assert.equal(response.status, 502);
  assert.equal((await response.json()).allowed, false);
  assert.deepEqual(events, [['moderate', 'first photo'], ['moderate', 'second photo']]);
});

test('approved photos upload only after every decision succeeds', async () => {
  const { submit, events } = fixture({ flagged: false });
  const response = await submit();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).allowed, true);
  assert.deepEqual(events, [
    ['moderate', 'first photo'], ['moderate', 'second photo'],
    ['upload', 'first photo'], ['upload', 'second photo'], ['insert', 'feed_posts', 2],
  ]);
});
