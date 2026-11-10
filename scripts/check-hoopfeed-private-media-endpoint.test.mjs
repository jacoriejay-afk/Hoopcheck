import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { compileFunction } from "node:vm";
import { NextResponse } from "next/server.js";
import ts from "typescript";

const route = readFileSync("app/api/hoopfeed/private-media/route.ts", "utf8");
const migration = readFileSync("supabase/migrations/20261110140000_hoopfeed_private_storage_staging.sql", "utf8");
const moderation = readFileSync("app/api/hoopfeed/moderate/route.ts", "utf8");
const fan = readFileSync("app/api/fan-feed/moderate/route.ts", "utf8");

const compilerOptions = { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 };
const loadRoute = compileFunction(ts.transpileModule(route, { compilerOptions }).outputText, ["require", "exports", "process"]);
const parser = {};
const parserSource = readFileSync("lib/hoopfeed-private-media-ref.ts", "utf8");
compileFunction(ts.transpileModule(parserSource, { compilerOptions }).outputText, ["exports"])(parser);

const author = "11111111-1111-4111-8111-111111111111";
const postId = "22222222-2222-4222-8222-222222222222";
const path = `${author}/33333333-3333-4333-8333-333333333333.jpg`;
const ref = `hoopfeed-private-images/${path}`;
const signedUrl = "https://fixture.invalid/signed-image";

function fixture({ userId = author, status = "approved", expiresAt = Date.now() + 120_000, storedRefs = [ref] } = {}) {
  const signed = [];
  const filters = [];
  const db = {
    auth: { getUser: async (token) => token === "fixture-session"
      ? { data: { user: { id: userId } }, error: null }
      : { data: { user: null }, error: new Error("Invalid token") } },
    from(table) {
      assert.equal(table, "feed_posts");
      const query = {
        select: () => query,
        eq(column, value) { filters.push([column, value]); return query; },
        maybeSingle: async () => ({
          data: { author_id: author, status, expires_at: new Date(expiresAt).toISOString(), image_urls: storedRefs },
          error: null,
        }),
      };
      return query;
    },
    storage: { from: (bucket) => ({
      createSignedUrl: async (objectPath, seconds) => {
        signed.push([bucket, objectPath, seconds]);
        return { data: { signedUrl }, error: null };
      },
    }) },
  };
  const routeExports = {};
  loadRoute((id) => {
    if (id === "next/server") return { NextResponse };
    if (id === "@supabase/supabase-js") return { createClient: () => db };
    if (id.endsWith("/hoopfeed-private-media-ref")) return parser;
    throw new Error(`Unexpected route dependency ${id}`);
  }, routeExports, { env: { NEXT_PUBLIC_SUPABASE_URL: "https://fixture.invalid", SUPABASE_SERVICE_ROLE_KEY: "fixture" } });

  return {
    signed, filters,
    submit(authorization) {
      return routeExports.POST(new Request("https://fixture.invalid/api/hoopfeed/private-media", {
        method: "POST",
        headers: authorization ? { Authorization: authorization } : {},
        body: JSON.stringify({ post_id: postId, ref }),
      }));
    },
  };
}

test("a standard bearer token lets the author sign media attached to an approved post", async () => {
  const { submit, signed, filters } = fixture();
  const response = await submit("Bearer fixture-session");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), { url: signedUrl, expires_in: 60 });
  assert.deepEqual(filters, [["id", postId], ["author_id", author]]);
  assert.deepEqual(signed, [["hoopfeed-private-images", path, 60]]);
});

test("missing, malformed, and invalid bearer tokens cannot sign media", async () => {
  const { submit, signed } = fixture();
  for (const header of [undefined, "Basic fixture-session", "Bearer invalid-token"]) {
    assert.equal((await submit(header)).status, 401);
  }
  assert.deepEqual(signed, []);
});

test("another user, rejected or expired posts, and unattached references cannot sign media", async () => {
  for (const options of [{ userId: postId }, { status: "rejected" }, { expiresAt: Date.now() - 1 }, { storedRefs: [] }]) {
    const { submit, signed } = fixture(options);
    assert.equal((await submit("Bearer fixture-session")).status, 404);
    assert.deepEqual(signed, []);
  }
});
test("new private buckets do not change shared public fan-feed buckets", () => {
  assert.match(migration, /'hoopfeed-private-images'/);
  assert.match(migration, /'hoopfeed-private-videos'/);
  assert.match(migration, /false, 8388608/);
  assert.match(migration, /false, 52428800/);
  assert.doesNotMatch(migration, /values\s*\('feed-images'/i);
  assert.match(moderation, /storage\.from\("feed-images"\)/);
  assert.match(fan, /storage\.from\("feed-images"\)/);
});
