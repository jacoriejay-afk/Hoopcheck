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
function screen(path, { state = [], params = {}, segments = [], pathname = "/", configurationError = null, pendingDestination = null, supabase = {} } = {}) {
  const calls = { push: [], replace: [], alerts: [], oauthUrls: [], freshSignIns: 0, remembered: [] };
  const effects = [];
  let slot = 0;
  const router = { push: p => calls.push.push(p), replace: p => calls.replace.push(p) };
  function Stack() {}
  Stack.Screen = "Screen";
  const imports = name => {
    if (name === "react") return { useState: initial => [state[slot++] ?? initial, () => {}], useEffect: f => effects.push(f) };
    if (name === "react-native") return { Platform: { OS: "ios" }, StyleSheet: { create: s => s }, Alert: { alert: (...args) => calls.alerts.push(args) }, AccessibilityInfo: { isReduceMotionEnabled: async () => false }, Image: "Image", ScrollView: "ScrollView", Text: "Text", View: "View", Pressable: "Pressable", KeyboardAvoidingView: "KeyboardAvoidingView", ActivityIndicator: "ActivityIndicator" };
    if (name === "expo-router") return { Stack, Link: "Link", useRouter: () => router, useLocalSearchParams: () => params, useGlobalSearchParams: () => params, useSegments: () => segments, usePathname: () => pathname };
    if (name === "expo-linking") return { createURL: p => `hoopcheck://${p}`, openURL: async url => calls.oauthUrls.push(url) };
    if (name === "expo-font") return { useFonts: () => [true, null] };
    if (name === "expo-status-bar") return { StatusBar: "StatusBar" };
    if (name === "react-native-safe-area-context") return { SafeAreaView: "SafeAreaView", SafeAreaProvider: "SafeAreaProvider" };
    if (name.endsWith("/theme")) return { useEntryTheme: () => theme };
    if (name.endsWith("/primitives")) return { GlassCard: "GlassCard", Input: "Input", Button: "Button" };
    if (name.endsWith("/supabase")) return { supabase, supabaseConfigurationError: configurationError };
    if (name.endsWith("/native/lockPolicy")) return { recordFreshSignIn: () => { calls.freshSignIns++; } };
    if (name.endsWith("/native/pendingDestination")) return { takeDestination: () => pendingDestination, rememberDestination: value => calls.remembered.push(value) };
    if (name === "react-native-gesture-handler") return { GestureHandlerRootView: "GestureHandlerRootView" };
    if (name === "@gorhom/bottom-sheet") return { BottomSheetModalProvider: "BottomSheetModalProvider" };
    if (name === "expo-splash-screen") return { preventAutoHideAsync: async () => {}, setOptions: () => {}, hideAsync: async () => {} };
    if (name.endsWith("/native/preferences")) return { DevicePreferences: "DevicePreferences" };
    if (name.endsWith("/native/useNativeAccount")) return { NativeAccountProvider: "NativeAccountProvider" };
    if (name.endsWith("/native/network")) return { NetworkProvider: "NetworkProvider" };
    if (name.endsWith("/motion/Provider")) return { MotionProvider: "MotionProvider" };
    if (name.endsWith("/motion/config")) return { motion: { logo: 300, shortFade: 100, splashDeadline: 2000 } };
    if (name.endsWith("/native/telemetry")) return { traceFlow: (_, fn) => fn(), Sentry: { wrap: component => component } };
    if (name.endsWith("/Onboarding")) return { Onboarding: "Onboarding" };
    if (name.endsWith("/AppLock")) return { AppLock: "AppLock" };
    if (name.endsWith("/TabBar")) return { TabBar: "TabBar" };
    if (name.endsWith("/RouteFade")) return { RouteFade: "RouteFade" };
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
    [["reset-password"], true, []], [["sign-in"], true, []],
    [["dashboard"], false, ["/sign-in"]],
  ]) {
    const f = screen("app/_layout.tsx", { state: [true, signedIn], segments });
    f.effects[2]();
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


test("OS callback URL reaches native PKCE exchange rather than browser handoff", async () => {
  const links = compile("src/native/deepLinks.ts", () => { throw new Error("Unexpected dependency"); });
  const intent = compile("app/+native-intent.tsx", name => {
    assert.equal(name, "../src/native/deepLinks"); return links;
  });
  const destination = intent.redirectSystemPath({ path: "hoopcheck://auth/callback?code=fixture-code", initial: true });
  assert.equal(destination.split("?")[0], "/auth/callback");
  const params = Object.fromEntries(new URL(destination, "https://fixture.example").searchParams);
  const codes = [];
  const f = screen("app/auth/callback.tsx", { params, supabase: {
    ...profile("fixture"), auth: { exchangeCodeForSession: async code => { codes.push(code); return { data: { user: { id: "user" } }, error: null }; } },
  } });
  f.effects[0](); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(codes, ["fixture-code"]);
  assert.deepEqual(f.calls.replace, ["/dashboard"]);
});


test("OAuth callback honors the pending destination after a verified fresh sign-in", async () => {
  const f = screen("app/auth/callback.tsx", { params: { code: "fixture-code" }, pendingDestination: "/teams/fixture", supabase: {
    ...profile("fixture"), auth: { exchangeCodeForSession: async () => ({ data: { user: { id: "user" } }, error: null }) },
  } });
  f.effects[0](); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(f.calls.replace, ["/teams/fixture"]);
  assert.equal(f.calls.freshSignIns, 1);
});

test("a provider error without description never exchanges a supplied code", async () => {
  let exchanged = false;
  const f = screen("app/auth/callback.tsx", { params: { code: "fixture", error: "access_denied" }, supabase: { auth: { exchangeCodeForSession: async () => { exchanged = true; } } } });
  f.effects[0](); await new Promise(resolve => setImmediate(resolve));
  assert.equal(exchanged, false);
  assert.equal(f.calls.freshSignIns, 0);
});

test("OAuth exchange screen does not trigger app lock before fresh sign-in is recorded", () => {
  for (const [segments, expected] of [[["auth", "callback"], false], [["dashboard"], true]]) {
    const f = screen("app/_layout.tsx", { state: [true, true], segments });
    assert.equal(f.nodes.find(node => node.type === "AppLock").props.protectedScreen, expected);
  }
});


test("protected native links preserve bounded post/search destinations without retaining auth secrets", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  for (const [segments, pathname, params, expected] of [
    [["feed"], "/feed", { post: id, code: "secret" }, `/feed?post=${id}`],
    [["feed"], "/feed", { post: "bad" }, "/feed"],
    [["search"], "/search", { q: "x".repeat(200), token: "secret" }, "/search?q=" + "x".repeat(100)],
  ]) {
    const f = screen("app/_layout.tsx", { state: [true, false], segments, pathname, params });
    f.effects[2]();
    assert.deepEqual(f.calls.remembered, [expected]);
    assert.deepEqual(f.calls.replace, ["/sign-in"]);
  }
});


test("protected search retains a bounded query across sign-in without extra URL fields", () => {
  const f = screen("app/_layout.tsx", { state: [true, false], segments: ["search"], pathname: "/search", params: { q: "x".repeat(200), token: "discard" } });
  f.effects[2](); assert.deepEqual(f.calls.remembered, ["/search?q=" + "x".repeat(100)]);
});
