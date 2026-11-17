import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
function compile(path, imports, globals = {}) {
  const js = ts.transpileModule(source(path), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const compiled = { exports: {} };
  new Function("require", "exports", "module", ...Object.keys(globals), js)(imports, compiled.exports, compiled, ...Object.values(globals));
  return compiled.exports;
}
const theme = { radius: { control: 16 }, type: { display: {} } };
function screen(path, { state = [], params = {}, segments = [], configurationError = null, supabase = {} } = {}) {
  const calls = { push: [], replace: [], alerts: [], oauthUrls: [] };
  const effects = [];
  let slot = 0;
  const router = { push: p => calls.push.push(p), replace: p => calls.replace.push(p) };
  function Stack() {}
  Stack.Screen = "Screen";
  const imports = name => {
    if (name === "react") return { useState: initial => [state[slot++] ?? initial, () => {}], useEffect: f => effects.push(f) };
    if (name === "react-native") return { Platform: { OS: "ios" }, StyleSheet: { create: s => s }, Alert: { alert: (...args) => calls.alerts.push(args) }, Image: "Image", ScrollView: "ScrollView", Text: "Text", View: "View", Pressable: "Pressable", KeyboardAvoidingView: "KeyboardAvoidingView", ActivityIndicator: "ActivityIndicator" };
    if (name === "expo-router") return { Stack, Link: "Link", useRouter: () => router, useLocalSearchParams: () => params, useSegments: () => segments, usePathname: () => "/" };
    if (name === "expo-linking") return { createURL: p => `hoopcheck://${p}`, openURL: async url => calls.oauthUrls.push(url) };
    if (name === "expo-font") return { useFonts: () => [true, null] };
    if (name === "expo-status-bar") return { StatusBar: "StatusBar" };
    if (name === "react-native-safe-area-context") return { SafeAreaView: "SafeAreaView", SafeAreaProvider: "SafeAreaProvider" };
    if (name.endsWith("/theme")) return { useEntryTheme: () => theme };
    if (name.endsWith("/primitives")) return { GlassCard: "GlassCard", Input: "Input", Button: "Button" };
    if (name.endsWith("/supabase")) return { supabase, supabaseConfigurationError: configurationError };
    if (/\.(png|ttf)$/.test(name)) return 1;
    return require(name);
  };
  const Component = compile(path, imports).default;
  const tree = Component();
  function nodes(node) {
    if (!node || typeof node !== "object") return [];
    return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
  }
  return { calls, effects, nodes: nodes(tree) };
}
const profile = username => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { username } }) }) }) }) });

test("themed welcome buttons navigate explicitly to sign-in and sign-up", () => {
  const f = screen("app/index.tsx");
  const buttons = f.nodes.filter(n => n.type === "Button");
  assert.equal(buttons.length, 2);
  buttons.forEach(b => b.props.onPress());
  assert.deepEqual(f.calls.push, ["/sign-in", "/sign-up"]);
  assert.ok(f.nodes.some(n => n.type === "GlassCard"));
});

test("password sign-in normalizes email and retains profile destination selection", async () => {
  for (const [username, destination] of [["player", "/dashboard"], ["", "/choose-username"]]) {
    const requests = [];
    const f = screen("app/sign-in.tsx", { state: [" Player@Example.com ", "password"], supabase: {
      ...profile(username), auth: { signInWithPassword: async args => { requests.push(args); return { data: { user: { id: "user" } }, error: null }; } },
    } });
    await f.nodes.find(n => n.type === "Button" && !n.props.secondary).props.onPress();
    assert.deepEqual(requests, [{ email: "player@example.com", password: "password" }]);
    assert.deepEqual(f.calls.replace, [destination]);
    assert.ok(f.nodes.some(n => n.type === "Input" && n.props.secureTextEntry));
  }
});

test("Google sign-in keeps the native PKCE callback and opens only a returned OAuth URL", async () => {
  const requests = [];
  const f = screen("app/sign-in.tsx", { supabase: { auth: { signInWithOAuth: async args => { requests.push(args); return { data: { url: "https://provider.invalid/authorize" }, error: null }; } } } });
  await f.nodes.find(n => n.type === "Button" && n.props.secondary).props.onPress();
  assert.deepEqual(requests, [{ provider: "google", options: { redirectTo: "hoopcheck://auth/callback", skipBrowserRedirect: true } }]);
  assert.deepEqual(f.calls.oauthUrls, ["https://provider.invalid/authorize"]);
});

test("invalid build configuration blocks both sign-in methods before any auth request", async () => {
  const f = screen("app/sign-in.tsx", { configurationError: "Invalid Supabase URL", state: ["player@example.com", "password"] });
  for (const button of f.nodes.filter(n => n.type === "Button")) await button.props.onPress();
  assert.equal(f.calls.alerts.length, 2);
  assert.ok(f.calls.alerts.every(a => a[0] === "Setup required"));
  assert.deepEqual(f.calls.oauthUrls, []);
  assert.deepEqual(f.calls.replace, []);
});

test("layout does not interrupt callback exchange, but retains protected-route redirects", () => {
  for (const [segments, signedIn, expected] of [
    [["auth", "callback"], true, []], [["auth", "callback"], false, []],
    [["reset-password"], true, []], [["sign-in"], true, ["/dashboard"]],
    [["dashboard"], false, ["/sign-in"]],
  ]) {
    const f = screen("app/_layout.tsx", { state: [true, signedIn], segments });
    f.effects[1]();
    assert.deepEqual(f.calls.replace, expected);
  }
});

test("callback exchanges its code and selects the correct authenticated destination", async () => {
  for (const [username, destination] of [["player", "/dashboard"], ["", "/choose-username"]]) {
    const codes = [];
    const f = screen("app/auth/callback.tsx", { params: { code: "pkce-code" }, supabase: {
      ...profile(username), auth: { exchangeCodeForSession: async code => { codes.push(code); return { data: { user: { id: "user" } }, error: null }; } },
    } });
    f.effects[0]();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(codes, ["pkce-code"]);
    assert.deepEqual(f.calls.replace, [destination]);
  }
});

test("denied, missing-code and misconfigured callbacks never exchange or redirect", async () => {
  for (const options of [{ params: {} }, { params: { code: "code", error_description: "denied" } }, { params: { code: "code" }, configurationError: "Invalid URL" }]) {
    let exchanged = false;
    const f = screen("app/auth/callback.tsx", { ...options, supabase: { auth: { exchangeCodeForSession: async () => { exchanged = true; } } } });
    f.effects[0]();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(exchanged, false);
    assert.deepEqual(f.calls.replace, []);
  }
});
