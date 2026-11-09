/* eslint-disable @typescript-eslint/no-require-imports -- Standalone TS regression harness. */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const ts = require("typescript");

function load(file, dependencies = {}, globals = {}) {
  const filename = resolve(__dirname, "..", file);
  const code = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports, require: name => dependencies[name] ?? require(name),
    process, console, URL, Request, Response, File, Buffer, AbortSignal, ...globals,
  }, { filename });
  return exports;
}

test("session retries expire stalled reads and old failures cannot clear newer reads", async () => {
  let now = 1000, calls = 0, authEvent;
  const pending = [];
  const auth = {
    getSession: () => { calls++; return new Promise((resolve, reject) => pending.push({ resolve, reject })); },
    onAuthStateChange: callback => { authEvent = callback; },
  };
  const { getCachedSession } = load("lib/supabase.ts", {
    "@supabase/ssr": { createBrowserClient: () => ({ auth }) },
  }, { window: {}, Date: { now: () => now } });
  const first = getCachedSession();
  assert.equal(getCachedSession(), first);
  now += 12000;
  const retry = getCachedSession();
  assert.notEqual(retry, first);
  pending[0].resolve({ error: new Error("old read failed") });
  await Promise.resolve();
  assert.equal(getCachedSession(), retry);
  pending[1].resolve({ error: null, data: { session: null } });
  await retry;
  authEvent();
  const afterSignout = getCachedSession();
  assert.notEqual(afterSignout, retry);
  pending[2].reject(new Error("network"));
  await assert.rejects(afterSignout);
  assert.notEqual(getCachedSession(), afterSignout);
  assert.equal(calls, 4);
});

test("Back tracks push, replace, browser Back/Forward and direct-entry boundaries", () => {
  const { trackNavigationHistory } = load("lib/navigation-history.ts");
  const entries = [{ __NA: true }];
  let cursor = 0;
  const history = {
    get state() { return entries[cursor]; },
    pushState(data) { entries.splice(++cursor, entries.length, data); },
    replaceState(data) { entries[cursor] = data; },
  };
  const browser = { history, crypto: { randomUUID: () => "mount" } };
  const originalPush = history.pushState;
  const tracker = trackNavigationHistory(browser);
  assert.equal(tracker.canGoBack(), false, "external history is not an app entry");
  history.pushState({ __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: "search" }, "", "/search");
  assert.equal(tracker.canGoBack(), true);
  history.replaceState({ __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: "updated" }, "");
  assert.equal(tracker.canGoBack(), true);
  assert.equal(history.state.__PRIVATE_NEXTJS_INTERNALS_TREE, "updated");
  cursor--;
  assert.equal(tracker.canGoBack(), false);
  cursor++;
  assert.equal(tracker.canGoBack(), true);
  tracker.dispose();
  assert.equal(history.pushState, originalPush);
});

test("first service-worker activation does not reload; replacement reloads once", async () => {
  for (const initiallyControlled of [false, true]) {
    const effects = [], listeners = new Map();
    let reloads = 0;
    const worker = {
      controller: initiallyControlled ? {} : null,
      register: async () => ({ addEventListener() {} }),
      addEventListener: (name, fn) => listeners.set(name, fn),
      removeEventListener: name => listeners.delete(name),
    };
    const { default: OfflineRuntime } = load("components/OfflineRuntime.tsx", {
      react: { useEffect: fn => effects.push(fn), useState: initial => [initial, () => {}] },
    }, {
      navigator: { onLine: true, serviceWorker: worker },
      window: { addEventListener() {}, removeEventListener() {}, location: { reload: () => reloads++ } },
      fetch: async () => ({ ok: false }), localStorage: { getItem: () => null },
    });
    OfflineRuntime();
    const cleanup = effects[0]();
    const change = listeners.get("controllerchange");
    change();
    assert.equal(reloads, initiallyControlled ? 1 : 0);
    change(); change();
    assert.equal(reloads, 1);
    cleanup();
    assert.equal(listeners.size, 0);
    await Promise.resolve();
  }
});

test("review API grants administrative Premium server-side without trusting user metadata", async () => {
  for (const [verifiedAdmin, expectedTier, canRead] of [[true, "premium", true], [false, "free", false]]) {
    const query = table => {
      const result = { data: table === "profiles" ? { account_type: "player", player_verified: false } : table === "reviews" ? [] : null, error: null };
      const chain = {
        select: () => chain, eq: () => chain, order: () => chain,
        maybeSingle: async () => result,
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
      };
      return chain;
    };
    const { GET } = load("app/api/review-access/route.ts", {
      "@supabase/supabase-js": { createClient: (_url, key, options) => ({
        auth: { getUser: async () => ({ data: { user: { id: "caller", user_metadata: { role: "admin" } } } }) },
        from: query,
        rpc: async name => {
          assert.equal(key, "public-fixture");
          assert.equal(options.global.headers.Authorization, "Bearer caller-jwt");
          assert.equal(name, "is_current_user_admin_or_moderator");
          return { data: verifiedAdmin, error: null };
        },
      }) },
      "../../../lib/membership-tier": load("lib/membership-tier.ts"),
      "../../../lib/review-summary": load("lib/review-summary.ts"),
    }, { process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://ci.invalid", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-fixture", SUPABASE_SERVICE_ROLE_KEY: "service-fixture" } } });
    const response = await GET(new Request("https://ci.invalid/api/review-access?entityType=team&entityId=11111111-1111-4111-8111-111111111111", { headers: { Authorization: "Bearer caller-jwt" } }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.tier, expectedTier);
    assert.equal(body.canReadFull, canRead);
    assert.equal(body.canWrite, false, "Admin access does not bypass player verification");
  }
});

test("Fan HQ uses real copy rather than humanized missing shared translation keys", () => {
  const { fanFeedI18n } = load("app/fan-feed/i18n.ts");
  assert.equal(fanFeedI18n("feedExplainer", "en", "Feed Explainer"), "Posts from the fan groups of the clubs you follow.");
  assert.equal(fanFeedI18n("emptyClubTitle", "en", "Empty Club Title"), "No posts yet — be the first to post for {team}.");
  assert.equal(fanFeedI18n("emptyKicker", "en", "EMPTY KICKER"), "CLUB FAN GROUPS");
  assert.equal(fanFeedI18n("feedExplainer", "es", "Feed Explainer"), "Publicaciones de los grupos de fans de los clubes que sigues.");
});

test("Fan Group API requires caller-scoped group authorization, including for admin labels", async () => {
  const teamId = "11111111-1111-4111-8111-111111111111";
  const previous = { ...process.env };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://ci.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public-fixture";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-fixture";
  try {
    for (const [role, allowed, rpcError, expected] of [
      ["club_admin", false, null, 403], ["admin", false, null, 403],
      ["manager", false, null, 403], ["fan", false, null, 403],
      ["fan", true, null, 400], ["manager", true, null, 400],
      ["admin", true, null, 400], ["manager", true, { message: "unavailable" }, 403],
    ]) {
      let checked = false;
      const db = {
        auth: { getUser: async () => ({ data: { user: { id: "caller" } } }) },
        from: table => {
          const query = {
            select: () => query, eq: () => query,
            maybeSingle: async () => ({ data: table === "profiles" ? { account_type: role } : table === "team_fan_groups" ? { team_id: teamId } : null }),
          };
          return query;
        },
      };
      const { POST } = load("app/api/fan-groups/route.ts", {
        "@supabase/supabase-js": { createClient: (_url, key, options) => {
          if (key === "service-fixture") return db;
          assert.equal(key, "public-fixture");
          assert.equal(options.global.headers.Authorization, "Bearer caller-jwt");
          return { rpc: async (name, args) => {
            assert.equal(name, "is_team_fan_group_moderator");
            assert.equal(args.p_team_id, teamId);
            checked = true;
            return { data: allowed, error: rpcError };
          } };
        } },
        "../../../lib/membership-tier": load("lib/membership-tier.ts"),
      });
      const form = new FormData();
      form.set("team_id", teamId);
      form.set("action", "unsupported-moderator-action");
      const response = await POST(new Request("https://ci.invalid/api/fan-groups", {
        method: "POST", headers: { Authorization: "Bearer caller-jwt" }, body: form,
      }));
      assert.equal(response.status, expected, `${role} allowed=${allowed} rpcError=${Boolean(rpcError)}`);
      assert.equal(checked, true);
    }
  } finally {
    for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  }
});
