import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { compileFunction } from "node:vm";
import { NextResponse } from "next/server.js";
import ts from "typescript";

function load(path, imports) {
  const source = readFileSync(new URL("../" + path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  compileFunction(outputText, ["require", "exports", "process"])(imports, exports, {
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://storage.example",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public",
      SUPABASE_SERVICE_ROLE_KEY: "service",
    },
  });
  return exports;
}

const origin = "https://storage.example";
const author = "11111111-1111-4111-8111-111111111111";
const team = "22222222-2222-4222-8222-222222222222";
const postId = "33333333-3333-4333-8333-333333333333";
const objectId = "44444444-4444-4444-8444-444444444444";
const imagePath = "team-posts/" + team + "/" + author + "/" + objectId + ".jpg";
const reference = origin + "/storage/v1/object/public/feed-images/" + imagePath;
const media = load("lib/feed-media-reference.ts", () => assert.fail("Unexpected import"));

test("only post-scoped trusted legacy and private object paths resolve", () => {
  assert.deepEqual(media.resolveFeedMedia(reference, origin, author, "image", team), { bucket: "feed-images", path: imagePath });
  assert.deepEqual(media.resolveFeedMedia("feed-images/" + imagePath, origin, author, "image", team), { bucket: "feed-images", path: imagePath });
  assert.deepEqual(media.resolveFeedMedia("hoopfeed-private-images/" + imagePath, origin, author, "image", team), { bucket: "hoopfeed-private-images", path: imagePath });
  for (const invalid of [
    reference.replace(origin, "https://foreign.example"),
    reference.replace(author, team),
    reference.replace(objectId, "%2e%2e"),
    reference + "?download",
    reference.replace(".jpg", ".mp4"),
  ]) {
    assert.equal(media.resolveFeedMedia(invalid, origin, author, "image", team), null);
  }
});

test("official images sign only after the bearer-authenticated viewer can read the post", async () => {
  const signed = [];
  const lookedUp = [];
  const record = { image_url: reference, team_id: team, author_id: author };
  const route = load("app/api/team-fanfeed/media/route.ts", id => {
    if (id === "next/server") return { NextResponse };
    if (id.endsWith("/feed-media-reference")) return media;
    assert.equal(id, "@supabase/supabase-js");
    return { createClient: (_url, key, options) => {
      if (key === "service") {
        return { storage: { from: bucket => ({ createSignedUrl: async (path, ttl) => {
          signed.push({ bucket, path, ttl });
          return { data: { signedUrl: "https://storage.example/signed" } };
        } }) } };
      }
      const bearer = options.global.headers.Authorization;
      return {
        auth: { getUser: async token => ({ data: { user: token === "invalid" ? null : { id: author } } }) },
        from: table => {
          lookedUp.push({ table, bearer });
          const query = {
            select: () => query,
            eq: () => query,
            maybeSingle: async () => ({ data: bearer === "Bearer allowed" ? record : null }),
          };
          return query;
        },
      };
    } };
  });
  const request = token => new Request("https://hoopcheck.online/api/team-fanfeed/media", {
    method: "POST",
    headers: token ? { Authorization: "Bearer " + token } : {},
    body: JSON.stringify({ post_id: postId, media_url: "ignored/untrusted-path" }),
  });
  assert.equal((await route.POST(request())).status, 401);
  assert.equal((await route.POST(request("invalid"))).status, 401);
  assert.equal((await route.POST(request("no-access"))).status, 404);
  assert.equal(signed.length, 0);
  const allowed = await route.POST(request("allowed"));
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(lookedUp, [
    { table: "team_fanfeed_posts", bearer: "Bearer no-access" },
    { table: "team_fanfeed_posts", bearer: "Bearer allowed" },
  ]);
  assert.deepEqual(signed, [{ bucket: "feed-images", path: imagePath, ttl: 60 }]);
});

test("HoopFeed signs nested reshares against the original uploader under viewer RLS", async () => {
  const middleId = "55555555-5555-4555-8555-555555555555";
  const originalId = "66666666-6666-4666-8666-666666666666";
  const videoPath = author + "/" + objectId + ".mp4";
  const video = "hoopfeed-private-videos/" + videoPath;
  const records = new Map([
    [postId, { author_id: team, video_url: video, shared_post_id: middleId, expires_at: null }],
    [middleId, { author_id: team, video_url: video, shared_post_id: originalId, expires_at: null }],
    [originalId, { author_id: author, video_url: video, shared_post_id: null, expires_at: null }],
  ]);
  const signed = [];
  const route = load("app/api/hoopfeed/media/route.ts", id => {
    if (id === "next/server") return { NextResponse };
    if (id.endsWith("/feed-media-reference")) return media;
    assert.equal(id, "@supabase/supabase-js");
    return { createClient: (_url, key, options) => {
      if (key === "service") {
        return { storage: { from: bucket => ({ createSignedUrl: async (path, ttl) => {
          signed.push({ bucket, path, ttl });
          return { data: { signedUrl: origin + "/signed" } };
        } }) } };
      }
      return {
        auth: { getUser: async () => ({ data: { user: { id: team } } }) },
        from: table => {
          assert.equal(table, "feed_posts");
          let id;
          const query = {
            select: () => query,
            eq: (column, value) => {
              if (column === "id") id = value;
              else assert.deepEqual([column, value], ["status", "approved"]);
              return query;
            },
            maybeSingle: async () => ({
              data: id === originalId && options.global.headers.Authorization === "Bearer blocked"
                ? null : records.get(id),
            }),
          };
          return query;
        },
      };
    } };
  });

  const request = (token, mediaUrl = video) => new Request("https://hoopcheck.online/api/hoopfeed/media", {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: JSON.stringify({ post_id: postId, media_url: mediaUrl }),
  });
  assert.equal((await route.POST(request("blocked"))).status, 404);
  assert.equal((await route.POST(request("allowed", video.replace(".mp4", ".webm")))).status, 403);
  records.get(originalId).shared_post_id = postId;
  assert.equal((await route.POST(request("allowed"))).status, 404);
  records.get(originalId).shared_post_id = null;
  assert.deepEqual(signed, []);
  assert.equal((await route.POST(request("allowed"))).status, 200);
  assert.deepEqual(signed, [{ bucket: "hoopfeed-private-videos", path: videoPath, ttl: 60 }]);
  // Check all ancestors independently, even if a fixture returns an expired row.
  records.get(originalId).expires_at = new Date(Date.now() + 30000).toISOString();
  records.get(middleId).expires_at = new Date(Date.now() + 20000).toISOString();
  const bounded = await route.POST(request("allowed"));
  assert.equal(bounded.status, 200);
  const { expires_in } = await bounded.json();
  assert.ok(expires_in >= 1 && expires_in <= 15);
  assert.equal(signed.at(-1).ttl, expires_in);
  const before = signed.length;
  for (const value of ["not-a-date", new Date(Date.now() - 1000).toISOString(), new Date(Date.now() + 1000).toISOString()]) {
    records.get(middleId).expires_at = value;
    assert.equal((await route.POST(request("allowed"))).status, 404);
  }
  assert.equal(signed.length, before);
});

test("fan feed signed links expire before the source post and fail closed near expiry", async () => {
  const path = author + "/" + objectId + ".jpg";
  const record = { image_url: "hoopfeed-private-images/" + path, author_id: author, expires_at: "" };
  const signed = [];
  let signingDelay = 0;
  let now = Date.now();
  const originalNow = Date.now;
  const route = load("app/api/fan-feed/media/route.ts", id => {
    if (id === "next/server") return { NextResponse };
    if (id.endsWith("/feed-media-reference")) return media;
    assert.equal(id, "@supabase/supabase-js");
    return { createClient: (_url, key, options) => {
      if (key === "service") return { storage: { from: bucket => ({ createSignedUrl: async (object, ttl) => {
        signed.push({bucket, object, ttl});
        now += signingDelay;
        return { data: { signedUrl: "https://storage.example/signed" } };
      } }) } };
      assert.equal(options.global.headers.Authorization, "Bearer viewer");
      return { auth: { getUser: async () => ({ data: { user: { id: author } } }) }, from: table => {
        assert.equal(table, "fan_feed_posts");
        const query = { select: () => query, eq: () => query, gt: () => query, maybeSingle: async () => ({ data: record }) };
        return query;
      } };
    } };
  });
  const request = () => new Request("https://hoopcheck.online/api/fan-feed/media", {
    method: "POST", headers: { Authorization: "Bearer viewer" }, body: JSON.stringify({post_id:postId}),
  });
  Date.now = () => now;
  try {
    for (const invalid of ["invalid", new Date(now - 1000).toISOString(), new Date(now + 5000).toISOString()]) {
      record.expires_at = invalid;
      assert.equal((await route.POST(request())).status, 404);
    }
    assert.equal(signed.length, 0);
    record.expires_at = new Date(now + 20000).toISOString();
    assert.equal((await route.POST(request())).status, 200);
    assert.deepEqual(signed, [{bucket:"hoopfeed-private-images",object:path,ttl:15}]);
    signingDelay = 6000;
    assert.equal((await route.POST(request())).status, 404);
  } finally {
    Date.now = originalNow;
  }
});
