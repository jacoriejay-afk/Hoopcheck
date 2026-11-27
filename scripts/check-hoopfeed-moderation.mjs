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

function fixture(secondResult, failure = null, options = {}) {
  const events = [];
  const rows = [];
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: 'fixture-player' } } }) },
    from(table) {
      const records = { profiles: { account_type: 'player' }, membership_entitlements: { plan: 'premium', status: 'active' } };
      return {
        select: () => ({ eq: () => table === 'admin_roles' ? { data: [] } : { maybeSingle: async () => ({ data: records[table] }) } }),
        insert: async (row) => { rows.push(row); events.push(['insert', table, row.image_urls.length]); return { error: failure === 'insert' ? { message: 'fixture insert failed' } : null }; },
        upsert: async () => ({ error: null }),
      };
    },
    storage: { from: () => ({
      upload: async (_path, bytes) => { events.push(['upload', bytes.toString()]); return { error: failure === 'second-upload' && bytes.toString() === 'second photo' ? { message: 'fixture upload failed' } : null }; },
      remove: async (paths) => { events.push(['remove', paths.length]); return { error: null }; },
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
  }, { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://fixture.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fixture', OPENAI_API_KEY: 'fixture', ...(options.story ? { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-public', HOOPCHECK_PHOTO_STORIES_ENABLED:options.enabled?'true':'false' } : {}) } });

  const form = new FormData();
  form.set('text', 'Training recap');
  form.set('image', new Blob(['first photo'], { type: 'image/png' }), 'first.png');
  if (!options.story || options.extraPhoto) form.append('images', new Blob(['second photo'], { type: 'image/png' }), 'second.png');
  if (options.story) { form.set('post_kind','story');form.set('audience',options.audience??'followers');for(const [field,value] of Object.entries(options.fields??{}))form.set(field,value); }
  const request = new Request('http://localhost/api/hoopfeed/moderate', {
    method: 'POST', headers: { Authorization: 'Bearer fixture-session' }, body: form,
  });
  return { submit: () => routeExports.POST(request), events, rows };
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


test('failed second upload removes the first uploaded photo', async () => {
  const { submit, events } = fixture({ flagged: false }, 'second-upload');
  const response = await submit();
  assert.equal(response.status, 400);
  assert.equal((await response.json()).allowed, false);
  assert.deepEqual(events.slice(-3).map(event => event[0]), ['upload', 'upload', 'remove']);
  assert.deepEqual(events.at(-1), ['remove', 1]);
});

test('failed post insert removes every uploaded photo', async () => {
  const { submit, events } = fixture({ flagged: false }, 'insert');
  const response = await submit();
  assert.equal(response.status, 400);
  assert.equal((await response.json()).allowed, false);
  assert.deepEqual(events.at(-1), ['remove', 2]);
});

test('fan-group moderation resolves the authenticated platform role, not a service-role RPC', () => {
  const groupRoute = readFileSync(new URL('../app/api/fan-groups/route.ts', import.meta.url), 'utf8');
  assert.match(groupRoute, /from\("admin_roles"\)[\s\S]*?\.eq\("user_id", user\.id\)/);
  assert.match(groupRoute, /const isModerator = Boolean\(explicitMod \|\| isPlatformAdmin \|\| \(platformMod && isPlatformModerator\)\)/);
  assert.doesNotMatch(groupRoute, /rpc\("is_current_user_admin_or_moderator"\)/);
  assert.doesNotMatch(groupRoute, /entitlements\.canModerateFanGroups\s*\|\|/);
});

test("photo Stories are disabled by default and invalid audience or client expiry fails before moderation",async()=>{
 for(const options of [{story:true},{story:true,enabled:true,audience:"community"},{story:true,enabled:true,extraPhoto:true},{story:true,enabled:true,fields:{expires_at:"2099-01-01"}},{story:true,enabled:true,fields:{post_location:"private"}}]){
  const {submit,events,rows}=fixture({flagged:false},null,options);
  const result=await submit();assert.equal(result.status,options.enabled?400:403);assert.equal((await result.json()).allowed,false);
  assert.deepEqual(events,[]);assert.deepEqual(rows,[]);
 }
});
test("approved photo Story is follower-only and expires exactly 24 hours after server creation",async()=>{
 const {submit,events,rows}=fixture({flagged:false},null,{story:true,enabled:true});
 const start=Date.now();const result=await submit();assert.equal(result.status,200);
 assert.deepEqual(events,[["moderate","first photo"],["upload","first photo"],["insert","feed_posts",1]]);
 const body=await result.json(),row=rows[0];
 assert.equal(row.post_kind,"story");assert.equal(row.community_visible,false);
 assert.equal(row.video_url,null);assert.equal(row.location_country,null);
 assert.equal(Date.parse(row.expires_at)-Date.parse(row.created_at),86400000);
 assert.ok(Date.parse(row.created_at)>=start);assert.equal(body.story_expires_at,row.expires_at);
});
test("permanent posts remain permanent",async()=>{
 const {submit,rows}=fixture({flagged:false});assert.equal((await submit()).status,200);
 assert.equal(rows[0].post_kind,"discussion");assert.equal(rows[0].expires_at,null);
});
